import { expect, test } from "@playwright/test";
import {
  API_URL,
  authHeaders,
  expectOk,
  loginRestaurante,
  requireRestaurantCredentials,
  requireWriteEnabled,
} from "./helpers/api.js";

test("importacao: valida, executa, registra historico e faz rollback", async ({ request }) => {
  requireWriteEnabled();
  const credentials = requireRestaurantCredentials();
  const admin = await loginRestaurante(request, credentials);
  const headers = authHeaders(admin.token);
  const stamp = Date.now();
  const payload = {
    tipo: "categorias",
    rows: [{ nome: `E2E Importacao ${stamp}`, ordem: 999 }],
    atualizar_existentes: false,
    arquivo_nome: `e2e-${stamp}.csv`,
    formato: "csv",
  };

  const payloadDesconhecido = await request.post(`${API_URL}/api/importacoes/validar`, {
    headers,
    data: { ...payload, restaurante_id: 999 },
  });
  expect(payloadDesconhecido.status()).toBe(400);

  const invalida = await expectOk(await request.post(`${API_URL}/api/importacoes/validar`, {
    headers,
    data: { ...payload, rows: [{}] },
  }));
  expect(invalida.pode_executar).toBeFalsy();

  const analise = await expectOk(await request.post(`${API_URL}/api/importacoes/validar`, {
    headers,
    data: payload,
  }));
  expect(analise.pode_executar).toBeTruthy();

  const executada = await expectOk(await request.post(`${API_URL}/api/importacoes/executar`, {
    headers,
    data: payload,
  }));
  expect(executada.importacao.id).toBeTruthy();

  const historico = await expectOk(await request.get(`${API_URL}/api/importacoes`, { headers }));
  expect(historico.historico.some((item) => item.id === executada.importacao.id)).toBeTruthy();

  const rollback = await expectOk(await request.post(
    `${API_URL}/api/importacoes/${executada.importacao.id}/rollback`,
    { headers },
  ));
  expect(rollback.sucesso).toBeTruthy();
});
