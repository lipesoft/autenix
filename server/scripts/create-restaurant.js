const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

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

function normalizarSlug(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizarLogin(valor) {
  return String(valor || "master")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "_");
}

async function main() {
  const args = lerArgumentos(process.argv.slice(2));
  const nome = String(args.nome || "").trim();
  const slug = normalizarSlug(args.slug || nome);
  const login = normalizarLogin(args.login || "master");
  const senhaGerada = !args.senha;
  const senha = String(args.senha || crypto.randomBytes(18).toString("base64url"));
  const quantidadeMesas = Number(args.mesas ?? 10);
  const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL ou DATABASE_URL nao configurada");
  if (!nome || !slug) {
    throw new Error(
      'Uso: npm run tenant:create -- --nome "Restaurante" --slug restaurante [--login master] [--senha "senha-forte"] [--mesas 10]',
    );
  }
  if (senha.length < 12) throw new Error("A senha master deve ter pelo menos 12 caracteres");
  if (!Number.isInteger(quantidadeMesas) || quantidadeMesas < 0 || quantidadeMesas > 500) {
    throw new Error("A quantidade de mesas deve ser um inteiro entre 0 e 500");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { rows: restaurantes } = await client.query(
      `INSERT INTO restaurantes (nome, slug, ativo)
       VALUES ($1, $2, 1)
       RETURNING id, nome, slug`,
      [nome, slug],
    );
    const restaurante = restaurantes[0];
    await client.query("SELECT set_config('app.restaurante_id', $1, true)", [
      String(restaurante.id),
    ]);

    const senhaHash = await bcrypt.hash(senha, Number(process.env.BCRYPT_ROUNDS || 12));
    await client.query(
      `INSERT INTO usuarios (nome, login, senha, role, ativo, restaurante_id)
       VALUES ('Master', $1, $2, 'admin', 1, $3)`,
      [login, senhaHash, restaurante.id],
    );

    const categorias = [
      ["Entradas", 1],
      ["Pratos principais", 2],
      ["Bebidas", 3],
      ["Sobremesas", 4],
      ["Combos", 5],
    ];
    for (const [categoria, ordem] of categorias) {
      await client.query(
        `INSERT INTO categorias (nome, ordem, ativo, restaurante_id)
         VALUES ($1, $2, 1, $3)`,
        [categoria, ordem, restaurante.id],
      );
    }

    for (let numero = 1; numero <= quantidadeMesas; numero += 1) {
      await client.query(
        `INSERT INTO mesas (numero, status, restaurante_id)
         VALUES ($1, 'livre', $2)`,
        [String(numero), restaurante.id],
      );
    }

    await client.query("COMMIT");

    console.log(`Restaurante criado: ${restaurante.nome}`);
    console.log(`ID: ${restaurante.id}`);
    console.log(`Slug: ${restaurante.slug}`);
    console.log(`Login master: ${login}`);
    if (senhaGerada) console.log(`Senha master gerada: ${senha}`);
    console.log(`Acesso: /r/${restaurante.slug}`);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      throw new Error("Ja existe um restaurante ou login com esses dados");
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Erro ao criar restaurante:", error.message);
  process.exitCode = 1;
});
