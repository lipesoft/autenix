const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  normalizarMetadadosImportacao,
  rollbackDisponivel,
} = require("../lib/importacao-historico");

test("normaliza metadados sem aceitar caminho ou campo desconhecido", () => {
  const metadados = normalizarMetadadosImportacao(
    {
      tipo: "produtos",
      arquivo_nome: "C:\\exportacoes\\cardapio.xlsx",
      formato: "xlsx",
      atualizar_existentes: true,
      mapeamento: { nome: "Produto", preco: "Valor", invasor: "senha" },
    },
    ["nome", "preco"],
  );

  assert.equal(metadados.arquivo_nome, "cardapio.xlsx");
  assert.equal(metadados.formato, "xlsx");
  assert.equal(metadados.atualizar_existentes, true);
  assert.deepEqual(metadados.mapeamento, { nome: "Produto", preco: "Valor" });
});

test("limita rollback a importacao concluida nas ultimas 24 horas", () => {
  const agora = new Date("2026-07-18T12:00:00.000Z");

  assert.equal(
    rollbackDisponivel({ status: "concluida", criado_em: "2026-07-18T11:00:00.000Z" }, agora),
    true,
  );
  assert.equal(
    rollbackDisponivel({ status: "concluida", criado_em: "2026-07-17T10:00:00.000Z" }, agora),
    false,
  );
  assert.equal(
    rollbackDisponivel({ status: "revertida", criado_em: "2026-07-18T11:00:00.000Z" }, agora),
    false,
  );
});
