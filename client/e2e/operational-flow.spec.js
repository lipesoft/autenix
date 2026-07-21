import { expect, test } from "@playwright/test";
import {
  API_URL,
  RESTAURANTE_SLUG,
  authHeaders,
  expectOk,
  extractMesaSession,
  loginRestaurante,
  requireRestaurantCredentials,
  requireWriteEnabled,
} from "./helpers/api.js";

test("fluxo operacional principal: pedido, cozinha, entrega, fechamento e relatorio", async ({ request }) => {
  requireWriteEnabled();
  const credentials = requireRestaurantCredentials();
  const admin = await loginRestaurante(request, credentials);
  const headers = authHeaders(admin.token);
  const stamp = Date.now();

  const categoria = await expectOk(await request.post(`${API_URL}/api/categorias`, {
    headers,
    data: { nome: `E2E Categoria ${stamp}` },
  }));

  const produto = await expectOk(await request.post(`${API_URL}/api/produtos`, {
    headers,
    data: {
      categoria_id: categoria.id,
      nome: `E2E Produto ${stamp}`,
      descricao: "Produto criado pelo teste operacional",
      preco: 19.9,
      imagem: "",
    },
  }));

  const mesa = await expectOk(await request.post(`${API_URL}/api/mesas`, {
    headers,
    data: { numero: `E2E-${stamp}` },
  }));

  const atendimento = await expectOk(await request.post(
    `${API_URL}/api/mesas/${mesa.id}/atendimento/iniciar`,
    { headers },
  ));
  const sessao = extractMesaSession(atendimento.url);

  const pedidoCriado = await expectOk(await request.post(`${API_URL}/api/pedidos`, {
    data: {
      restaurante_slug: RESTAURANTE_SLUG,
      mesa_id: mesa.id,
      sessao,
      nome_cliente: "Cliente E2E",
      itens: [{ produto_id: produto.id, quantidade: 1, observacao: "sem teste visual" }],
    },
  }));

  const pedidosPendentes = await expectOk(await request.get(
    `${API_URL}/api/pedidos?status=pendente`,
    { headers },
  ));
  const pedido = pedidosPendentes.find((item) => item.id === pedidoCriado.pedido_id);
  expect(pedido).toBeTruthy();
  expect(pedido.itens.length).toBeGreaterThan(0);

  const itemId = pedido.itens[0].id;
  await expectOk(await request.patch(`${API_URL}/api/itens/${itemId}/status`, {
    headers,
    data: { status: "preparo" },
  }));
  await expectOk(await request.patch(`${API_URL}/api/itens/${itemId}/status`, {
    headers,
    data: { status: "pronto" },
  }));
  await expectOk(await request.patch(`${API_URL}/api/pedidos/${pedido.id}/status`, {
    headers,
    data: {
      status: "entregue",
      garcom_id: admin.id,
      garcom_nome: admin.nome,
    },
  }));

  await expectOk(await request.post(`${API_URL}/api/mesas/${mesa.id}/fechar`, {
    headers,
    data: { forma_pagamento: "pix", obs_pagamento: "Fechado pelo E2E" },
  }));

  await expectOk(await request.get(`${API_URL}/api/financeiro/hoje`, { headers }));
  await expectOk(await request.get(`${API_URL}/api/relatorio`, { headers }));
  await expectOk(await request.get(`${API_URL}/api/historico`, { headers }));
});
