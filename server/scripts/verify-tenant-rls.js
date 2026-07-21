const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const TABELAS = [
  "usuarios",
  "categorias",
  "produtos",
  "mesas",
  "pedidos",
  "itens_pedido",
  "chamadas",
  "sessoes_mesa",
  "configuracoes",
];

function lerTenantIds(argumentos) {
  const indice = argumentos.indexOf("--tenants");
  const valor = indice >= 0 ? argumentos[indice + 1] : "1";
  const ids = String(valor || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
  if (!ids.length) throw new Error("Informe --tenants com IDs validos, por exemplo: 1,2");
  return [...new Set(ids)];
}

async function consultarComContexto(client, restauranteId, tabela) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config($1, $2, true)", [
      "app.restaurante_id",
      String(restauranteId),
    ]);
    const { rows } = await client.query(
      `SELECT
         count(*)::integer AS total,
         count(*) FILTER (WHERE restaurante_id <> $1)::integer AS divergentes
       FROM public.${tabela}`,
      [restauranteId],
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const databaseUrl = process.env.RLS_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("RLS_DATABASE_URL ou DATABASE_URL nao configurada");
  const tenantIds = lerTenantIds(process.argv.slice(2));
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  try {
    const { rows: roleRows } = await client.query("SELECT current_user AS role");
    if (roleRows[0].role !== "autenix_backend") {
      throw new Error(`O teste exige a role autenix_backend, recebeu ${roleRows[0].role}`);
    }

    for (const tabela of TABELAS) {
      const { rows } = await client.query(
        `SELECT count(*)::integer AS total FROM public.${tabela}`,
      );
      if (rows[0].total !== 0) {
        throw new Error(`${tabela} expos ${rows[0].total} linha(s) sem contexto`);
      }
    }

    for (const restauranteId of tenantIds) {
      const resumo = {};
      for (const tabela of TABELAS) {
        const resultado = await consultarComContexto(client, restauranteId, tabela);
        if (resultado.divergentes !== 0) {
          throw new Error(`${tabela} vazou dados para o tenant ${restauranteId}`);
        }
        resumo[tabela] = resultado.total;
      }
      console.log(`Tenant ${restauranteId}: ${JSON.stringify(resumo)}`);
    }

    console.log("RLS tenant-aware validado sem vazamento entre restaurantes.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Falha no teste de RLS:", error.message);
  process.exitCode = 1;
});
