const TIPOS_EVENTO_RESERVA = [
  "criada",
  "status_alterado",
  "mesa_alterada",
  "compartilhamento",
  "notificacao_automatica",
];
const ORIGENS_EVENTO_RESERVA = ["publica", "admin", "garcom", "sistema"];
const CANAIS_COMPARTILHAMENTO_RESERVA = ["link", "whatsapp", "email"];

class ReservaEventoValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReservaEventoValidationError";
    this.statusCode = 400;
  }
}

function texto(valor) {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

function textoOpcional(valor, campo, max) {
  const normalizado = texto(valor);
  if (!normalizado) return null;
  if (normalizado.length > max) {
    throw new ReservaEventoValidationError(`${campo} deve ter no maximo ${max} caracteres`);
  }
  return normalizado;
}

function textoObrigatorio(valor, campo, min, max) {
  const normalizado = texto(valor);
  if (normalizado.length < min || normalizado.length > max) {
    throw new ReservaEventoValidationError(
      `${campo} deve ter entre ${min} e ${max} caracteres`,
    );
  }
  return normalizado;
}

function normalizarInteiroOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ReservaEventoValidationError(`${campo} invalido`);
  }
  return numero;
}

function normalizarOrigemEventoReserva(origem) {
  const valor = texto(origem || "sistema").toLowerCase();
  if (!ORIGENS_EVENTO_RESERVA.includes(valor)) {
    throw new ReservaEventoValidationError("Origem do evento de reserva invalida");
  }
  return valor;
}

function normalizarTipoEventoReserva(tipo) {
  const valor = texto(tipo).toLowerCase();
  if (!TIPOS_EVENTO_RESERVA.includes(valor)) {
    throw new ReservaEventoValidationError("Tipo de evento de reserva invalido");
  }
  return valor;
}

function normalizarCanalCompartilhamentoReserva(canal) {
  const valor = texto(canal).toLowerCase();
  if (!CANAIS_COMPARTILHAMENTO_RESERVA.includes(valor)) {
    throw new ReservaEventoValidationError("Canal de compartilhamento invalido");
  }
  return valor;
}

function descricaoCompartilhamentoReserva(canal) {
  const canalNormalizado = normalizarCanalCompartilhamentoReserva(canal);
  return {
    link: "Link de acompanhamento copiado.",
    whatsapp: "Mensagem de WhatsApp aberta.",
    email: "Email de acompanhamento aberto.",
  }[canalNormalizado];
}

function descricaoPadraoEventoReserva(evento) {
  if (evento.tipo === "criada") return "Reserva criada.";
  if (evento.tipo === "status_alterado") {
    return `Status alterado de ${evento.status_anterior || "sem status"} para ${evento.status_novo || "sem status"}.`;
  }
  if (evento.tipo === "mesa_alterada") {
    return `Mesa alterada de ${evento.mesa_id_anterior || "sem mesa"} para ${evento.mesa_id_novo || "sem mesa"}.`;
  }
  if (evento.tipo === "compartilhamento") {
    return descricaoCompartilhamentoReserva(evento.detalhes?.canal || evento.canal);
  }
  if (evento.tipo === "notificacao_automatica") {
    const canais = Array.isArray(evento.detalhes?.canais)
      ? evento.detalhes.canais.join(", ")
      : "cliente";
    return `Notificacao automatica registrada para ${canais}.`;
  }
  return "Evento registrado.";
}

function normalizarDetalhesEventoReserva(detalhes) {
  if (detalhes === undefined || detalhes === null) return {};
  if (typeof detalhes !== "object" || Array.isArray(detalhes)) {
    throw new ReservaEventoValidationError("Detalhes do evento devem ser um objeto");
  }
  return detalhes;
}

function normalizarEventoReserva(payload = {}) {
  const tipo = normalizarTipoEventoReserva(payload.tipo);
  const detalhes = normalizarDetalhesEventoReserva(payload.detalhes);
  const evento = {
    tipo,
    origem: normalizarOrigemEventoReserva(payload.origem),
    status_anterior: textoOpcional(payload.status_anterior, "Status anterior", 30),
    status_novo: textoOpcional(payload.status_novo, "Status novo", 30),
    mesa_id_anterior: normalizarInteiroOpcional(payload.mesa_id_anterior, "Mesa anterior"),
    mesa_id_novo: normalizarInteiroOpcional(payload.mesa_id_novo, "Mesa nova"),
    detalhes,
  };
  if (tipo === "compartilhamento") {
    const canal = normalizarCanalCompartilhamentoReserva(
      detalhes.canal || payload.canal,
    );
    evento.detalhes = { ...detalhes, canal };
  }
  evento.descricao = textoObrigatorio(
    payload.descricao || descricaoPadraoEventoReserva({ ...payload, ...evento }),
    "Descricao",
    2,
    500,
  );
  return evento;
}

function origemEventoPorUsuario(usuario, origemPadrao = "sistema") {
  const role = texto(usuario?.role).toLowerCase();
  if (role === "admin") return "admin";
  if (role === "garcom") return "garcom";
  return normalizarOrigemEventoReserva(origemPadrao);
}

module.exports = {
  CANAIS_COMPARTILHAMENTO_RESERVA,
  ORIGENS_EVENTO_RESERVA,
  ReservaEventoValidationError,
  TIPOS_EVENTO_RESERVA,
  descricaoCompartilhamentoReserva,
  normalizarCanalCompartilhamentoReserva,
  normalizarEventoReserva,
  origemEventoPorUsuario,
};
