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
    limite_usuarios: 12,
    limite_produtos: 250,
    mensalidade_centavos: 18900,
    status_cobranca: "ativo",
    ciclo_cobranca: "mensal",
    trial_termina_em: "2026-08-15",
    mesas: 12,
  });

  assert.equal(dados.nome, "Bistrô Aurora");
  assert.equal(dados.slug, "bistro-aurora");
  assert.equal(dados.login, "master_aurora");
  assert.equal(dados.plano, "profissional");
  assert.equal(dados.quantidadeMesas, 12);
  assert.equal(dados.limiteMesas, 40);
  assert.equal(dados.limiteUsuarios, 12);
  assert.equal(dados.limiteProdutos, 250);
  assert.equal(dados.mensalidadeCentavos, 18900);
  assert.equal(dados.statusCobranca, "ativo");
  assert.equal(dados.cicloCobranca, "mensal");
  assert.equal(dados.trialTerminaEm, "2026-08-15");
});

test("normaliza white label inicial do restaurante", () => {
  const dados = normalizarCriacaoTenant({
    nome: "Casa do Norte",
    senha: "SenhaMuitoForte123!",
    white_label_ativo: true,
    nome_exibicao: "Casa do Norte Premium",
    logo_url: "https://cdn.exemplo.com/logo.png",
    cor_primaria: "#123456",
    cor_secundaria: "#ff6600",
  });

  assert.equal(dados.marca.white_label_ativo, true);
  assert.equal(dados.marca.nome_exibicao, "Casa do Norte Premium");
  assert.equal(dados.marca.logo_url, "https://cdn.exemplo.com/logo.png");
  assert.equal(dados.marca.cor_primaria, "#123456");
  assert.equal(dados.marca.cor_secundaria, "#ff6600");
});

test("gera senha temporaria forte quando ela nao e informada", () => {
  const dados = normalizarCriacaoTenant({
    nome: "Restaurante Teste",
    limite_mesas: 10,
    mesas: 2,
  });

  assert.equal(dados.senhaGerada, true);
  assert.ok(dados.senha.length >= 12);
  assert.equal(dados.limiteUsuarios, 5);
  assert.equal(dados.limiteProdutos, 120);
  assert.equal(dados.mensalidadeCentavos, 9900);
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

test("aplica limites padrao do plano profissional", () => {
  const dados = normalizarCriacaoTenant({
    nome: "Restaurante Plano Pro",
    senha: "SenhaMuitoForte123!",
    plano: "profissional",
  });

  assert.equal(dados.limiteMesas, 60);
  assert.equal(dados.limiteUsuarios, 15);
  assert.equal(dados.limiteProdutos, 400);
  assert.equal(dados.mensalidadeCentavos, 19900);
});
