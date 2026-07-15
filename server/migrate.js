const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const migrationDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

if (!migrationDatabaseUrl) {
  console.error("MIGRATION_DATABASE_URL ou DATABASE_URL nao configurada.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: migrationDatabaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function main() {
  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Aplicando migration: ${file}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("Migrations concluidas.");
}

main()
  .catch((err) => {
    console.error("Erro ao aplicar migrations:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
