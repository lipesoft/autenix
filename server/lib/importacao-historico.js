const FORMATOS_IMPORTACAO = new Set(["csv", "xlsx"]);
const TIPOS_IMPORTACAO_HISTORICO = new Set([
  "categorias",
  "produtos",
  "mesas",
  "usuarios",
]);
const JANELA_ROLLBACK_HORAS = 24;

class ImportacaoHistoricoError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ImportacaoHistoricoError";
    this.statusCode = statusCode;
  }
}

function textoLimitado(valor, limite) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, limite);
}

function normalizarFormato(valor, arquivoNome) {
  const informado = textoLimitado(valor, 10).toLowerCase();
  if (FORMATOS_IMPORTACAO.has(informado)) return informado;
  const extensao = textoLimitado(arquivoNome, 255).toLowerCase().split(".").pop();
  return FORMATOS_IMPORTACAO.has(extensao) ? extensao : "csv";
}

function normalizarMapeamento(valor, colunasPermitidas) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const permitidas = new Set(colunasPermitidas || []);
  return Object.entries(valor).reduce((mapeamento, [campo, coluna]) => {
    if (!permitidas.has(campo)) return mapeamento;
    mapeamento[campo] = textoLimitado(coluna, 120);
    return mapeamento;
  }, {});
}

function normalizarMetadadosImportacao(payload = {}, colunasPermitidas = []) {
  const tipo = textoLimitado(payload.tipo, 30).toLowerCase();
  if (!TIPOS_IMPORTACAO_HISTORICO.has(tipo)) {
    throw new ImportacaoHistoricoError("Tipo de importacao invalido");
  }

  const formato = normalizarFormato(payload.formato, payload.arquivo_nome);
  const nomeRecebido = textoLimitado(payload.arquivo_nome, 500)
    .split(/[\\/]/)
    .pop();
  const arquivoNome = textoLimitado(nomeRecebido, 255) || `importacao.${formato}`;

  return {
    tipo,
    formato,
    arquivo_nome: arquivoNome,
    atualizar_existentes: Boolean(payload.atualizar_existentes),
    mapeamento: normalizarMapeamento(payload.mapeamento, colunasPermitidas),
  };
}

function rollbackDisponivel(importacao, agora = new Date()) {
  if (!importacao || importacao.status !== "concluida") return false;
  const criadoEm = new Date(importacao.criado_em);
  if (Number.isNaN(criadoEm.getTime())) return false;
  const limiteMs = JANELA_ROLLBACK_HORAS * 60 * 60 * 1000;
  return agora.getTime() - criadoEm.getTime() <= limiteMs;
}

module.exports = {
  ImportacaoHistoricoError,
  JANELA_ROLLBACK_HORAS,
  normalizarMetadadosImportacao,
  rollbackDisponivel,
};
