function inteiro(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarContadores(row = {}, campos = []) {
  return Object.fromEntries(
    campos.map((campo) => [campo, inteiro(row[campo])]),
  );
}

function montarAlertasDiagnostico(diagnostico) {
  const alertas = [];

  if (diagnostico.database.status !== "ok") {
    alertas.push({
      codigo: "database_unavailable",
      severidade: "critico",
      mensagem: "Banco de dados indisponivel",
    });
  }

  if (diagnostico.storage.status !== "configured") {
    alertas.push({
      codigo: "storage_not_configured",
      severidade: "atencao",
      mensagem: "Storage nao configurado para uploads",
    });
  }

  if (diagnostico.sessoes_mesa.expiradas_pendentes > 0) {
    alertas.push({
      codigo: "expired_table_sessions",
      severidade: "atencao",
      mensagem: "Existem sessoes de mesa vencidas aguardando limpeza",
      total: diagnostico.sessoes_mesa.expiradas_pendentes,
    });
  }

  if (diagnostico.notificacoes.erro > 0) {
    alertas.push({
      codigo: "reservation_notifications_failed",
      severidade: "atencao",
      mensagem: "Existem notificacoes de reserva com erro",
      total: diagnostico.notificacoes.erro,
    });
  }

  if (diagnostico.notificacoes.antigas > 0) {
    alertas.push({
      codigo: "stale_reservation_notifications",
      severidade: "atencao",
      mensagem: "Existem notificacoes antigas sem processamento final",
      total: diagnostico.notificacoes.antigas,
    });
  }

  if (diagnostico.reservas.atrasadas > 0) {
    alertas.push({
      codigo: "stale_reservations",
      severidade: "info",
      mensagem: "Existem reservas antigas ainda abertas",
      total: diagnostico.reservas.atrasadas,
    });
  }

  return alertas;
}

function statusDiagnostico(alertas) {
  if (alertas.some((alerta) => alerta.severidade === "critico")) return "degraded";
  if (alertas.length > 0) return "attention";
  return "healthy";
}

function montarDiagnosticoOperacional({
  app,
  version,
  environment,
  database,
  storage,
  restaurantes,
  sessoesMesa,
  reservas,
  notificacoes,
  importacoes,
  pedidos,
}) {
  const diagnostico = {
    status: "healthy",
    app,
    version,
    environment,
    timestamp: new Date().toISOString(),
    database: {
      status: database?.status === "ok" ? "ok" : "unavailable",
      latency_ms: inteiro(database?.latency_ms),
    },
    storage,
    restaurantes: normalizarContadores(restaurantes, [
      "total",
      "ativos",
      "inativos",
      "arquivados",
    ]),
    sessoes_mesa: normalizarContadores(sessoesMesa, [
      "ativas",
      "expiradas_pendentes",
      "encerradas_24h",
    ]),
    reservas: normalizarContadores(reservas, [
      "pendentes",
      "confirmadas",
      "fila",
      "chamadas",
      "atrasadas",
    ]),
    notificacoes: normalizarContadores(notificacoes, [
      "pendentes",
      "erro",
      "sem_provedor",
      "antigas",
    ]),
    importacoes: normalizarContadores(importacoes, [
      "ultimas_24h",
      "revertidas_24h",
      "invalidos_24h",
    ]),
    pedidos: normalizarContadores(pedidos, [
      "abertos",
      "finalizados_24h",
    ]),
  };

  diagnostico.alertas = montarAlertasDiagnostico(diagnostico);
  diagnostico.status = statusDiagnostico(diagnostico.alertas);
  return diagnostico;
}

module.exports = {
  montarAlertasDiagnostico,
  montarDiagnosticoOperacional,
  statusDiagnostico,
};
