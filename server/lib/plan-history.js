const ACOES_HISTORICO_PLANO = new Set([
  "criacao",
  "alteracao_plano",
  "alteracao_status",
  "arquivamento",
]);

const CAMPOS_SNAPSHOT_PLANO = [
  "id",
  "nome",
  "slug",
  "ativo",
  "plano",
  "limite_mesas",
  "limite_usuarios",
  "limite_produtos",
  "mensalidade_centavos",
  "ciclo_cobranca",
  "status_cobranca",
  "trial_termina_em",
  "proxima_cobranca_em",
  "observacoes_plano",
  "status_comercial",
  "data_inicio_contrato",
  "ultimo_contato_comercial_em",
  "responsavel_comercial",
  "motivo_suspensao",
  "excluido_em",
];

class PlanHistoryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlanHistoryValidationError";
    this.statusCode = 400;
  }
}

function textoOpcional(valor, limite, campo) {
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ");
  if (!texto) return null;
  if (texto.length > limite) {
    throw new PlanHistoryValidationError(`${campo} deve ter no maximo ${limite} caracteres`);
  }
  return texto;
}

function normalizarAcaoHistoricoPlano(acao) {
  const normalizada = String(acao || "").trim().toLowerCase();
  if (!ACOES_HISTORICO_PLANO.has(normalizada)) {
    throw new PlanHistoryValidationError("Acao de historico de plano invalida");
  }
  return normalizada;
}

function normalizarDataSnapshot(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  if (valor instanceof Date) return valor.toISOString();
  return valor;
}

function snapshotPlanoRestaurante(restaurante = {}) {
  return CAMPOS_SNAPSHOT_PLANO.reduce((snapshot, campo) => {
    snapshot[campo] = normalizarDataSnapshot(restaurante[campo]);
    return snapshot;
  }, {});
}

function normalizarHistoricoPlano(payload = {}) {
  const restauranteId = Number(payload.restaurante_id);
  if (!Number.isInteger(restauranteId) || restauranteId <= 0) {
    throw new PlanHistoryValidationError("Restaurante invalido para historico");
  }

  const dadosNovos = payload.dados_novos || snapshotPlanoRestaurante(payload.novo);
  if (!dadosNovos || typeof dadosNovos !== "object" || Array.isArray(dadosNovos)) {
    throw new PlanHistoryValidationError("Dados novos do historico devem ser um objeto");
  }

  const dadosAnteriores = payload.dados_anteriores !== undefined
    ? payload.dados_anteriores
    : (payload.anterior ? snapshotPlanoRestaurante(payload.anterior) : null);
  if (
    dadosAnteriores !== null &&
    (typeof dadosAnteriores !== "object" || Array.isArray(dadosAnteriores))
  ) {
    throw new PlanHistoryValidationError("Dados anteriores do historico devem ser um objeto");
  }

  return {
    restaurante_id: restauranteId,
    platform_usuario_id: payload.platform_usuario_id || payload.usuario?.id || null,
    platform_usuario_nome: textoOpcional(
      payload.platform_usuario_nome || payload.usuario?.nome,
      120,
      "Nome do usuario da plataforma",
    ),
    platform_usuario_login: textoOpcional(
      payload.platform_usuario_login || payload.usuario?.login,
      120,
      "Login do usuario da plataforma",
    ),
    acao: normalizarAcaoHistoricoPlano(payload.acao),
    dados_anteriores: dadosAnteriores,
    dados_novos: dadosNovos,
    motivo: textoOpcional(payload.motivo, 500, "Motivo do historico"),
  };
}

function normalizarLinhaHistoricoPlano(row = {}) {
  return {
    id: row.id,
    restaurante_id: row.restaurante_id,
    platform_usuario_id: row.platform_usuario_id,
    platform_usuario_nome: row.platform_usuario_nome,
    platform_usuario_login: row.platform_usuario_login,
    acao: row.acao,
    dados_anteriores: row.dados_anteriores || null,
    dados_novos: row.dados_novos || {},
    motivo: row.motivo || null,
    criado_em: row.criado_em,
  };
}

function descreverHistoricoPlano(item = {}) {
  const anterior = item.dados_anteriores || {};
  const novo = item.dados_novos || {};
  if (item.acao === "criacao") return "Restaurante criado";
  if (item.acao === "arquivamento") return "Restaurante arquivado";
  if (item.acao === "alteracao_status") {
    const antes = anterior.ativo ? "ativo" : "suspenso";
    const depois = novo.ativo ? "ativo" : "suspenso";
    return `Status alterado de ${antes} para ${depois}`;
  }
  if (item.acao === "alteracao_plano") {
    const partes = [];
    if (anterior.plano !== novo.plano) {
      partes.push(`plano ${anterior.plano || "-"} para ${novo.plano || "-"}`);
    }
    if (String(anterior.status_cobranca || "") !== String(novo.status_cobranca || "")) {
      partes.push(
        `cobranca ${anterior.status_cobranca || "-"} para ${novo.status_cobranca || "-"}`,
      );
    }
    if (String(anterior.status_comercial || "") !== String(novo.status_comercial || "")) {
      partes.push(
        `comercial ${anterior.status_comercial || "-"} para ${novo.status_comercial || "-"}`,
      );
    }
    return partes.length ? `Alterado: ${partes.join(", ")}` : "Cadastro comercial atualizado";
  }
  return "Historico registrado";
}

module.exports = {
  ACOES_HISTORICO_PLANO,
  CAMPOS_SNAPSHOT_PLANO,
  PlanHistoryValidationError,
  descreverHistoricoPlano,
  normalizarHistoricoPlano,
  normalizarLinhaHistoricoPlano,
  snapshotPlanoRestaurante,
};
