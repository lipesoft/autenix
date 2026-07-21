import { expect, test } from "@playwright/test";
import {
  API_URL,
  RESTAURANTE_SLUG,
  authHeaders,
  expectOk,
  futureDate,
  loginRestaurante,
  requireRestaurantCredentials,
  requireWriteEnabled,
} from "./helpers/api.js";

test("reservas: criacao publica, fila, chamada, mesa, acomodacao e acompanhamento", async ({ request }) => {
  requireWriteEnabled();
  const credentials = requireRestaurantCredentials();
  const admin = await loginRestaurante(request, credentials);
  const headers = authHeaders(admin.token);
  const stamp = Date.now();
  const dataReserva = futureDate(2);

  const disponibilidade = await expectOk(await request.get(
    `${API_URL}/api/reservas/disponibilidade?restaurante_slug=${encodeURIComponent(RESTAURANTE_SLUG)}&data_reserva=${dataReserva}`,
  ));
  const slot = (disponibilidade.horarios || []).find((item) => item.disponivel !== false);
  test.skip(!slot?.horario, "Nenhum horario disponivel para teste de reserva.");

  const mesa = await expectOk(await request.post(`${API_URL}/api/mesas`, {
    headers,
    data: { numero: `E2E-R-${stamp}` },
  }));

  const criada = await expectOk(await request.post(`${API_URL}/api/reservas`, {
    data: {
      restaurante_slug: RESTAURANTE_SLUG,
      nome_cliente: `Cliente Reserva ${stamp}`,
      telefone: "11999999999",
      email: `reserva-${stamp}@example.com`,
      data_reserva: dataReserva,
      horario: slot.horario,
      quantidade_pessoas: 2,
      tipo: "reserva",
      observacao: "Reserva criada pelo E2E",
    },
  }));
  expect(criada.reserva.codigo_acompanhamento).toBeTruthy();

  await expectOk(await request.get(
    `${API_URL}/api/reservas/acompanhar/${criada.reserva.codigo_acompanhamento}?restaurante_slug=${encodeURIComponent(RESTAURANTE_SLUG)}`,
  ));

  for (const status of ["confirmada", "fila", "chamada", "fila"]) {
    const atualizada = await expectOk(await request.patch(
      `${API_URL}/api/reservas/${criada.reserva.id}/status`,
      { headers, data: { status } },
    ));
    expect(atualizada.reserva.status).toBe(status);
  }

  const concluida = await expectOk(await request.patch(
    `${API_URL}/api/reservas/${criada.reserva.id}/status`,
    { headers, data: { status: "concluida", mesa_id: mesa.id } },
  ));
  expect(concluida.reserva.status).toBe("concluida");
  expect(Number(concluida.reserva.mesa_id)).toBe(Number(mesa.id));
});
