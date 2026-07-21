#!/usr/bin/env node
const { performance } = require("perf_hooks");

const PROFILES = {
  light: { vus: 10, durationSeconds: 30 },
  pilot: { vus: 20, durationSeconds: 60 },
  peak: { vus: 40, durationSeconds: 60 },
};

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.BASE_URL || "https://autenix-api.vercel.app",
    slug: process.env.RESTAURANTE_SLUG || "restgrazi",
    profile: process.env.LOAD_PROFILE || "light",
    vus: null,
    durationSeconds: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--base-url") {
      options.baseUrl = next;
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.split("=")[1];
    } else if (arg === "--slug") {
      options.slug = next;
      index += 1;
    } else if (arg.startsWith("--slug=")) {
      options.slug = arg.split("=")[1];
    } else if (arg === "--profile") {
      options.profile = next;
      index += 1;
    } else if (arg.startsWith("--profile=")) {
      options.profile = arg.split("=")[1];
    } else if (arg === "--vus") {
      options.vus = Number(next);
      index += 1;
    } else if (arg.startsWith("--vus=")) {
      options.vus = Number(arg.split("=")[1]);
    } else if (arg === "--duration") {
      options.durationSeconds = Number(next);
      index += 1;
    } else if (arg.startsWith("--duration=")) {
      options.durationSeconds = Number(arg.split("=")[1]);
    } else if (arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Argumento invalido: ${arg}`);
    }
  }

  const profile = PROFILES[options.profile];
  if (!profile) {
    throw new Error(`Perfil invalido: ${options.profile}`);
  }

  options.baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  options.slug = String(options.slug || "").trim();
  options.vus = options.vus || profile.vus;
  options.durationSeconds = options.durationSeconds || profile.durationSeconds;

  if (!options.baseUrl) throw new Error("BASE_URL obrigatorio");
  if (!options.slug) throw new Error("RESTAURANTE_SLUG obrigatorio");
  if (!Number.isInteger(options.vus) || options.vus <= 0) throw new Error("vus invalido");
  if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
    throw new Error("duration invalido");
  }

  return options;
}

function usage() {
  return [
    "Uso: node load-tests/node/polling-smoke.js [--profile light|pilot|peak] [--base-url URL] [--slug SLUG]",
    "",
    "Variaveis opcionais:",
    "  BASE_URL, RESTAURANTE_SLUG, LOAD_PROFILE",
    "  GARCOM_TOKEN, COZINHA_TOKEN, ADMIN_TOKEN, FINANCEIRO_TOKEN",
    "  MESA_ID, MESA_SESSION",
    "",
    "Producao exige ALLOW_PRODUCTION_LOAD_TEST=true.",
  ].join("\n");
}

function isProductionUrl(baseUrl) {
  return /(^https:\/\/autenix\.vercel\.app|^https:\/\/autenix-api\.vercel\.app|\.vercel\.app)/i
    .test(baseUrl);
}

function guardProductionLoad(baseUrl) {
  if (isProductionUrl(baseUrl) && process.env.ALLOW_PRODUCTION_LOAD_TEST !== "true") {
    throw new Error(
      "Teste de carga contra producao bloqueado. Defina ALLOW_PRODUCTION_LOAD_TEST=true somente em janela autorizada.",
    );
  }
}

function percentile(values, percent) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percent / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function buildRequests(options) {
  const slug = encodeURIComponent(options.slug);
  const requests = [
    { name: "health", path: "/api/health" },
    { name: "readiness", path: "/api/health/readiness" },
    { name: "cardapio", path: `/api/cardapio?restaurante_slug=${slug}` },
    { name: "reservas_disponibilidade", path: `/api/reservas/disponibilidade?restaurante_slug=${slug}` },
  ];

  if (process.env.MESA_ID && process.env.MESA_SESSION) {
    const mesaId = encodeURIComponent(process.env.MESA_ID);
    const sessao = encodeURIComponent(process.env.MESA_SESSION);
    requests.push(
      { name: "mesa_publica", path: `/api/mesas/${mesaId}?restaurante_slug=${slug}&sessao=${sessao}` },
      { name: "pedidos_publicos", path: `/api/pedidos?mesa_id=${mesaId}&restaurante_slug=${slug}&sessao=${sessao}` },
    );
  }

  const authenticated = [
    ["GARCOM_TOKEN", [
      ["garcom_mesas", "/api/mesas"],
      ["garcom_pedidos", "/api/pedidos"],
      ["garcom_chamadas", "/api/chamadas"],
      ["garcom_reservas", "/api/reservas"],
    ]],
    ["COZINHA_TOKEN", [
      ["cozinha_pendentes", "/api/pedidos?status=pendente"],
      ["cozinha_preparo", "/api/pedidos?status=preparo"],
      ["cozinha_pronto", "/api/pedidos?status=pronto"],
    ]],
    ["ADMIN_TOKEN", [
      ["admin_restaurante", "/api/restaurante"],
      ["admin_usuarios", "/api/usuarios"],
      ["admin_importacoes", "/api/importacoes"],
    ]],
    ["FINANCEIRO_TOKEN", [
      ["financeiro_hoje", "/api/financeiro/hoje"],
      ["financeiro_relatorio", "/api/relatorio"],
      ["financeiro_historico", "/api/historico"],
    ]],
  ];

  for (const [envKey, routes] of authenticated) {
    const token = process.env[envKey];
    if (!token) continue;
    for (const [name, path] of routes) {
      requests.push({ name, path, token });
    }
  }

  return requests;
}

function recordMetric(metrics, metric) {
  metrics.total += 1;
  metrics.latencies.push(metric.ms);
  metrics.byEndpoint[metric.name] ||= {
    total: 0,
    errors: 0,
    statusCodes: {},
    latencies: [],
  };

  const endpoint = metrics.byEndpoint[metric.name];
  endpoint.total += 1;
  endpoint.latencies.push(metric.ms);
  endpoint.statusCodes[metric.status] = (endpoint.statusCodes[metric.status] || 0) + 1;

  if (!metric.ok) {
    metrics.errors += 1;
    endpoint.errors += 1;
  }
  if (metric.status >= 500) metrics.status5xx += 1;
  if (metric.status === 429) metrics.status429 += 1;
}

async function request(baseUrl, item) {
  const started = performance.now();
  const headers = { accept: "application/json" };
  if (item.token) headers.Authorization = `Bearer ${item.token}`;

  try {
    const response = await fetch(`${baseUrl}${item.path}`, { headers });
    await response.arrayBuffer();
    const ms = performance.now() - started;
    return {
      name: item.name,
      status: response.status,
      ok: response.status >= 200 && response.status < 500,
      ms,
    };
  } catch (error) {
    return {
      name: item.name,
      status: 0,
      ok: false,
      ms: performance.now() - started,
      error: error.message,
    };
  }
}

async function worker(id, options, requests, metrics) {
  const deadline = Date.now() + options.durationSeconds * 1000;
  let index = id % requests.length;

  while (Date.now() < deadline) {
    const item = requests[index % requests.length];
    const metric = await request(options.baseUrl, item);
    recordMetric(metrics, metric);
    index += 1;
  }
}

function summarize(metrics, options, startedAt, finishedAt) {
  const durationSeconds = (finishedAt - startedAt) / 1000;
  const endpoints = {};

  for (const [name, item] of Object.entries(metrics.byEndpoint)) {
    endpoints[name] = {
      total: item.total,
      errors: item.errors,
      avg_ms: Number((item.latencies.reduce((sum, value) => sum + value, 0) / item.latencies.length).toFixed(2)),
      p95_ms: Number(percentile(item.latencies, 95).toFixed(2)),
      p99_ms: Number(percentile(item.latencies, 99).toFixed(2)),
      status_codes: item.statusCodes,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    profile: options.profile,
    base_url: options.baseUrl,
    restaurante_slug: options.slug,
    vus: options.vus,
    duration_seconds: Number(durationSeconds.toFixed(2)),
    total_requests: metrics.total,
    requests_per_second: Number((metrics.total / durationSeconds).toFixed(2)),
    error_rate: metrics.total ? Number((metrics.errors / metrics.total).toFixed(4)) : 0,
    errors: metrics.errors,
    status_5xx: metrics.status5xx,
    status_429: metrics.status429,
    avg_ms: Number((metrics.latencies.reduce((sum, value) => sum + value, 0) / metrics.latencies.length).toFixed(2)),
    p95_ms: Number(percentile(metrics.latencies, 95).toFixed(2)),
    p99_ms: Number(percentile(metrics.latencies, 99).toFixed(2)),
    endpoints,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  guardProductionLoad(options.baseUrl);
  const requests = buildRequests(options);
  const metrics = {
    total: 0,
    errors: 0,
    status5xx: 0,
    status429: 0,
    latencies: [],
    byEndpoint: {},
  };

  const startedAt = Date.now();
  await Promise.all(
    Array.from({ length: options.vus }, (_, index) => worker(index, options, requests, metrics)),
  );
  const summary = summarize(metrics, options, startedAt, Date.now());
  console.log(JSON.stringify(summary, null, 2));

  if (summary.error_rate >= 0.02 || summary.p95_ms >= 1200 || summary.p99_ms >= 2500) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: "load_test_failed",
    error: error.message,
  }));
  process.exitCode = 1;
});
