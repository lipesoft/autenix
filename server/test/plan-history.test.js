const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  PlanHistoryValidationError,
  descreverHistoricoPlano,
  normalizarHistoricoPlano,
  snapshotPlanoRestaurante,
} = require("../lib/plan-history");

test("gera snapshot com campos comerciais do restaurante", () => {
  const snapshot = snapshotPlanoRestaurante({
    id: 12,
    nome: "Restaurante Teste",
    plano: "profissional",
    limite_mesas: 40,
    mensalidade_centavos: 19900,
    atualizado_em: "fora do snapshot",
  });

  assert.equal(snapshot.id, 12);
  assert.equal(snapshot.nome, "Restaurante Teste");
  assert.equal(snapshot.plano, "profissional");
  assert.equal(snapshot.limite_mesas, 40);
  assert.equal(snapshot.mensalidade_centavos, 19900);
  assert.equal(snapshot.atualizado_em, undefined);
});

test("normaliza historico de alteracao de plano com usuario da plataforma", () => {
  const historico = normalizarHistoricoPlano({
    restaurante_id: "4",
    acao: " alteracao_plano ",
    anterior: { id: 4, plano: "essencial", status_cobranca: "trial" },
    novo: { id: 4, plano: "profissional", status_cobranca: "ativo" },
    usuario: { id: 2, nome: " Filipe  Admin ", login: "master.plataforma" },
    motivo: " Upgrade contratado ",
  });

  assert.equal(historico.restaurante_id, 4);
  assert.equal(historico.platform_usuario_id, 2);
  assert.equal(historico.platform_usuario_nome, "Filipe Admin");
  assert.equal(historico.acao, "alteracao_plano");
  assert.equal(historico.dados_anteriores.plano, "essencial");
  assert.equal(historico.dados_novos.plano, "profissional");
  assert.equal(historico.motivo, "Upgrade contratado");
});

test("descreve alteracoes relevantes do historico", () => {
  assert.equal(
    descreverHistoricoPlano({
      acao: "alteracao_status",
      dados_anteriores: { ativo: 1 },
      dados_novos: { ativo: 0 },
    }),
    "Status alterado de ativo para pausado",
  );
  assert.equal(
    descreverHistoricoPlano({
      acao: "arquivamento",
      dados_novos: { excluido_em: "2026-07-22T12:00:00.000Z" },
    }),
    "Restaurante excluido",
  );
  assert.equal(
    descreverHistoricoPlano({
      acao: "alteracao_plano",
      dados_anteriores: { plano: "essencial", status_cobranca: "trial" },
      dados_novos: { plano: "profissional", status_cobranca: "ativo" },
    }),
    "Alterado: plano essencial para profissional, cobranca trial para ativo",
  );
});

test("rejeita historico de plano invalido", () => {
  assert.throws(
    () => normalizarHistoricoPlano({ restaurante_id: "x", acao: "criacao", novo: {} }),
    PlanHistoryValidationError,
  );
  assert.throws(
    () => normalizarHistoricoPlano({ restaurante_id: 1, acao: "apagado", novo: {} }),
    PlanHistoryValidationError,
  );
});
