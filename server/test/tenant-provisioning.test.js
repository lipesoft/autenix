const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TenantValidationError,
  normalizarCriacaoTenant,
} = require("../lib/tenant-provisioning");

test("normaliza os dados de um novo restaurante", () => {
  const dados = normalizarCriacaoTenant({
    nome: "  Bistrô Aurora  ",
    login: "Master Aurora",
    senha: "SenhaMuitoForte123!",
    plano: "profissional",
    limite_mesas: 40,
    mesas: 12,
  });

  assert.equal(dados.nome, "Bistrô Aurora");
  assert.equal(dados.slug, "bistro-aurora");
  assert.equal(dados.login, "master_aurora");
  assert.equal(dados.plano, "profissional");
  assert.equal(dados.quantidadeMesas, 12);
  assert.equal(dados.limiteMesas, 40);
});

test("gera senha temporaria forte quando ela nao e informada", () => {
  const dados = normalizarCriacaoTenant({
    nome: "Restaurante Teste",
    limite_mesas: 10,
    mesas: 2,
  });

  assert.equal(dados.senhaGerada, true);
  assert.ok(dados.senha.length >= 12);
});

test("impede criar mais mesas que o limite contratado", () => {
  assert.throws(
    () => normalizarCriacaoTenant({
      nome: "Restaurante Teste",
      senha: "SenhaMuitoForte123!",
      limite_mesas: 5,
      mesas: 6,
    }),
    TenantValidationError,
  );
});

