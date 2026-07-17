const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  MesaSessionValidationError,
  calcularExpiracaoSessaoMesa,
  criarTokenSessaoMesa,
  hashTokenSessaoMesa,
  normalizarTokenSessaoMesa,
  normalizarTtlHoras,
} = require("../lib/mesa-session");

test("gera token de sessao de mesa forte e compativel com URL", () => {
  const token = criarTokenSessaoMesa();

  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(token.length >= 40);
});

test("gera hash estavel sem expor o token original", () => {
  const token = criarTokenSessaoMesa();
  const hash = hashTokenSessaoMesa(token);

  assert.equal(hash.length, 64);
  assert.equal(hashTokenSessaoMesa(token), hash);
  assert.notEqual(hash, token);
});

test("rejeita token ausente, curto ou com caracteres invalidos", () => {
  assert.throws(() => normalizarTokenSessaoMesa(""), MesaSessionValidationError);
  assert.throws(() => normalizarTokenSessaoMesa("abc"), MesaSessionValidationError);
  assert.throws(
    () => normalizarTokenSessaoMesa("token com espaco token com espaco token"),
    MesaSessionValidationError,
  );
});

test("normaliza ttl da sessao de mesa com limite conservador", () => {
  assert.equal(normalizarTtlHoras("8"), 8);
  assert.equal(normalizarTtlHoras("-1"), 12);
  assert.equal(normalizarTtlHoras("200"), 12);

  const expiraEm = calcularExpiracaoSessaoMesa(2, new Date("2026-07-17T10:00:00Z"));
  assert.equal(expiraEm.toISOString(), "2026-07-17T12:00:00.000Z");
});
