const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  ReservaNotificacaoValidationError,
  mensagemReserva,
  montarNotificacoesReserva,
  normalizarNotificacaoReserva,
  resumoNotificacoesReserva,
} = require("../lib/reserva-notificacoes");

const reserva = {
  id: 8,
  restaurante_id: 2,
  nome_cliente: "Maria Souza",
  telefone: "(11) 99999-0000",
  email: "maria@example.com",
  data_reserva: "2026-07-21",
  horario: "20:00",
  quantidade_pessoas: 4,
  status: "confirmada",
  tipo: "reserva",
  codigo_acompanhamento: "abc123",
};

const restaurante = {
  id: 2,
  nome: "Autenix Demo",
  slug: "autenix-demo",
};

test("monta notificacoes automaticas para whatsapp e email", () => {
  const notificacoes = montarNotificacoesReserva({
    reserva,
    restaurante,
    evento: "confirmada",
    acompanhamentoUrl: "https://autenix.vercel.app/r/demo/reservas/acompanhar/abc123",
  });

  assert.equal(notificacoes.length, 2);
  assert.equal(notificacoes[0].canal, "whatsapp");
  assert.equal(notificacoes[1].canal, "email");
  assert.equal(notificacoes[1].assunto, "Reserva confirmada - Autenix Demo");
  assert.match(notificacoes[0].mensagem, /Sua reserva no Autenix Demo foi confirmada/);
  assert.equal(notificacoes[0].payload.reserva_id, 8);
});

test("monta mensagem com posicao da fila quando existir", () => {
  const mensagem = mensagemReserva({
    reserva: { ...reserva, status: "fila", posicao_fila: 3 },
    restaurante,
    evento: "fila",
    acompanhamentoUrl: "",
  });

  assert.match(mensagem, /foi na fila de espera/);
  assert.match(mensagem, /Posicao na fila: 3/);
});

test("normaliza notificacao persistida", () => {
  const normalizada = normalizarNotificacaoReserva({
    reserva_id: "8",
    restaurante_id: "2",
    canal: " Email ",
    evento: "confirmada",
    destinatario: "maria@example.com",
    assunto: "Confirmacao",
    mensagem: "Reserva confirmada com sucesso.",
    payload: { reserva_id: 8 },
    status: "sem_provedor",
  });

  assert.equal(normalizada.reserva_id, 8);
  assert.equal(normalizada.canal, "email");
  assert.equal(normalizada.status, "sem_provedor");
});

test("resume status das notificacoes", () => {
  const resumo = resumoNotificacoesReserva([
    { status: "enviado" },
    { status: "sem_provedor" },
    { status: "sem_provedor" },
  ]);

  assert.equal(resumo.total, 3);
  assert.equal(resumo.enviado, 1);
  assert.equal(resumo.sem_provedor, 2);
});

test("rejeita dados invalidos de notificacao", () => {
  assert.throws(
    () => montarNotificacoesReserva({ reserva: {}, restaurante, evento: "confirmada" }),
    ReservaNotificacaoValidationError,
  );
  assert.throws(
    () =>
      normalizarNotificacaoReserva({
        reserva_id: 1,
        restaurante_id: 2,
        canal: "sms",
        evento: "confirmada",
        destinatario: "11999990000",
        mensagem: "Reserva confirmada.",
      }),
    ReservaNotificacaoValidationError,
  );
});
