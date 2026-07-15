const path = require("path");
const { Pool } = require("pg");
const { provisionarRestaurante } = require("../lib/tenant-provisioning");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

function lerArgumentos(argumentos) {
  const resultado = {};
  for (let indice = 0; indice < argumentos.length; indice += 1) {
    const atual = argumentos[indice];
    if (!atual.startsWith("--")) continue;
    const chave = atual.slice(2);
    const proximo = argumentos[indice + 1];
    if (!proximo || proximo.startsWith("--")) {
      resultado[chave] = true;
      continue;
    }
    resultado[chave] = proximo;
    indice += 1;
  }
  return resultado;
}

async function main() {
  const args = lerArgumentos(process.argv.slice(2));
  const nome = String(args.nome || "").trim();
  const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL ou DATABASE_URL nao configurada");
  if (!nome) {
    throw new Error(
      'Uso: npm run tenant:create -- --nome "Restaurante" --slug restaurante [--login master] [--senha "senha-forte"] [--mesas 10]',
    );
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
  try {
    const resultado = await provisionarRestaurante(
      pool,
      {
        nome,
        slug: args.slug,
        login: args.login,
        senha: args.senha,
        mesas: args.mesas ?? 10,
        limite_mesas: args["limite-mesas"] ?? 20,
        plano: args.plano,
      },
      Number(process.env.BCRYPT_ROUNDS || 12),
    );

    console.log(`Restaurante criado: ${resultado.restaurante.nome}`);
    console.log(`ID: ${resultado.restaurante.id}`);
    console.log(`Slug: ${resultado.restaurante.slug}`);
    console.log(`Login master: ${resultado.master.login}`);
    if (resultado.senha_gerada) {
      console.log(`Senha master gerada: ${resultado.senha_temporaria}`);
    }
    console.log(`Acesso: /r/${resultado.restaurante.slug}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Erro ao criar restaurante:", error.message);
  process.exitCode = 1;
});
