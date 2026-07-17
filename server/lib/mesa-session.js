const crypto = require("crypto");

class MesaSessionValidationError extends Error {
  constructor(message = "Sessao da mesa invalida ou expirada") {
    super(message);
    this.name = "MesaSessionValidationError";
  }
}

function normalizarTokenSessaoMesa(token) {
  const valor = String(token || "").trim();
  if (!valor) {
    throw new MesaSessionValidationError("Sessao da mesa ausente");
  }
  if (valor.length < 32 || valor.length > 160) {
    throw new MesaSessionValidationError();
  }
  if (!/^[A-Za-z0-9_-]+$/.test(valor)) {
    throw new MesaSessionValidationError();
  }
  return valor;
}

function criarTokenSessaoMesa() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashTokenSessaoMesa(token) {
  const tokenNormalizado = normalizarTokenSessaoMesa(token);
  return crypto.createHash("sha256").update(tokenNormalizado).digest("hex");
}

function normalizarTtlHoras(valor) {
  const ttl = Number(valor || 12);
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 72) return 12;
  return ttl;
}

function calcularExpiracaoSessaoMesa(ttlHoras = 12, agora = new Date()) {
  const ttl = normalizarTtlHoras(ttlHoras);
  return new Date(agora.getTime() + ttl * 60 * 60 * 1000);
}

module.exports = {
  MesaSessionValidationError,
  calcularExpiracaoSessaoMesa,
  criarTokenSessaoMesa,
  hashTokenSessaoMesa,
  normalizarTokenSessaoMesa,
  normalizarTtlHoras,
};
