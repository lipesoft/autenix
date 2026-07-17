const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  ReservasValidationError,
  normalizarCriacaoReserva,
  normalizarFiltrosReservas,
  normalizarMesaId,
  normalizarStatusReserva,
} = require("../lib/reservas");

test("normaliza reserva publica valida", () => {
  const reserva = normalizarCriacaoReserva({
    nome_cliente: "  Maria  Souza ",
    telefone: " (11) 99999-0000 ",
    email: "MARIA@EXEMPLO.COM",
    data_reserva: "2026-07-20",
    horario: "19:30:00",
    quantidade_pessoas: "4",
    observacao: " mesa perto da janela ",
  });

  assert.equal(reserva.nome_cliente, "Maria Souza");
  assert.equal(reserva.email, "maria@exemplo.com");
  assert.equal(reserva.horario, "19:30");
  assert.equal(reserva.quantidade_pessoas, 4);
  assert.equal(reserva.origem, "publica");
});

test("marca reserva criada pelo admin com mesa opcional", () => {
  const reserva = normalizarCriacaoReserva(
    {
      nome_cliente: "Joao",
      telefone: "11999990000",
      data_reserva: "2026-08-01",
      horario: "20:00",
      mesa_id: "12",
    },
    { origem: "admin" },
  );

  assert.equal(reserva.mesa_id, 12);
  assert.equal(reserva.origem, "admin");
});

test("rejeita dados invalidos de reserva", () => {
  assert.throws(
    () =>
      normalizarCriacaoReserva({
        nome_cliente: "A",
        telefone: "123",
        data_reserva: "20/07/2026",
        horario: "28:00",
      }),
    ReservasValidationError,
  );
});

test("normaliza status e filtros de reservas", () => {
  assert.equal(normalizarStatusReserva(" Confirmada "), "confirmada");
  assert.deepEqual(normalizarFiltrosReservas({ status: "pendente", data: "2026-07-20" }), {
    status: "pendente",
    data: "2026-07-20",
  });
});

test("normaliza mesa opcional para atualizacao de reserva", () => {
  assert.equal(normalizarMesaId(""), null);
  assert.equal(normalizarMesaId("7"), 7);
  assert.throws(() => normalizarMesaId("mesa-7"), ReservasValidationError);
});
