const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  ReservaEventoValidationError,
  descricaoCompartilhamentoReserva,
  normalizarCanalCompartilhamentoReserva,
  normalizarEventoReserva,
  origemEventoPorUsuario,
} = require("../lib/reserva-eventos");

test("normaliza evento de criacao de reserva", () => {
  const evento = normalizarEventoReserva({
    tipo: " criada ",
    origem: " publica ",
    status_novo: "pendente",
    mesa_id_novo: "",
    detalhes: { tipo: "reserva" },
  });

  assert.equal(evento.tipo, "criada");
  assert.equal(evento.origem, "publica");
  assert.equal(evento.status_novo, "pendente");
  assert.equal(evento.mesa_id_novo, null);
  assert.equal(evento.descricao, "Reserva criada.");
});

test("normaliza mudanca de status e mesa", () => {
  const status = normalizarEventoReserva({
    tipo: "status_alterado",
    origem: "garcom",
    status_anterior: "fila",
    status_novo: "chamada",
  });
  const mesa = normalizarEventoReserva({
    tipo: "mesa_alterada",
    origem: "admin",
    mesa_id_anterior: "",
    mesa_id_novo: "9",
  });

  assert.equal(status.descricao, "Status alterado de fila para chamada.");
  assert.equal(mesa.mesa_id_anterior, null);
  assert.equal(mesa.mesa_id_novo, 9);
});

test("normaliza compartilhamento por canal permitido", () => {
  assert.equal(normalizarCanalCompartilhamentoReserva(" WhatsApp "), "whatsapp");
  assert.equal(
    descricaoCompartilhamentoReserva("email"),
    "Email de acompanhamento aberto.",
  );

  const evento = normalizarEventoReserva({
    tipo: "compartilhamento",
    origem: "admin",
    detalhes: { canal: "link" },
  });

  assert.equal(evento.descricao, "Link de acompanhamento copiado.");
  assert.equal(evento.detalhes.canal, "link");
});

test("normaliza evento de notificacao automatica", () => {
  const evento = normalizarEventoReserva({
    tipo: "notificacao_automatica",
    origem: "sistema",
    detalhes: { canais: ["whatsapp", "email"], resumo: { total: 2 } },
  });

  assert.equal(evento.tipo, "notificacao_automatica");
  assert.equal(
    evento.descricao,
    "Notificacao automatica registrada para whatsapp, email.",
  );
});

test("rejeita evento de reserva invalido", () => {
  assert.throws(
    () => normalizarEventoReserva({ tipo: "delete", origem: "publica" }),
    ReservaEventoValidationError,
  );
  assert.throws(
    () => normalizarEventoReserva({ tipo: "compartilhamento", canal: "sms" }),
    ReservaEventoValidationError,
  );
  assert.throws(
    () => normalizarEventoReserva({ tipo: "criada", detalhes: [] }),
    ReservaEventoValidationError,
  );
});

test("define origem do evento pelo role do usuario", () => {
  assert.equal(origemEventoPorUsuario({ role: "admin" }), "admin");
  assert.equal(origemEventoPorUsuario({ role: "garcom" }), "garcom");
  assert.equal(origemEventoPorUsuario({ role: "financeiro" }, "sistema"), "sistema");
});
