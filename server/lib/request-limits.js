const crypto = require("crypto");
const { ipKeyGenerator, rateLimit } = require("express-rate-limit");

function inteiroConfigurado(nome, padrao, minimo = 1, maximo = 100000) {
  const valor = Number(process.env[nome]);
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo
    ? valor
    : padrao;
}

function tokenSessaoMesa(req) {
  return String(
    req.body?.sessao
      || req.query?.sessao
      || req.headers?.["x-mesa-session"]
      || req.headers?.["x-mesa-sessao"]
      || "",
  ).trim();
}

function chaveIp(req) {
  return `ip:${ipKeyGenerator(req.ip || req.socket?.remoteAddress || "0.0.0.0")}`;
}

function chaveSessaoOuIp(req) {
  const token = tokenSessaoMesa(req);
  if (!token) return chaveIp(req);
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return `mesa:${hash}`;
}

function criarLimitador({ windowMs, max, mensagem, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator,
    skip: (req) => req.method === "OPTIONS",
    message: { erro: mensagem },
  });
}

const leituraPublicaRateLimit = criarLimitador({
  windowMs: 5 * 60 * 1000,
  max: inteiroConfigurado("RATE_LIMIT_PUBLIC_READ_MAX", 600),
  mensagem: "Muitas consultas em pouco tempo. Aguarde alguns instantes.",
});

const leituraMesaRateLimit = criarLimitador({
  windowMs: 5 * 60 * 1000,
  max: inteiroConfigurado("RATE_LIMIT_TABLE_READ_MAX", 240),
  keyGenerator: chaveSessaoOuIp,
  mensagem: "Muitas atualizacoes desta mesa. Aguarde alguns instantes.",
});

const acaoMesaRateLimit = criarLimitador({
  windowMs: 60 * 1000,
  max: inteiroConfigurado("RATE_LIMIT_TABLE_ACTION_MAX", 40),
  keyGenerator: chaveSessaoOuIp,
  mensagem: "Muitas acoes nesta mesa. Aguarde um minuto e tente novamente.",
});

const criarReservaRateLimit = criarLimitador({
  windowMs: 15 * 60 * 1000,
  max: inteiroConfigurado("RATE_LIMIT_RESERVATION_CREATE_MAX", 20),
  mensagem: "Muitas solicitacoes de reserva. Aguarde antes de tentar novamente.",
});

const acompanharReservaRateLimit = criarLimitador({
  windowMs: 5 * 60 * 1000,
  max: inteiroConfigurado("RATE_LIMIT_RESERVATION_READ_MAX", 180),
  mensagem: "Muitas atualizacoes da reserva. Aguarde alguns instantes.",
});

module.exports = {
  acaoMesaRateLimit,
  acompanharReservaRateLimit,
  chaveSessaoOuIp,
  criarReservaRateLimit,
  leituraMesaRateLimit,
  leituraPublicaRateLimit,
};
