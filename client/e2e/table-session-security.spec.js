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

test("seguranca da sessao de mesa bloqueia token invalido e sessao encerrada", async ({ request }) => {
  requireWriteEnabled();
  const credentials = requireRestaurantCredentials();
  const admin = await loginRestaurante(request, credentials);
  const headers = authHeaders(admin.token);
  const stamp = Date.now();

  const categoria = await expectOk(await request.post(`${API_URL}/api/categorias`, {
    headers,
    data: { nome: `E2E Sessao ${stamp}` },
  }));
  const produto = await expectOk(await request.post(`${API_URL}/api/produtos`, {
    headers,
    data: {
      categoria_id: categoria.id,
      nome: `E2E Sessao Produto ${stamp}`,
      descricao: "Produto para teste de sessao",
      preco: 12.5,
    },
  }));
  const mesa = await expectOk(await request.post(`${API_URL}/api/mesas`, {
    headers,
    data: { numero: `E2E-S-${stamp}` },
  }));

  const atendimento = await expectOk(await request.post(
    `${API_URL}/api/mesas/${mesa.id}/atendimento/iniciar`,
    { headers },
  ));
  const sessao = extractMesaSession(atendimento.url);

  const tokenInvalido = await request.post(`${API_URL}/api/pedidos`, {
    data: {
      restaurante_slug: RESTAURANTE_SLUG,
      mesa_id: mesa.id,
      sessao: "token_invalido_123",
      nome_cliente: "Cliente E2E",
      itens: [{ produto_id: produto.id, quantidade: 1 }],
    },
  });
  expect(tokenInvalido.status()).toBe(403);

  const pedido = await expectOk(await request.post(`${API_URL}/api/pedidos`, {
    data: {
      restaurante_slug: RESTAURANTE_SLUG,
      mesa_id: mesa.id,
      sessao,
      nome_cliente: "Cliente E2E",
      itens: [{ produto_id: produto.id, quantidade: 1 }],
    },
  }));

  const pedidos = await expectOk(await request.get(`${API_URL}/api/pedidos`, { headers }));
  const pedidoCompleto = pedidos.find((item) => item.id === pedido.pedido_id);
  expect(pedidoCompleto).toBeTruthy();

  await expectOk(await request.patch(`${API_URL}/api/pedidos/${pedidoCompleto.id}/status`, {
    headers,
    data: { status: "entregue", garcom_id: admin.id, garcom_nome: admin.nome },
  }));
  await expectOk(await request.post(`${API_URL}/api/mesas/${mesa.id}/fechar`, {
    headers,
    data: { forma_pagamento: "dinheiro" },
  }));

  const sessaoEncerrada = await request.post(`${API_URL}/api/pedidos`, {
    data: {
      restaurante_slug: RESTAURANTE_SLUG,
      mesa_id: mesa.id,
      sessao,
      nome_cliente: "Cliente E2E",
      itens: [{ produto_id: produto.id, quantidade: 1 }],
    },
  });
  expect(sessaoEncerrada.status()).toBe(403);
});
