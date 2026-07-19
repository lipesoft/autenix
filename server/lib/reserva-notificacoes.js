const CANAIS_NOTIFICACAO_RESERVA = new Set(["whatsapp", "email"]);
const EVENTOS_NOTIFICACAO_RESERVA = new Set([
  "criada",
  "confirmada",
  "fila",
  "chamada",
  "cancelada",
  "concluida",
]);
const STATUS_NOTIFICACAO_RESERVA = new Set([
  "pendente",
  "enviado",
  "erro",
  "sem_provedor",
]);

class ReservaNotificacaoValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReservaNotificacaoValidationError";
    this.statusCode = 400;
  }
}

function texto(valor) {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

function textoObrigatorio(valor, campo, min, max) {
  const normalizado = texto(valor);
  if (normalizado.length < min || normalizado.length > max) {
    throw new ReservaNotificacaoValidationError(
      `${campo} deve ter entre ${min} e ${max} caracteres`,
    );
  }
  return normalizado;
}

function textoOpcional(valor, campo, max) {
  const normalizado = texto(valor);
  if (!normalizado) return null;
  if (normalizado.length > max) {
    throw new ReservaNotificacaoValidationError(`${campo} deve ter no maximo ${max} caracteres`);
  }
  return normalizado;
}

function normalizarCanalReserva(canal) {
  const normalizado = texto(canal).toLowerCase();
  if (!CANAIS_NOTIFICACAO_RESERVA.has(normalizado)) {
    throw new ReservaNotificacaoValidationError("Canal de notificacao invalido");
  }
  return normalizado;
}

function normalizarEventoReservaNotificacao(evento) {
  const normalizado = texto(evento).toLowerCase();
  if (!EVENTOS_NOTIFICACAO_RESERVA.has(normalizado)) {
    throw new ReservaNotificacaoValidationError("Evento de notificacao invalido");
  }
  return normalizado;
}

function normalizarStatusNotificacaoReserva(status) {
  const normalizado = texto(status || "pendente").toLowerCase();
  if (!STATUS_NOTIFICACAO_RESERVA.has(normalizado)) {
    throw new ReservaNotificacaoValidationError("Status de notificacao invalido");
  }
  return normalizado;
}

function nomeRestaurantePublico(restaurante = {}) {
  return texto(restaurante.nome_exibicao || restaurante.nome || "Restaurante");
}

function textoStatusReserva(evento) {
  return {
    criada: "recebida",
    confirmada: "confirmada",
    fila: "na fila de espera",
    chamada: "chamada pelo restaurante",
    cancelada: "cancelada",
    concluida: "concluida",
  }[evento] || "atualizada";
}

function assuntoReserva(evento, restaurante) {
  const nome = nomeRestaurantePublico(restaurante);
  return `Reserva ${textoStatusReserva(evento)} - ${nome}`;
}

function mensagemReserva({ reserva, restaurante, evento, acompanhamentoUrl }) {
  const nomeRestaurante = nomeRestaurantePublico(restaurante);
  const partes = [
    `Ola, ${reserva.nome_cliente}.`,
    `Sua reserva no ${nomeRestaurante} foi ${textoStatusReserva(evento)}.`,
    `Data: ${reserva.data_reserva} as ${reserva.horario}.`,
    `Pessoas: ${reserva.quantidade_pessoas}.`,
  ];

  if (reserva.status === "fila" && reserva.posicao_fila) {
    partes.push(`Posicao na fila: ${reserva.posicao_fila}.`);
  }
  if (reserva.mesa_numero) {
    partes.push(`Mesa: ${reserva.mesa_numero}.`);
  }
  if (acompanhamentoUrl) {
    partes.push(`Acompanhe aqui: ${acompanhamentoUrl}`);
  }

  return partes.join("\n");
}

function payloadPublicoReserva({ reserva, restaurante, evento, acompanhamentoUrl }) {
  return {
    reserva_id: reserva.id,
    restaurante_id: reserva.restaurante_id,
    restaurante_slug: restaurante.slug,
    evento,
    status: reserva.status,
    tipo: reserva.tipo,
    codigo_acompanhamento: reserva.codigo_acompanhamento,
    acompanhamento_url: acompanhamentoUrl,
  };
}

function montarNotificacoesReserva({
  reserva,
  restaurante,
  evento,
  acompanhamentoUrl,
}) {
  const eventoNormalizado = normalizarEventoReservaNotificacao(evento);
  if (!reserva?.id || !reserva?.restaurante_id) {
    throw new ReservaNotificacaoValidationError("Reserva invalida para notificacao");
  }

  const mensagem = mensagemReserva({
    reserva,
    restaurante,
    evento: eventoNormalizado,
    acompanhamentoUrl,
  });
  const payload = payloadPublicoReserva({
    reserva,
    restaurante,
    evento: eventoNormalizado,
    acompanhamentoUrl,
  });
  const notificacoes = [];

  if (reserva.telefone) {
    notificacoes.push({
      canal: "whatsapp",
      evento: eventoNormalizado,
      destinatario: textoObrigatorio(reserva.telefone, "Telefone", 8, 30),
      assunto: null,
      mensagem,
      payload,
    });
  }

  if (reserva.email) {
    notificacoes.push({
      canal: "email",
      evento: eventoNormalizado,
      destinatario: textoObrigatorio(reserva.email, "Email", 5, 160),
      assunto: assuntoReserva(eventoNormalizado, restaurante),
      mensagem,
      payload,
    });
  }

  return notificacoes;
}

function normalizarNotificacaoReserva(payload = {}) {
  const reservaId = Number(payload.reserva_id);
  const restauranteId = Number(payload.restaurante_id);
  if (!Number.isInteger(reservaId) || reservaId <= 0) {
    throw new ReservaNotificacaoValidationError("Reserva invalida");
  }
  if (!Number.isInteger(restauranteId) || restauranteId <= 0) {
    throw new ReservaNotificacaoValidationError("Restaurante invalido");
  }

  const dados = payload.payload || {};
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new ReservaNotificacaoValidationError("Payload da notificacao deve ser um objeto");
  }

  return {
    reserva_id: reservaId,
    restaurante_id: restauranteId,
    canal: normalizarCanalReserva(payload.canal),
    evento: normalizarEventoReservaNotificacao(payload.evento),
    destinatario: textoObrigatorio(payload.destinatario, "Destinatario", 3, 180),
    assunto: textoOpcional(payload.assunto, "Assunto", 160),
    mensagem: textoObrigatorio(payload.mensagem, "Mensagem", 10, 2000),
    payload: dados,
    provider: textoOpcional(payload.provider, "Provider", 80),
    provider_message_id: textoOpcional(payload.provider_message_id, "Mensagem do provider", 180),
    status: normalizarStatusNotificacaoReserva(payload.status),
    erro: textoOpcional(payload.erro, "Erro da notificacao", 500),
  };
}

function resumoNotificacoesReserva(notificacoes = []) {
  return notificacoes.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {
    total: 0,
    pendente: 0,
    enviado: 0,
    erro: 0,
    sem_provedor: 0,
  });
}

module.exports = {
  CANAIS_NOTIFICACAO_RESERVA,
  EVENTOS_NOTIFICACAO_RESERVA,
  ReservaNotificacaoValidationError,
  STATUS_NOTIFICACAO_RESERVA,
  mensagemReserva,
  montarNotificacoesReserva,
  normalizarCanalReserva,
  normalizarEventoReservaNotificacao,
  normalizarNotificacaoReserva,
  normalizarStatusNotificacaoReserva,
  resumoNotificacoesReserva,
};
