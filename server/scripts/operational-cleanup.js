#!/usr/bin/env node
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const LOCK_KEY = 40721017;

function parseArgs(argv) {
  const options = {
    apply: false,
    restauranteId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--restaurante-id") {
      options.restauranteId = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--restaurante-id=")) {
      options.restauranteId = Number(arg.split("=")[1]);
    } else if (arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Argumento invalido: ${arg}`);
    }
  }

  if (
    options.restauranteId !== null
    && (!Number.isInteger(options.restauranteId) || options.restauranteId <= 0)
  ) {
    throw new Error("restaurante-id invalido");
  }

  return options;
}

function usage() {
  return [
    "Uso: node scripts/operational-cleanup.js [--apply] [--restaurante-id ID]",
    "",
    "Sem --apply, a rotina roda em dry-run e nao altera dados.",
    "A rotina expira sessoes de mesa vencidas e resume notificacoes pendentes.",
  ].join("\n");
}

function log(event, data = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...data,
  }));
}

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL nao configurada");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  });
}

async function listarRestaurantes(client, restauranteId) {
  if (restauranteId) {
    const { rows } = await client.query(
      `SELECT id
       FROM restaurantes
       WHERE id = $1
         AND excluido_em IS NULL`,
      [restauranteId],
    );
    return rows;
  }

  const { rows } = await client.query(
    `SELECT id
     FROM restaurantes
     WHERE excluido_em IS NULL
     ORDER BY id`,
  );
  return rows;
}

async function limparTenant(client, restaurante, options) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.restaurante_id', $1, true)", [
      String(restaurante.id),
    ]);

    const { rows: sessoesRows } = await client.query(
      `SELECT count(*)::integer AS total
       FROM sessoes_mesa
       WHERE restaurante_id = $1
         AND status = 'ativa'
         AND expira_em <= CURRENT_TIMESTAMP`,
      [restaurante.id],
    );

    let sessoesExpiradas = 0;
    if (options.apply) {
      const { rows } = await client.query(
        `UPDATE sessoes_mesa
         SET status = 'expirada',
             encerrado_em = COALESCE(encerrado_em, CURRENT_TIMESTAMP)
         WHERE restaurante_id = $1
           AND status = 'ativa'
           AND expira_em <= CURRENT_TIMESTAMP
         RETURNING id`,
        [restaurante.id],
      );
      sessoesExpiradas = rows.length;
    } else {
      sessoesExpiradas = Number(sessoesRows[0]?.total || 0);
    }

    const { rows: notificacoesRows } = await client.query(
      `SELECT count(*)::integer AS total
       FROM reservas_notificacoes
       WHERE restaurante_id = $1
         AND status IN ('pendente', 'erro')
         AND criado_em < CURRENT_TIMESTAMP - INTERVAL '1 hour'`,
      [restaurante.id],
    );

    await client.query("COMMIT");
    return {
      restaurante_id: restaurante.id,
      dry_run: !options.apply,
      sessoes_mesa_expiradas: sessoesExpiradas,
      notificacoes_pendentes_antigas: Number(notificacoesRows[0]?.total || 0),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const pool = createPool();
  const lockClient = await pool.connect();

  try {
    const { rows: lockRows } = await lockClient.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [LOCK_KEY],
    );
    if (!lockRows[0]?.locked) {
      log("operational_cleanup_skipped", { motivo: "rotina_ja_em_execucao" });
      process.exitCode = 2;
      return;
    }

    log("operational_cleanup_started", {
      dry_run: !options.apply,
      restaurante_id: options.restauranteId,
    });

    const restaurantes = await listarRestaurantes(lockClient, options.restauranteId);
    for (const restaurante of restaurantes) {
      const client = await pool.connect();
      try {
        const resumo = await limparTenant(client, restaurante, options);
        log("operational_cleanup_tenant", resumo);
      } finally {
        client.release();
      }
    }

    log("operational_cleanup_finished", {
      dry_run: !options.apply,
      restaurantes: restaurantes.length,
    });
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    lockClient.release();
    await pool.end();
  }
}

main().catch((error) => {
  log("operational_cleanup_failed", { erro: error.message });
  process.exitCode = 1;
});
