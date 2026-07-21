#!/usr/bin/env node
const { performance } = require("perf_hooks");

const DEFAULT_API_URL = "https://autenix-api.vercel.app";
const DEFAULT_FRONTEND_URL = "https://autenix.vercel.app";

function parseArgs(argv) {
  const options = {
    apiUrl: process.env.HEALTH_API_URL || DEFAULT_API_URL,
    frontendUrl: process.env.HEALTH_FRONTEND_URL || DEFAULT_FRONTEND_URL,
    timeoutMs: Number(process.env.HEALTH_TIMEOUT_MS || 8000),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--api-url") {
      options.apiUrl = next;
      index += 1;
    } else if (arg.startsWith("--api-url=")) {
      options.apiUrl = arg.split("=")[1];
    } else if (arg === "--frontend-url") {
      options.frontendUrl = next;
      index += 1;
    } else if (arg.startsWith("--frontend-url=")) {
      options.frontendUrl = arg.split("=")[1];
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Number(next);
      index += 1;
    } else if (arg.startsWith("--timeout-ms=")) {
      options.timeoutMs = Number(arg.split("=")[1]);
    } else if (arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Argumento invalido: ${arg}`);
    }
  }

  options.apiUrl = String(options.apiUrl || "").replace(/\/$/, "");
  options.frontendUrl = String(options.frontendUrl || "").replace(/\/$/, "");

  if (!options.apiUrl) throw new Error("api-url obrigatoria");
  if (!options.frontendUrl) throw new Error("frontend-url obrigatoria");
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("timeout-ms invalido");
  }

  return options;
}

function usage() {
  return [
    "Uso: node scripts/health-monitor.js [--api-url URL] [--frontend-url URL] [--timeout-ms MS]",
    "",
    "Emite JSON com status sintetico para uso em cron, monitor externo ou CI.",
    "Exit code 0 indica saudavel; exit code 1 indica degradado/indisponivel.",
  ].join("\n");
}

async function fetchWithTiming(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json,text/html" },
      signal: controller.signal,
    });
    const text = await response.text();
    const ms = Math.round(performance.now() - started);
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}

    return {
      url,
      status: response.status,
      ok: response.ok,
      ms,
      readiness_status: json?.status || null,
      content_length: text.length,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      ms: Math.round(performance.now() - started),
      error_code: error.name === "AbortError" ? "timeout" : "request_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const checks = await Promise.all([
    fetchWithTiming(`${options.apiUrl}/api/health`, options),
    fetchWithTiming(`${options.apiUrl}/api/health/readiness`, options),
    fetchWithTiming(options.frontendUrl, options),
  ]);

  const status = checks.every((check) => check.ok && check.ms <= options.timeoutMs)
    ? "healthy"
    : "degraded";

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: "health_monitor_result",
    status,
    checks,
  }, null, 2));

  if (status !== "healthy") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: "health_monitor_failed",
    error: error.message,
  }));
  process.exitCode = 1;
});
