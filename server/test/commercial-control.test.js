const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CommercialControlValidationError,
  alertasComerciais,
  anexarControleComercial,
  mensalidadeMensalizadaCentavos,
  normalizarCamposComerciais,
  resumoSaas,
} = require("../lib/commercial-control");

const HOJE = new Date("2026-07-18T12:00:00.000Z");

test("normaliza campos comerciais do restaurante", () => {
  const dados = normalizarCamposComerciais({
    status_comercial: "Cliente",
    data_inicio_contrato: "2026-07-01",
    ultimo_contato_comercial_em: "2026-07-15",
    responsavel_comercial: "Equipe Comercial",
    motivo_suspensao: "  ",
  });

  assert.equal(dados.statusComercial, "cliente");
  assert.equal(dados.dataInicioContrato, "2026-07-01");
  assert.equal(dados.ultimoContatoComercialEm, "2026-07-15");
  assert.equal(dados.responsavelComercial, "Equipe Comercial");
  assert.equal(dados.motivoSuspensao, null);
});

test("rejeita status comercial invalido", () => {
  assert.throws(
    () => normalizarCamposComerciais({ status_comercial: "bloqueado" }),
    CommercialControlValidationError,
  );
});

test("gera alertas de trial, cobranca e limite de uso", () => {
  const alertas = alertasComerciais({
    ativo: 1,
    status_comercial: "trial",
    status_cobranca: "ativo",
    trial_termina_em: "2026-07-20",
    proxima_cobranca_em: "2026-07-16",
    mesas_cadastradas: 20,
    limite_mesas: 20,
    usuarios_ativos: 9,
    limite_usuarios: 10,
    produtos_cadastrados: 70,
    limite_produtos: 100,
  }, HOJE);

  assert.ok(alertas.some((alerta) => alerta.tipo === "trial" && alerta.severidade === "atencao"));
  assert.ok(alertas.some((alerta) => alerta.tipo === "cobranca" && alerta.severidade === "critico"));
  assert.ok(alertas.some((alerta) => alerta.campo === "mesas" && alerta.severidade === "critico"));
  assert.ok(alertas.some((alerta) => alerta.campo === "usuarios" && alerta.severidade === "atencao"));
});

test("mensaliza receita anual e ignora isentos ou cancelados", () => {
  assert.equal(mensalidadeMensalizadaCentavos({
    mensalidade_centavos: 120000,
    ciclo_cobranca: "anual",
    status_cobranca: "ativo",
    status_comercial: "cliente",
  }), 10000);
  assert.equal(mensalidadeMensalizadaCentavos({
    mensalidade_centavos: 9900,
    ciclo_cobranca: "mensal",
    status_cobranca: "isento",
    status_comercial: "isento",
  }), 0);
  assert.equal(mensalidadeMensalizadaCentavos({
    mensalidade_centavos: 9900,
    ciclo_cobranca: "mensal",
    status_cobranca: "ativo",
    status_comercial: "cancelado",
  }), 0);
});

test("anexa controle comercial e resume o painel SaaS", () => {
  const restaurantes = [
    anexarControleComercial({
      id: 1,
      ativo: 1,
      status_comercial: "cliente",
      status_cobranca: "ativo",
      mensalidade_centavos: 9900,
      ciclo_cobranca: "mensal",
      mesas_cadastradas: 16,
      limite_mesas: 20,
    }, HOJE),
    anexarControleComercial({
      id: 2,
      ativo: 1,
      status_comercial: "trial",
      status_cobranca: "trial",
      mensalidade_centavos: 9900,
      ciclo_cobranca: "experimental",
      trial_termina_em: "2026-07-17",
    }, HOJE),
  ];

  const resumo = resumoSaas(restaurantes, HOJE);

  assert.equal(restaurantes[0].uso_plano.mesas.percentual, 80);
  assert.equal(resumo.total, 2);
  assert.equal(resumo.ativos, 2);
  assert.equal(resumo.trial, 1);
  assert.equal(resumo.receita_mrr_centavos, 9900);
  assert.equal(resumo.alertas_atencao, 1);
  assert.equal(resumo.alertas_criticos, 1);
});
