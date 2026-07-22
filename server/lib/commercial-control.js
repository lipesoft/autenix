const STATUS_COMERCIAL = new Set([
  "lead",
  "trial",
  "cliente",
  "suspenso",
  "cancelado",
  "isento",
]);

class CommercialControlValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CommercialControlValidationError";
    this.statusCode = 400;
  }
}

function normalizarData(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  const texto = String(valor).trim();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? new Date(`${texto}T00:00:00.000Z`)
    : new Date(texto);
  if (Number.isNaN(data.getTime())) {
    throw new CommercialControlValidationError(`${campo} invalida`);
  }
  return data.toISOString().slice(0, 10);
}

function normalizarTexto(valor, limite, campo) {
  const texto = String(valor || "").trim();
  if (texto.length > limite) {
    throw new CommercialControlValidationError(`${campo} deve ter no maximo ${limite} caracteres`);
  }
  return texto || null;
}

function inferirStatusComercial(statusCobranca, ativo = true) {
  if (!ativo) return "suspenso";
  if (statusCobranca === "trial") return "trial";
  if (statusCobranca === "isento") return "isento";
  return "cliente";
}

function normalizarStatusComercial(valor, fallback = "trial") {
  const status = String(valor || fallback).trim().toLowerCase();
  if (!STATUS_COMERCIAL.has(status)) {
    throw new CommercialControlValidationError("Status comercial invalido");
  }
  return status;
}

function normalizarCamposComerciais(opcoes = {}, contexto = {}) {
  const statusFallback = inferirStatusComercial(
    contexto.statusCobranca || opcoes.status_cobranca,
    contexto.ativo ?? opcoes.ativo ?? true,
  );
  return {
    statusComercial: normalizarStatusComercial(opcoes.status_comercial, statusFallback),
    dataInicioContrato: normalizarData(
      opcoes.data_inicio_contrato,
      "Data de inicio do contrato",
    ),
    ultimoContatoComercialEm: normalizarData(
      opcoes.ultimo_contato_comercial_em,
      "Data do ultimo contato comercial",
    ),
    responsavelComercial: normalizarTexto(
      opcoes.responsavel_comercial,
      120,
      "Responsavel comercial",
    ),
    motivoSuspensao: normalizarTexto(
      opcoes.motivo_suspensao,
      500,
      "Motivo de suspensao",
    ),
  };
}

function inicioDiaUTC(valor) {
  if (!valor) return null;
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}

function diasAte(dataAlvo, hoje = new Date()) {
  const alvo = inicioDiaUTC(dataAlvo);
  const base = inicioDiaUTC(hoje);
  if (alvo === null || base === null) return null;
  return Math.round((alvo - base) / 86400000);
}

function percentualUso(atual, limite) {
  const usado = Number(atual || 0);
  const total = Number(limite || 0);
  if (!Number.isFinite(usado) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(999, Math.round((usado / total) * 100));
}

function criarUso(atual, limite) {
  return {
    atual: Number(atual || 0),
    limite: Number(limite || 0),
    percentual: percentualUso(atual, limite),
  };
}

function alertaLimite(campo, label, uso) {
  if (uso.limite <= 0 || uso.percentual < 80) return null;
  const atingido = uso.percentual >= 100;
  return {
    tipo: "limite",
    campo,
    severidade: atingido ? "critico" : "atencao",
    titulo: atingido ? `Limite de ${label} atingido` : `Uso alto de ${label}`,
    detalhe: `${uso.atual}/${uso.limite} ${label}`,
  };
}

function usoPlanoRestaurante(restaurante = {}) {
  return {
    mesas: criarUso(restaurante.mesas_cadastradas, restaurante.limite_mesas),
    usuarios: criarUso(restaurante.usuarios_ativos, restaurante.limite_usuarios),
    produtos: criarUso(restaurante.produtos_cadastrados, restaurante.limite_produtos),
  };
}

function alertasComerciais(restaurante = {}, hoje = new Date()) {
  if (restaurante.excluido_em) return [];

  const alertas = [];
  const statusComercial = restaurante.status_comercial
    || inferirStatusComercial(restaurante.status_cobranca, Boolean(restaurante.ativo));
  const statusCobranca = restaurante.status_cobranca || "trial";
  const trialDias = diasAte(restaurante.trial_termina_em, hoje);
  const cobrancaDias = diasAte(restaurante.proxima_cobranca_em, hoje);

  if (statusComercial === "trial" && trialDias !== null && trialDias <= 7) {
    alertas.push({
      tipo: "trial",
      severidade: trialDias < 0 ? "critico" : "atencao",
      titulo: trialDias < 0 ? "Trial expirado" : "Trial perto do fim",
      detalhe: trialDias < 0 ? `${Math.abs(trialDias)} dias vencido` : `${trialDias} dias restantes`,
    });
  }

  if (statusCobranca === "atrasado") {
    alertas.push({
      tipo: "cobranca",
      severidade: "critico",
      titulo: "Cobranca em atraso",
      detalhe: restaurante.proxima_cobranca_em
        ? `Vencimento em ${String(restaurante.proxima_cobranca_em).slice(0, 10)}`
        : "Sem data de regularizacao",
    });
  } else if (cobrancaDias !== null && statusCobranca !== "isento") {
    if (cobrancaDias < 0) {
      alertas.push({
        tipo: "cobranca",
        severidade: "critico",
        titulo: "Cobranca vencida",
        detalhe: `${Math.abs(cobrancaDias)} dias vencida`,
      });
    } else if (cobrancaDias <= 7 && statusCobranca !== "trial") {
      alertas.push({
        tipo: "cobranca",
        severidade: "atencao",
        titulo: "Cobranca proxima",
        detalhe: `${cobrancaDias} dias restantes`,
      });
    }
  }

  const uso = usoPlanoRestaurante(restaurante);
  for (const item of [
    alertaLimite("mesas", "mesas", uso.mesas),
    alertaLimite("usuarios", "usuarios", uso.usuarios),
    alertaLimite("produtos", "produtos", uso.produtos),
  ]) {
    if (item) alertas.push(item);
  }

  if (!restaurante.ativo && statusComercial !== "cancelado") {
    alertas.push({
      tipo: "status",
      severidade: "atencao",
      titulo: "Restaurante pausado",
      detalhe: restaurante.motivo_suspensao || "Operacao bloqueada",
    });
  }

  return alertas;
}

function mensalidadeMensalizadaCentavos(restaurante = {}) {
  const mensalidade = Number(restaurante.mensalidade_centavos || 0);
  if (!Number.isFinite(mensalidade) || mensalidade <= 0) return 0;
  if (restaurante.status_cobranca === "isento" || restaurante.status_comercial === "isento") {
    return 0;
  }
  if (restaurante.excluido_em || restaurante.status_comercial === "cancelado") return 0;
  if (restaurante.ciclo_cobranca === "anual") return Math.round(mensalidade / 12);
  if (restaurante.ciclo_cobranca === "experimental") return 0;
  return mensalidade;
}

function anexarControleComercial(restaurante = {}, hoje = new Date()) {
  const statusComercial = restaurante.status_comercial
    || inferirStatusComercial(restaurante.status_cobranca, Boolean(restaurante.ativo));
  const enriquecido = {
    ...restaurante,
    status_comercial: statusComercial,
    uso_plano: usoPlanoRestaurante(restaurante),
  };
  return {
    ...enriquecido,
    receita_mrr_centavos: mensalidadeMensalizadaCentavos(enriquecido),
    alertas_comerciais: alertasComerciais(enriquecido, hoje),
  };
}

function resumoSaas(restaurantes = [], hoje = new Date()) {
  const enriquecidos = restaurantes.map((item) => anexarControleComercial(item, hoje));
  return enriquecidos.reduce((resumo, restaurante) => {
    const ativoNaBase = !restaurante.excluido_em;
    const criticos = restaurante.alertas_comerciais.filter((alerta) => alerta.severidade === "critico").length;
    const atencao = restaurante.alertas_comerciais.filter((alerta) => alerta.severidade === "atencao").length;

    if (ativoNaBase) resumo.total += 1;
    if (restaurante.ativo && ativoNaBase) resumo.ativos += 1;
    if (!restaurante.ativo && ativoNaBase) resumo.suspensos += 1;
    if (restaurante.status_comercial === "trial" && ativoNaBase) resumo.trial += 1;
    if (restaurante.status_comercial === "cancelado" || restaurante.excluido_em) resumo.cancelados += 1;
    resumo.receita_mrr_centavos += restaurante.receita_mrr_centavos;
    resumo.alertas_criticos += criticos;
    resumo.alertas_atencao += atencao;
    return resumo;
  }, {
    total: 0,
    ativos: 0,
    suspensos: 0,
    trial: 0,
    cancelados: 0,
    receita_mrr_centavos: 0,
    alertas_criticos: 0,
    alertas_atencao: 0,
  });
}

module.exports = {
  CommercialControlValidationError,
  STATUS_COMERCIAL,
  alertasComerciais,
  anexarControleComercial,
  diasAte,
  mensalidadeMensalizadaCentavos,
  normalizarCamposComerciais,
  normalizarStatusComercial,
  resumoSaas,
  usoPlanoRestaurante,
};
