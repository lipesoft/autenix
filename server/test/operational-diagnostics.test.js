const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarDiagnosticoOperacional,
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
