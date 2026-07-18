const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { normalizarWhiteLabel } = require("./branding");

const PLANOS_CATALOGO = Object.freeze({
  essencial: Object.freeze({
    nome: "Essencial",
    limiteMesas: 20,
    limiteUsuarios: 5,
    limiteProdutos: 120,
    mensalidadeCentavos: 9900,
  }),
  profissional: Object.freeze({
    nome: "Profissional",
    limiteMesas: 60,
    limiteUsuarios: 15,
    limiteProdutos: 400,
    mensalidadeCentavos: 19900,
  }),
  enterprise: Object.freeze({
    nome: "Enterprise",
    limiteMesas: 500,
    limiteUsuarios: 100,
    limiteProdutos: 2000,
    mensalidadeCentavos: 0,
  }),
});

const PLANOS = new Set(Object.keys(PLANOS_CATALOGO));
const CICLOS_COBRANCA = new Set(["mensal", "anual", "experimental", "personalizado"]);
const STATUS_COBRANCA = new Set(["trial", "ativo", "pendente", "atrasado", "isento"]);
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

function normalizarValorMonetarioCentavos(valor) {
  const numero = Number(valor ?? 0);
  if (!Number.isInteger(numero) || numero < 0 || numero > 99999900) {
    throw new TenantValidationError("Mensalidade deve ser um valor valido");
  }
  return numero;
}

function normalizarInteiro(valor, campo, minimo, maximo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw new TenantValidationError(`${campo} deve ser um inteiro entre ${minimo} e ${maximo}`);
  }
  return numero;
}

function normalizarDataOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  const texto = String(valor).trim();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? new Date(`${texto}T00:00:00.000Z`)
    : new Date(texto);
  if (Number.isNaN(data.getTime())) {
    throw new TenantValidationError(`${campo} invalida`);
  }
  return data.toISOString().slice(0, 10);
}

function normalizarOpcao(valor, opcoes, padrao, campo) {
  const normalizado = String(valor || padrao).trim().toLowerCase();
  if (!opcoes.has(normalizado)) {
    throw new TenantValidationError(`${campo} invalido`);
  }
  return normalizado;
}

function normalizarTextoOpcional(valor, limite, campo) {
  const texto = String(valor || "").trim();
  if (texto.length > limite) {
    throw new TenantValidationError(`${campo} deve ter no maximo ${limite} caracteres`);
  }
  return texto || null;
}

function gerarSenhaTemporaria() {
  return crypto.randomBytes(18).toString("base64url");
}

function normalizarPlanoDetalhes(opcoes = {}) {
  const plano = normalizarPlano(opcoes.plano);
  const padrao = PLANOS_CATALOGO[plano];
  return {
    plano,
    limiteMesas: normalizarInteiro(
      opcoes.limite_mesas ?? padrao.limiteMesas,
      "Limite de mesas",
      1,
      500,
    ),
    limiteUsuarios: normalizarInteiro(
      opcoes.limite_usuarios ?? padrao.limiteUsuarios,
      "Limite de usuarios",
      1,
      500,
    ),
    limiteProdutos: normalizarInteiro(
      opcoes.limite_produtos ?? padrao.limiteProdutos,
      "Limite de produtos",
      1,
      10000,
    ),
    mensalidadeCentavos: normalizarValorMonetarioCentavos(
      opcoes.mensalidade_centavos ?? padrao.mensalidadeCentavos,
    ),
    cicloCobranca: normalizarOpcao(
      opcoes.ciclo_cobranca,
      CICLOS_COBRANCA,
      "mensal",
      "Ciclo de cobranca",
    ),
    statusCobranca: normalizarOpcao(
      opcoes.status_cobranca,
      STATUS_COBRANCA,
      "trial",
      "Status comercial",
    ),
    trialTerminaEm: normalizarDataOpcional(opcoes.trial_termina_em, "Data de fim do teste"),
    proximaCobrancaEm: normalizarDataOpcional(
      opcoes.proxima_cobranca_em,
      "Data da proxima cobranca",
    ),
    observacoesPlano: normalizarTextoOpcional(
      opcoes.observacoes_plano,
      500,
      "Observacoes do plano",
    ),
  };
}

function normalizarCriacaoTenant(opcoes = {}) {
  const nome = String(opcoes.nome || "").trim();
  const slug = normalizarSlug(opcoes.slug || nome);
  const login = normalizarLogin(opcoes.login || "master");
  const nomeMaster = String(opcoes.nome_master || "Master").trim();
  const senha = String(opcoes.senha || gerarSenhaTemporaria());
  const planoDetalhes = normalizarPlanoDetalhes(opcoes);
  const marca = normalizarWhiteLabel(opcoes);
  const quantidadeMesas = normalizarInteiro(
    opcoes.mesas ?? Math.min(10, planoDetalhes.limiteMesas),
    "Quantidade de mesas",
    0,
    planoDetalhes.limiteMesas,
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
    ...planoDetalhes,
    marca,
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
         nome, slug, ativo, plano, limite_mesas, limite_usuarios,
         limite_produtos, mensalidade_centavos, ciclo_cobranca,
         status_cobranca, trial_termina_em, proxima_cobranca_em,
         observacoes_plano, white_label_ativo, nome_exibicao, logo_url,
         cor_primaria, cor_secundaria, whatsapp_numero, atualizado_em
       ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 $13, $14, $15, $16, $17, $18, NOW())
       RETURNING id, nome, slug, plano, limite_mesas, limite_usuarios,
                 limite_produtos, mensalidade_centavos, ciclo_cobranca,
                 status_cobranca, trial_termina_em, proxima_cobranca_em,
                 observacoes_plano, white_label_ativo, nome_exibicao, logo_url,
                 cor_primaria, cor_secundaria, whatsapp_numero, ativo`,
      [
        dados.nome,
        dados.slug,
        dados.plano,
        dados.limiteMesas,
        dados.limiteUsuarios,
        dados.limiteProdutos,
        dados.mensalidadeCentavos,
        dados.cicloCobranca,
        dados.statusCobranca,
        dados.trialTerminaEm,
        dados.proximaCobrancaEm,
        dados.observacoesPlano,
        dados.marca.white_label_ativo,
        dados.marca.nome_exibicao,
        dados.marca.logo_url,
        dados.marca.cor_primaria,
        dados.marca.cor_secundaria,
        dados.marca.whatsapp_numero,
      ],
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
  CICLOS_COBRANCA,
  PLANOS,
  PLANOS_CATALOGO,
  STATUS_COBRANCA,
  TenantValidationError,
  gerarSenhaTemporaria,
  normalizarCriacaoTenant,
  normalizarLogin,
  normalizarPlano,
  normalizarPlanoDetalhes,
  normalizarSlug,
  provisionarRestaurante,
  redefinirSenhaMaster,
};
