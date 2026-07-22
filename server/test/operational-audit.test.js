const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  OperationalAuditValidationError,
  normalizarAuditoriaOperacional,
  sanitizarValor,
} = require("../lib/operational-audit");

test("normaliza auditoria operacional sem dados sensiveis", () => {
  const auditoria = normalizarAuditoriaOperacional({
    restaurante_id: "3",
    usuario: {
      id: 9,
      nome: " Admin Teste ",
      login: "admin",
      role: "admin",
    },
    acao: " alteracao ",
    entidade: "usuarios",
    entidade_id: "11",
    dados_anteriores: {
      nome: "Garcom",
      senha: "$2a$12$hash",
      perfil: { token: "abc", role: "garcom" },
    },
    dados_novos: {
      nome: "Garcom Lider",
      senha_hash: "hash",
      role: "garcom",
    },
    metadados: {
      origem: "admin",
      authorization: "Bearer segredo",
    },
    request_id: " req-1 ",
  });

  assert.equal(auditoria.restaurante_id, 3);
  assert.equal(auditoria.usuario_id, 9);
  assert.equal(auditoria.usuario_nome, "Admin Teste");
  assert.equal(auditoria.acao, "alteracao");
  assert.equal(auditoria.entidade, "usuarios");
  assert.equal(auditoria.entidade_id, 11);
  assert.deepEqual(auditoria.dados_anteriores, {
    nome: "Garcom",
    perfil: { role: "garcom" },
  });
  assert.deepEqual(auditoria.dados_novos, {
    nome: "Garcom Lider",
    role: "garcom",
  });
  assert.deepEqual(auditoria.metadados, { origem: "admin" });
});

test("rejeita acao e entidade fora do catalogo", () => {
  assert.throws(
    () => normalizarAuditoriaOperacional({
      restaurante_id: 1,
      acao: "login",
      entidade: "usuarios",
    }),
    OperationalAuditValidationError,
  );
  assert.throws(
    () => normalizarAuditoriaOperacional({
      restaurante_id: 1,
      acao: "criacao",
      entidade: "segredos",
    }),
    OperationalAuditValidationError,
  );
});

test("sanitiza arrays e objetos aninhados", () => {
  assert.deepEqual(
    sanitizarValor({
      itens: [
        { nome: "A", token_publico: "x" },
        { nome: "B", detalhe: { jwt: "y", ok: true } },
      ],
    }),
    {
      itens: [
        { nome: "A" },
        { nome: "B", detalhe: { ok: true } },
      ],
    },
  );
});
