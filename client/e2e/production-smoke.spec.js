import { expect, test } from "@playwright/test";
import { API_URL, RESTAURANTE_SLUG } from "./helpers/api.js";

async function expectJson(response, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}

test("smoke tecnico: health, readiness e rota protegida", async ({ request }) => {
  const health = await expectJson(await request.get(`${API_URL}/api/health`));
  expect(health.status).toBe("ok");

  const readiness = await expectJson(await request.get(`${API_URL}/api/health/readiness`));
  expect(["ready", "degraded"]).toContain(readiness.status);
  expect(readiness.components?.database?.status).toBe("ok");

  const diagnosticoSemToken = await request.get(`${API_URL}/api/platform/diagnostico`);
  expect(diagnosticoSemToken.status()).toBe(401);
});

test("smoke visual: landing publica carrega", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Autenix/i);
  await expect(page.locator("body")).toContainText(/Autenix/i);
});

test("smoke publico: cardapio do restaurante configurado carrega", async ({ request }) => {
  const restauranteResponse = await request.get(
    `${API_URL}/api/restaurantes/${encodeURIComponent(RESTAURANTE_SLUG)}/publico`,
  );
  test.skip(
    restauranteResponse.status() === 404,
    `Restaurante publico "${RESTAURANTE_SLUG}" nao existe neste ambiente.`,
  );

  const restaurante = await expectJson(restauranteResponse);
  expect(restaurante.slug).toBe(RESTAURANTE_SLUG);
  expect(restaurante.nome || restaurante.nome_exibicao).toBeTruthy();

  const cardapio = await expectJson(await request.get(
    `${API_URL}/api/cardapio?restaurante_slug=${encodeURIComponent(RESTAURANTE_SLUG)}`,
  ));
  expect(Array.isArray(cardapio.categorias)).toBeTruthy();
  expect(Array.isArray(cardapio.produtos)).toBeTruthy();
});
