const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarDiagnosticoOperacional,
  somarDiagnosticosTenant,
  statusDiagnostico,
} = require("../lib/operational-diagnostics");

test("monta diagnostico operacional sem dados sensiveis", () => {
  const diagnostico = montarDiagnosticoOperacional({
    app: "autenix-api",
    version: "1.0.0",
    environment: "test",
    database: { status: "ok", latency_ms: 12 },
    storage: { status: "configured" },
    restaurantes: { total: "2", ativos: "1", inativos: "1", arquivados: "0" },
    sessoesMesa: { ativas: "3", expiradas_pendentes: "0", encerradas_24h: "2" },
    reservas: { pendentes: "1", confirmadas: "1", fila: "0", chamadas: "0", atrasadas: "0" },
    notificacoes: { pendentes: "0", erro: "0", sem_provedor: "4", antigas: "0" },
    importacoes: { ultimas_24h: "1", revertidas_24h: "0", invalidos_24h: "0" },
    pedidos: { abertos: "2", finalizados_24h: "5" },
  });

  assert.equal(diagnostico.status, "healthy");
  assert.equal(diagnostico.restaurantes.total, 2);
  assert.equal(diagnostico.storage.status, "configured");
  assert.equal(JSON.stringify(diagnostico).includes("senha"), false);
  assert.equal(JSON.stringify(diagnostico).includes("token"), false);
});

test("classifica alertas operacionais por severidade", () => {
  assert.equal(statusDiagnostico([{ severidade: "info" }]), "attention");
  assert.equal(statusDiagnostico([{ severidade: "critico" }]), "degraded");

  const diagnostico = montarDiagnosticoOperacional({
    app: "autenix-api",
    version: "1.0.0",
    environment: "test",
    database: { status: "ok", latency_ms: 12 },
    storage: { status: "not_configured" },
    restaurantes: {},
    sessoesMesa: { expiradas_pendentes: "2" },
    reservas: { atrasadas: "1" },
    notificacoes: { erro: "1", antigas: "1" },
    importacoes: {},
    pedidos: {},
  });

  assert.equal(diagnostico.status, "attention");
  assert.ok(diagnostico.alertas.some((alerta) => alerta.codigo === "expired_table_sessions"));
  assert.ok(diagnostico.alertas.some((alerta) => alerta.codigo === "reservation_notifications_failed"));
});

test("soma diagnosticos por tenant sem depender de leitura global", () => {
  const resumo = somarDiagnosticosTenant([
    {
      sessoes_mesa_ativas: "2",
      reservas_fila: "1",
      notificacoes_erro: "1",
      importacoes_invalidos_24h: "3",
      pedidos_abertos: "4",
    },
    {
      sessoes_mesa_ativas: 1,
      reservas_fila: 2,
      notificacoes_erro: 0,
      importacoes_invalidos_24h: 5,
      pedidos_abertos: 6,
      pedidos_finalizados_24h: 7,
    },
  ]);

  assert.equal(resumo.sessoesMesa.ativas, 3);
  assert.equal(resumo.reservas.fila, 3);
  assert.equal(resumo.notificacoes.erro, 1);
  assert.equal(resumo.importacoes.invalidos_24h, 8);
  assert.equal(resumo.pedidos.abertos, 10);
  assert.equal(resumo.pedidos.finalizados_24h, 7);
});
