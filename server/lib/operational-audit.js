const ACOES_AUDITORIA = new Set(["criacao", "alteracao", "remocao", "fechamento"]);
const ENTIDADES_AUDITORIA = new Set([
  "categorias",
  "produtos",
  "usuarios",
  "mesas",
  "financeiro",
]);

const CHAVES_SENSIVEIS = /(senha|password|token|secret|hash|authorization|cookie|jwt)/i;

class OperationalAuditValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OperationalAuditValidationError";
    this.statusCode = 400;
  }
}

function textoOpcional(valor, limite) {
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ");
  if (!texto) return null;
  return texto.slice(0, limite);
}

function idOpcional(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function sanitizarValor(valor) {
  if (Array.isArray(valor)) return valor.map(sanitizarValor);
  if (!valor || typeof valor !== "object") return valor;

  return Object.fromEntries(
    Object.entries(valor)
      .filter(([chave]) => !CHAVES_SENSIVEIS.test(chave))
      .map(([chave, item]) => [chave, sanitizarValor(item)]),
  );
}

function objetoOpcional(valor) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  return sanitizarValor(valor);
}

function normalizarAcao(acao) {
  const normalizada = String(acao || "").trim().toLowerCase();
  if (!ACOES_AUDITORIA.has(normalizada)) {
    throw new OperationalAuditValidationError("Acao de auditoria invalida");
  }
  return normalizada;
}

function normalizarEntidade(entidade) {
  const normalizada = String(entidade || "").trim().toLowerCase();
  if (!ENTIDADES_AUDITORIA.has(normalizada)) {
    throw new OperationalAuditValidationError("Entidade de auditoria invalida");
  }
  return normalizada;
}

function normalizarAuditoriaOperacional(payload = {}) {
  const restauranteId = Number(payload.restaurante_id);
  if (!Number.isInteger(restauranteId) || restauranteId <= 0) {
    throw new OperationalAuditValidationError("Restaurante invalido para auditoria");
  }

  const usuario = payload.usuario || {};
  return {
    restaurante_id: restauranteId,
    usuario_id: idOpcional(payload.usuario_id ?? usuario.id),
    usuario_nome: textoOpcional(payload.usuario_nome ?? usuario.nome, 120),
    usuario_login: textoOpcional(payload.usuario_login ?? usuario.login, 120),
    usuario_role: textoOpcional(payload.usuario_role ?? usuario.role, 40),
    acao: normalizarAcao(payload.acao),
    entidade: normalizarEntidade(payload.entidade),
    entidade_id: idOpcional(payload.entidade_id),
    dados_anteriores: objetoOpcional(payload.dados_anteriores),
    dados_novos: objetoOpcional(payload.dados_novos),
    metadados: objetoOpcional(payload.metadados) || {},
    request_id: textoOpcional(payload.request_id, 120),
  };
}

module.exports = {
  ACOES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  OperationalAuditValidationError,
  normalizarAuditoriaOperacional,
  sanitizarValor,
};
