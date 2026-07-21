import { expect, test } from "@playwright/test";
import {
  API_URL,
  authHeaders,
  expectOk,
  loginRestaurante,
  requireRestaurantCredentials,
  requireWriteEnabled,
} from "./helpers/api.js";

test("isolamento multi-tenant nao vaza categorias nem mesas entre restaurantes", async ({ request }) => {
  requireWriteEnabled();
  const primaryCredentials = requireRestaurantCredentials("E2E");
  const secondaryCredentials = requireRestaurantCredentials("E2E_SECOND");
  const primarySlug = process.env.E2E_RESTAURANTE_SLUG || "autenix";
  const secondarySlug = process.env.E2E_SECOND_RESTAURANTE_SLUG;
  test.skip(!secondarySlug, "Configure E2E_SECOND_RESTAURANTE_SLUG.");

  const primary = await loginRestaurante(request, {
    slug: primarySlug,
    ...primaryCredentials,
  });
  const secondary = await loginRestaurante(request, {
    slug: secondarySlug,
    ...secondaryCredentials,
  });
  const primaryHeaders = authHeaders(primary.token);
  const secondaryHeaders = authHeaders(secondary.token);
  const stamp = Date.now();
  const categoriaNome = `E2E Isolamento ${stamp}`;
  const mesaNumero = `E2E-I-${stamp}`;

  await expectOk(await request.post(`${API_URL}/api/categorias`, {
    headers: primaryHeaders,
    data: { nome: categoriaNome },
  }));
  await expectOk(await request.post(`${API_URL}/api/mesas`, {
    headers: primaryHeaders,
    data: { numero: mesaNumero },
  }));

  const cardapioSecundario = await expectOk(await request.get(
    `${API_URL}/api/cardapio?restaurante_slug=${encodeURIComponent(secondarySlug)}`,
  ));
  expect(cardapioSecundario.categorias.map((categoria) => categoria.nome)).not.toContain(categoriaNome);

  const mesasSecundarias = await expectOk(await request.get(`${API_URL}/api/mesas`, {
    headers: secondaryHeaders,
  }));
  expect(mesasSecundarias.map((mesa) => mesa.numero)).not.toContain(mesaNumero);
});
