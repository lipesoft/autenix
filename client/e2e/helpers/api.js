import { expect, test } from "@playwright/test";

export const API_URL = (process.env.E2E_API_URL || "http://localhost:3001").replace(/\/$/, "");
export const RESTAURANTE_SLUG = process.env.E2E_RESTAURANTE_SLUG || "autenix";

export function requireWriteEnabled() {
  test.skip(
    process.env.E2E_ALLOW_WRITE !== "true",
    "Defina E2E_ALLOW_WRITE=true em ambiente controlado para executar testes E2E com escrita.",
  );
}

export function requireRestaurantCredentials(prefix = "E2E") {
  const login = process.env[`${prefix}_ADMIN_LOGIN`];
  const senha = process.env[`${prefix}_ADMIN_PASSWORD`];
  test.skip(!login || !senha, `Configure ${prefix}_ADMIN_LOGIN e ${prefix}_ADMIN_PASSWORD.`);
  return { login, senha };
}

export async function loginRestaurante(request, {
  slug = RESTAURANTE_SLUG,
  login,
  senha,
} = {}) {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: {
      restaurante_slug: slug,
      login,
      senha,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json();
  expect(body.token).toBeTruthy();
  return body;
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function expectOk(response) {
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json().catch(() => ({}));
}

export function futureDate(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function extractMesaSession(url) {
  const parsed = new URL(url);
  const sessao = parsed.searchParams.get("sessao");
  expect(sessao).toBeTruthy();
  return sessao;
}
