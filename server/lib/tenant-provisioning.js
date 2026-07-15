const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const PLANOS = new Set(["essencial", "profissional", "enterprise"]);
const CATEGORIAS_INICIAIS = [
  ["Entradas", 1],
  ["Pratos principais", 2],
  ["Bebidas", 3],
  ["Sobremesas", 4],
  ["Combos", 5],
];

class TenantValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TenantValidationError";
    this.statusCode = 400;
  }
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

function normalizarPlano(valor) {
  const plano = String(valor || "essencial").trim().toLowerCase();
  if (!PLANOS.has(plano)) {
    throw new TenantValidationError("Plano invalido");
  }
  return plano;
}

function normalizarInteiro(valor, campo, minimo, maximo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw new TenantValidationError(`${campo} deve ser um inteiro entre ${minimo} e ${maximo}`);
  }
  return numero;
}

function gerarSenhaTemporaria() {
  return crypto.randomBytes(18).toString("base64url");
}

function normalizarCriacaoTenant(opcoes = {}) {
  const nome = String(opcoes.nome || "").trim();
  const slug = normalizarSlug(opcoes.slug || nome);
  const login = normalizarLogin(opcoes.login || "master");
  const nomeMaster = String(opcoes.nome_master || "Master").trim();
  const senha = String(opcoes.senha || gerarSenhaTemporaria());
  const plano = normalizarPlano(opcoes.plano);
  const limiteMesas = normalizarInteiro(
    opcoes.limite_mesas ?? 20,
    "Limite de mesas",
    1,
    500,
  );
  const quantidadeMesas = normalizarInteiro(
    opcoes.mesas ?? Math.min(10, limiteMesas),
    "Quantidade de mesas",
    0,
    limiteMesas,
  );

  if (nome.length < 2 || nome.length > 120) {
    throw new TenantValidationError("Nome do restaurante deve ter entre 2 e 120 caracteres");
  }
  if (!slug || slug.length > 80) {
    throw new TenantValidationError("Slug do restaurante invalido");
  }
  if (login.length < 3 || login.length > 64) {
    throw new TenantValidationError("Login master deve ter entre 3 e 64 caracteres");
  }
  if (nomeMaster.length < 2 || nomeMaster.length > 100) {
    throw new TenantValidationError("Nome do master deve ter entre 2 e 100 caracteres");
  }
  if (senha.length < 12) {
    throw new TenantValidationError("Senha master deve ter pelo menos 12 caracteres");
  }

  return {
    nome,
    slug,
    login,
    nomeMaster,
    senha,
    plano,
    limiteMesas,
    quantidadeMesas,
    senhaGerada: !opcoes.senha,
  };
}

async function provisionarRestaurante(pool, opcoes = {}, bcryptRounds = 12) {
  const dados = normalizarCriacaoTenant(opcoes);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { rows: restaurantes } = await client.query(
      `INSERT INTO restaurantes (
         nome, slug, ativo, plano, limite_mesas, atualizado_em
       ) VALUES ($1, $2, 1, $3, $4, NOW())
       RETURNING id, nome, slug, plano, limite_mesas, ativo`,
      [dados.nome, dados.slug, dados.plano, dados.limiteMesas],
    );
    const restaurante = restaurantes[0];
    await client.query("SELECT set_config('app.restaurante_id', $1, true)", [
      String(restaurante.id),
    ]);

    const senhaHash = await bcrypt.hash(dados.senha, bcryptRounds);
    const { rows: masters } = await client.query(
      `INSERT INTO usuarios (nome, login, senha, role, ativo, restaurante_id)
       VALUES ($1, $2, $3, 'admin', 1, $4)
       RETURNING id, nome, login, role, ativo, restaurante_id`,
      [dados.nomeMaster, dados.login, senhaHash, restaurante.id],
    );

    for (const [categoria, ordem] of CATEGORIAS_INICIAIS) {
      await client.query(
        `INSERT INTO categorias (nome, ordem, ativo, restaurante_id)
         VALUES ($1, $2, 1, $3)`,
        [categoria, ordem, restaurante.id],
      );
    }

    if (dados.quantidadeMesas > 0) {
      await client.query(
        `INSERT INTO mesas (numero, status, restaurante_id)
         SELECT serie::text, 'livre', $1
         FROM generate_series(1, $2) AS serie`,
        [restaurante.id, dados.quantidadeMesas],
      );
    }

    await client.query("COMMIT");
    return {
      restaurante,
      master: masters[0],
      senha_temporaria: dados.senha,
      senha_gerada: dados.senhaGerada,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      throw new TenantValidationError("Ja existe um restaurante ou login com esses dados");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function redefinirSenhaMaster(pool, restauranteId, senhaInformada, bcryptRounds = 12) {
  const id = normalizarInteiro(restauranteId, "Restaurante", 1, 2147483647);
  const senha = String(senhaInformada || gerarSenhaTemporaria());
  if (senha.length < 12) {
    throw new TenantValidationError("Senha master deve ter pelo menos 12 caracteres");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.restaurante_id', $1, true)", [String(id)]);
    const senhaHash = await bcrypt.hash(senha, bcryptRounds);
    const { rows } = await client.query(
      `UPDATE usuarios
       SET senha = $1, ativo = 1
       WHERE id = (
         SELECT id FROM usuarios
         WHERE restaurante_id = $2 AND role = 'admin'
         ORDER BY id
         LIMIT 1
       )
       RETURNING id, nome, login, role, ativo, restaurante_id`,
      [senhaHash, id],
    );
    if (!rows[0]) {
      throw new TenantValidationError("Restaurante sem usuario master");
    }
    await client.query("COMMIT");
    return { master: rows[0], senha_temporaria: senha };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  PLANOS,
  TenantValidationError,
  gerarSenhaTemporaria,
  normalizarCriacaoTenant,
  normalizarLogin,
  normalizarPlano,
  normalizarSlug,
  provisionarRestaurante,
  redefinirSenhaMaster,
};

