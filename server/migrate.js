const path = require("path");
const { Pool } = require("pg");
const {
  carregarMigrations,
  listarPendentes,
  validarHistorico,
} = require("./lib/migration-runner");

require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
require("dotenv").config({ quiet: true });

const migrationDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
const baseline = process.argv.includes("--baseline");
const somenteStatus = process.argv.includes("--status");

if (!migrationDatabaseUrl) {
  console.error("MIGRATION_DATABASE_URL ou DATABASE_URL nao configurada.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: migrationDatabaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function prepararHistorico(client) {
  await client.query("CREATE SCHEMA IF NOT EXISTS private");
  await client.query("REVOKE ALL ON SCHEMA private FROM PUBLIC");
  await client.query(`
    CREATE TABLE IF NOT EXISTS private.autenix_schema_migrations (
      arquivo TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      aplicado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      aplicado_por TEXT NOT NULL DEFAULT CURRENT_USER,
      duracao_ms INTEGER NOT NULL DEFAULT 0,
      baseline BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await client.query(
    "REVOKE ALL ON TABLE private.autenix_schema_migrations FROM PUBLIC",
  );
}

async function carregarAplicadas(client) {
  const { rows } = await client.query(`
    SELECT arquivo, checksum, aplicado_em, aplicado_por, duracao_ms, baseline
    FROM private.autenix_schema_migrations
    ORDER BY arquivo
  `);
  return rows;
}

async function bancoPossuiSchemaAutenix(client) {
  const { rows } = await client.query(`
    SELECT to_regclass('public.usuarios') IS NOT NULL
       AND to_regclass('public.restaurantes') IS NOT NULL AS existe
  `);
  return rows[0]?.existe === true;
}

async function registrarBaseline(client, migrations) {
  await client.query("BEGIN");
  try {
    for (const migration of migrations) {
      await client.query(
        `INSERT INTO private.autenix_schema_migrations
           (arquivo, checksum, duracao_ms, baseline)
         VALUES ($1, $2, 0, TRUE)
         ON CONFLICT (arquivo) DO NOTHING`,
        [migration.arquivo, migration.checksum],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function aplicarMigration(client, migration) {
  const inicio = Date.now();
  await client.query("BEGIN");
  try {
    await client.query(migration.sql);
    await client.query(
      `INSERT INTO private.autenix_schema_migrations
         (arquivo, checksum, duracao_ms)
       VALUES ($1, $2, $3)`,
      [migration.arquivo, migration.checksum, Date.now() - inicio],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const migrations = carregarMigrations(path.join(__dirname, "migrations"));
  const client = await pool.connect();
  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext('autenix_schema_migrations'))",
    );
    await prepararHistorico(client);
    let aplicadas = await carregarAplicadas(client);
    const schemaExistente = await bancoPossuiSchemaAutenix(client);

    if (aplicadas.length === 0 && schemaExistente) {
      if (!baseline) {
        throw new Error(
          "Banco existente sem historico. Execute uma vez: npm run migrate -- --baseline",
        );
      }
      await registrarBaseline(client, migrations);
      aplicadas = await carregarAplicadas(client);
      console.log(`Baseline registrado: ${aplicadas.length} migrations.`);
    } else if (baseline && !schemaExistente) {
      throw new Error("Baseline recusado: o banco ainda nao possui o schema do Autenix.");
    }

    validarHistorico(migrations, aplicadas);
    const pendentes = listarPendentes(migrations, aplicadas);
    console.log(
      `Status: ${aplicadas.length} aplicadas, ${pendentes.length} pendentes.`,
    );
    if (somenteStatus) return;

    for (const migration of pendentes) {
      console.log(`Aplicando migration: ${migration.arquivo}`);
      await aplicarMigration(client, migration);
    }
    console.log("Migrations concluidas.");
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('autenix_schema_migrations'))")
      .catch(() => {});
    client.release();
  }
}

main()
  .catch((error) => {
    console.error("Erro ao aplicar migrations:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
