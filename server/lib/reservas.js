const STATUS_RESERVA = ["pendente", "confirmada", "cancelada", "concluida"];
const ORIGENS_RESERVA = ["publica", "admin"];

class ReservasValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReservasValidationError";
    this.statusCode = 400;
  }
}

function texto(valor) {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

function textoObrigatorio(valor, campo, min, max) {
  const normalizado = texto(valor);
  if (normalizado.length < min || normalizado.length > max) {
    throw new ReservasValidationError(
      `${campo} deve ter entre ${min} e ${max} caracteres`,
    );
  }
  return normalizado;
}

function textoOpcional(valor, campo, max) {
  const normalizado = texto(valor);
  if (!normalizado) return null;
  if (normalizado.length > max) {
    throw new ReservasValidationError(`${campo} deve ter no maximo ${max} caracteres`);
  }
  return normalizado;
}

function normalizarEmail(valor) {
  const email = texto(valor).toLowerCase();
  if (!email) return null;
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ReservasValidationError("Email invalido");
  }
  return email;
}

function normalizarData(valor, campo = "Data") {
  const data = texto(valor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new ReservasValidationError(`${campo} deve estar no formato YYYY-MM-DD`);
  }
  const parsed = new Date(`${data}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data) {
    throw new ReservasValidationError(`${campo} invalida`);
  }
  return data;
}

function normalizarHorario(valor) {
  const horario = texto(valor);
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(horario);
  if (!match) {
    throw new ReservasValidationError("Horario deve estar no formato HH:MM");
  }
  return `${match[1]}:${match[2]}`;
}

function normalizarInteiro(valor, campo, min, max) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw new ReservasValidationError(`${campo} deve ser um numero entre ${min} e ${max}`);
  }
  return numero;
}

function normalizarMesaId(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  return normalizarInteiro(valor, "Mesa", 1, Number.MAX_SAFE_INTEGER);
}

function normalizarOrigem(origem) {
  const valor = texto(origem || "publica").toLowerCase();
  if (!ORIGENS_RESERVA.includes(valor)) {
    throw new ReservasValidationError("Origem de reserva invalida");
  }
  return valor;
}

function normalizarStatusReserva(status) {
  const valor = texto(status).toLowerCase();
  if (!STATUS_RESERVA.includes(valor)) {
    throw new ReservasValidationError("Status de reserva invalido");
  }
  return valor;
}

function normalizarCriacaoReserva(payload = {}, options = {}) {
  return {
    nome_cliente: textoObrigatorio(payload.nome_cliente, "Nome do cliente", 2, 120),
    telefone: textoObrigatorio(payload.telefone, "Telefone", 8, 30),
    email: normalizarEmail(payload.email),
    data_reserva: normalizarData(payload.data_reserva),
    horario: normalizarHorario(payload.horario),
    quantidade_pessoas: normalizarInteiro(
      payload.quantidade_pessoas ?? 2,
      "Quantidade de pessoas",
      1,
      100,
    ),
    observacao: textoOpcional(payload.observacao, "Observacao", 500),
    mesa_id: normalizarMesaId(payload.mesa_id),
    origem: normalizarOrigem(options.origem || payload.origem || "publica"),
  };
}

function normalizarFiltrosReservas(query = {}) {
  const filtros = {};
  if (query.status) filtros.status = normalizarStatusReserva(query.status);
  if (query.data) filtros.data = normalizarData(query.data, "Data");
  if (query.de) filtros.de = normalizarData(query.de, "Data inicial");
  if (query.ate) filtros.ate = normalizarData(query.ate, "Data final");
  return filtros;
}

module.exports = {
  STATUS_RESERVA,
  ReservasValidationError,
  normalizarCriacaoReserva,
  normalizarFiltrosReservas,
  normalizarMesaId,
  normalizarStatusReserva,
};
