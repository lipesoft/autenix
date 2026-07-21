import http from "k6/http";
import { check, sleep } from "k6";

export function buildOptions({ vus, duration }) {
  return {
    vus,
    duration,
    thresholds: {
      http_req_failed: ["rate<0.02"],
      http_req_duration: ["p(95)<1200", "p(99)<2500"],
    },
  };
}

function requiredEnv(name, fallback = "") {
  return String(__ENV[name] || fallback).replace(/\/$/, "");
}

function isProductionUrl(baseUrl) {
  return /(^https:\/\/autenix\.vercel\.app|^https:\/\/autenix-api\.vercel\.app|\.vercel\.app)/i
    .test(baseUrl);
}

export function guardProductionLoad() {
  const baseUrl = requiredEnv("BASE_URL");
  if (!baseUrl) {
    throw new Error("Configure BASE_URL para executar o teste de carga.");
  }
  if (isProductionUrl(baseUrl) && __ENV.ALLOW_PRODUCTION_LOAD_TEST !== "true") {
    throw new Error(
      "Teste de carga contra producao bloqueado. Defina ALLOW_PRODUCTION_LOAD_TEST=true somente com janela autorizada.",
    );
  }
  return baseUrl;
}

function getJson(baseUrl, path, options = {}) {
  const response = http.get(`${baseUrl}${path}`, options);
  check(response, {
    [`GET ${path} status seguro`]: (r) => [200, 204, 304].includes(r.status),
    [`GET ${path} sem 5xx`]: (r) => r.status < 500,
  });
  return response;
}

function headers(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export function runPollingIteration() {
  const baseUrl = guardProductionLoad();
  const slug = encodeURIComponent(__ENV.RESTAURANTE_SLUG || "autenix");

  getJson(baseUrl, `/api/health`);
  getJson(baseUrl, `/api/cardapio?restaurante_slug=${slug}`);
  getJson(baseUrl, `/api/reservas/disponibilidade?restaurante_slug=${slug}`);

  if (__ENV.MESA_ID && __ENV.MESA_SESSION) {
    const mesaId = encodeURIComponent(__ENV.MESA_ID);
    const sessao = encodeURIComponent(__ENV.MESA_SESSION);
    getJson(baseUrl, `/api/mesas/${mesaId}?restaurante_slug=${slug}&sessao=${sessao}`);
    getJson(baseUrl, `/api/pedidos?mesa_id=${mesaId}&restaurante_slug=${slug}&sessao=${sessao}`);
  }

  if (__ENV.GARCOM_TOKEN) {
    const opts = headers(__ENV.GARCOM_TOKEN);
    getJson(baseUrl, "/api/mesas", opts);
    getJson(baseUrl, "/api/pedidos", opts);
    getJson(baseUrl, "/api/chamadas", opts);
    getJson(baseUrl, "/api/reservas", opts);
  }

  if (__ENV.COZINHA_TOKEN) {
    const opts = headers(__ENV.COZINHA_TOKEN);
    getJson(baseUrl, "/api/pedidos?status=pendente", opts);
    getJson(baseUrl, "/api/pedidos?status=preparo", opts);
    getJson(baseUrl, "/api/pedidos?status=pronto", opts);
  }

  if (__ENV.ADMIN_TOKEN) {
    const opts = headers(__ENV.ADMIN_TOKEN);
    getJson(baseUrl, "/api/restaurante", opts);
    getJson(baseUrl, "/api/usuarios", opts);
    getJson(baseUrl, "/api/importacoes", opts);
  }

  if (__ENV.FINANCEIRO_TOKEN) {
    const opts = headers(__ENV.FINANCEIRO_TOKEN);
    getJson(baseUrl, "/api/financeiro/hoje", opts);
    getJson(baseUrl, "/api/relatorio", opts);
    getJson(baseUrl, "/api/historico", opts);
  }

  sleep(Number(__ENV.POLLING_SLEEP_SECONDS || 1));
}
