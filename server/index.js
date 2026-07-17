const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const multer = require("multer");
const path = require("path");
const os = require("os");
const {
  BrandingValidationError,
  marcaPublica,
  normalizarWhiteLabel,
} = require("./lib/branding");
const {
  TenantValidationError,
  normalizarPlanoDetalhes,
  normalizarSlug: normalizarSlugTenant,
  provisionarRestaurante,
  redefinirSenhaMaster,
} = require("./lib/tenant-provisioning");
const {
  TIPOS_IMPORTACAO,
  ImportacaoValidationError,
  gerarCsvModelo,
  gerarSenhaTemporaria,
  normalizarBusca,
  normalizarLinhasImportacao,
} = require("./lib/importacao");
const {
  ALLOWED_IMAGE_MIMES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  UploadValidationError,
  StorageConfigurationError,
  enviarImagemRestaurante,
  normalizarTipo,
} = require("./lib/storage");
const {
  ReservasValidationError,
  normalizarCriacaoReserva,
  normalizarFiltrosReservas,
  normalizarStatusReserva,
} = require("./lib/reservas");
const {
  MesaSessionValidationError,
  calcularExpiracaoSessaoMesa,
  criarTokenSessaoMesa,
  hashTokenSessaoMesa,
} = require("./lib/mesa-session");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const PLATFORM_JWT_EXPIRES_IN = process.env.PLATFORM_JWT_EXPIRES_IN || "2h";
const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const PUBLIC_APP_URL = String(
  process.env.PUBLIC_APP_URL || "https://autenix.vercel.app",
).replace(/\/$/, "");

if (!process.env.DATABASE_URL) {
  const msg = "DATABASE_URL nao configurada.";
  if (isProduction) throw new Error(msg);
  console.warn(`AVISO: ${msg} Configure .env para conectar ao PostgreSQL/Supabase.`);
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET e obrigatorio em producao.");
}

if (isProduction && !process.env.CORS_ORIGIN) {
  throw new Error("CORS_ORIGIN e obrigatorio em producao.");
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const devOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];
const configuredOrigins = parseOrigins(process.env.CORS_ORIGIN);
const allowedOrigins = new Set(
  isProduction ? configuredOrigins : [...configuredOrigins, ...devOrigins],
);

function validateCorsOrigin(origin, callback) {
  if (!origin || allowedOrigins.has(origin)) return callback(null, true);
  return callback(new Error("Origem nao permitida pelo CORS."));
}

const corsOptions = {
  origin: validateCorsOrigin,
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

if (isProduction || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Falha no health check do banco:", error.message);
    res.status(503).json({ status: "indisponivel" });
  }
});

app.get("/api/restaurantes/:slug/publico", async (req, res) => {
  try {
    const restaurante = await buscarRestaurantePorSlug(req.params.slug);
    if (!restaurante) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }
    return res.json(marcaPublica(restaurante));
  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
});

const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de login. Tente novamente em 1 minuto." },
});

const uploadImagem = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      return callback(new UploadValidationError("Use uma imagem JPG, PNG, WEBP ou GIF"));
    }
    return callback(null, true);
  },
});

function responderErroUpload(res, error) {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ erro: `Imagem acima do limite de ${MAX_IMAGE_MB}MB` });
  }

  const statusCode = error.statusCode || 500;
  if (statusCode >= 500 && !(error instanceof StorageConfigurationError)) {
    console.error("Falha no upload de imagem:", error.message);
  }
  return res.status(statusCode).json({
    erro: statusCode >= 500 ? "Nao foi possivel enviar a imagem agora" : error.message,
  });
}

function processarUploadImagem(req, res, next) {
  uploadImagem.single("imagem")(req, res, (error) => {
    if (error) return responderErroUpload(res, error);
    return next();
  });
}

// ─── BANCO DE DADOS (PostgreSQL) ───────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

// Helper: executa query com log de erro
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function withTenantTransaction(restauranteId, callback) {
  const tenantId = Number(restauranteId);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error("Restaurante invalido");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.restaurante_id', $1, true)", [
      String(tenantId),
    ]);
    const result = await callback(client, tenantId);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function tenantQuery(restauranteId, sql, params = []) {
  return withTenantTransaction(restauranteId, (client) =>
    client.query(sql, params),
  );
}

function normalizarLogin(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "_");
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

async function buscarRestaurantePorSlug(slugInformado) {
  const slug = normalizarSlug(slugInformado || "autenix");
  if (!slug) return null;
  const { rows } = await query(
    `SELECT id, nome, slug, ativo, white_label_ativo, nome_exibicao,
            logo_url, cor_primaria, cor_secundaria
     FROM restaurantes
     WHERE slug = $1 AND ativo = 1
     LIMIT 1`,
    [slug],
  );
  return rows[0] || null;
}

async function buscarRestauranteDaMesa(mesaId, slugInformado) {
  const restaurante = await buscarRestaurantePorSlug(slugInformado);
  if (restaurante) {
    const { rows } = await tenantQuery(
      restaurante.id,
      "SELECT id, numero, status, restaurante_id FROM mesas WHERE id = $1",
      [mesaId],
    );
    return rows[0] ? { restaurante, mesa: rows[0] } : null;
  }

  return null;
}

function erroSessaoMesa(message = "Sessao da mesa invalida ou expirada") {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function tokenSessaoMesaDoRequest(req) {
  return (
    req.body?.sessao ||
    req.query?.sessao ||
    req.headers["x-mesa-session"] ||
    req.headers["x-mesa-sessao"]
  );
}

function queryTenantComCliente(restauranteId, client) {
  if (client) return (sql, params) => client.query(sql, params);
  return (sql, params) => tenantQuery(restauranteId, sql, params);
}

async function validarSessaoMesa(restauranteId, mesaId, token, client = null) {
  let tokenHash;
  try {
    tokenHash = hashTokenSessaoMesa(token);
  } catch (error) {
    if (error instanceof MesaSessionValidationError) {
      throw erroSessaoMesa(error.message);
    }
    throw error;
  }

  const tenantId = Number(restauranteId);
  const mesaIdNumero = Number(mesaId);
  const executar = queryTenantComCliente(tenantId, client);
  const { rows } = await executar(
    `SELECT id, status, expira_em
     FROM sessoes_mesa
     WHERE restaurante_id = $1
       AND mesa_id = $2
       AND token_hash = $3
     LIMIT 1`,
    [tenantId, mesaIdNumero, tokenHash],
  );
  const sessao = rows[0];
  if (!sessao) throw erroSessaoMesa();

  const expiraEm = new Date(sessao.expira_em).getTime();
  if (sessao.status !== "ativa" || !Number.isFinite(expiraEm) || expiraEm <= Date.now()) {
    if (sessao.status === "ativa") {
      await executar(
        `UPDATE sessoes_mesa
         SET status = 'expirada',
             encerrado_em = COALESCE(encerrado_em, CURRENT_TIMESTAMP)
         WHERE id = $1 AND restaurante_id = $2`,
        [sessao.id, tenantId],
      );
    }
    throw erroSessaoMesa();
  }

  await executar(
    `UPDATE sessoes_mesa
     SET ultimo_acesso_em = CURRENT_TIMESTAMP
     WHERE id = $1 AND restaurante_id = $2`,
    [sessao.id, tenantId],
  );
  return sessao;
}

async function validarSessaoMesaRequest(req, contexto, client = null) {
  return validarSessaoMesa(
    contexto.restaurante.id,
    contexto.mesa.id,
    tokenSessaoMesaDoRequest(req),
    client,
  );
}

async function criarSessaoMesa(restauranteId, mesaId, usuarioId = null) {
  const token = criarTokenSessaoMesa();
  const tokenHash = hashTokenSessaoMesa(token);
  const expiraEm = calcularExpiracaoSessaoMesa(
    process.env.MESA_SESSION_TTL_HOURS || 12,
  );

  const resultado = await withTenantTransaction(restauranteId, async (client) => {
    const { rows: mesas } = await client.query(
      `SELECT id, numero, status, restaurante_id
       FROM mesas
       WHERE id = $1 AND restaurante_id = $2`,
      [mesaId, restauranteId],
    );
    if (!mesas[0]) {
      const error = new Error("Mesa nao encontrada");
      error.statusCode = 404;
      throw error;
    }

    await client.query(
      `UPDATE sessoes_mesa
       SET status = 'encerrada',
           encerrado_em = COALESCE(encerrado_em, CURRENT_TIMESTAMP)
       WHERE mesa_id = $1
         AND restaurante_id = $2
       AND status = 'ativa'`,
      [mesaId, restauranteId],
    );

    const { rows: mesasAtualizadas } = await client.query(
      `UPDATE mesas
       SET status = 'ocupada'
       WHERE id = $1 AND restaurante_id = $2
       RETURNING id, numero, status, restaurante_id`,
      [mesaId, restauranteId],
    );

    const { rows: sessoes } = await client.query(
      `INSERT INTO sessoes_mesa
         (restaurante_id, mesa_id, token_hash, status, expira_em, criado_por_usuario_id)
       VALUES ($1, $2, $3, 'ativa', $4, $5)
       RETURNING id, expira_em`,
      [restauranteId, mesaId, tokenHash, expiraEm, usuarioId],
    );

    return {
      mesa: mesasAtualizadas[0] || mesas[0],
      sessao: sessoes[0],
    };
  });

  return {
    ...resultado,
    token,
  };
}

async function encerrarSessoesMesa(restauranteId, mesaId, client = null) {
  const executar = queryTenantComCliente(restauranteId, client);
  await executar(
    `UPDATE sessoes_mesa
     SET status = 'encerrada',
         encerrado_em = COALESCE(encerrado_em, CURRENT_TIMESTAMP)
     WHERE mesa_id = $1
       AND restaurante_id = $2
       AND status = 'ativa'`,
    [mesaId, restauranteId],
  );
}

function montarUrlMesa(restauranteSlug, mesaId, token) {
  return `${PUBLIC_APP_URL}/r/${restauranteSlug}/mesa/${mesaId}?sessao=${encodeURIComponent(token)}`;
}

async function montarRespostaAtendimento(restauranteSlug, resultado) {
  const url = montarUrlMesa(restauranteSlug, resultado.mesa.id, resultado.token);
  const qr = await QRCode.toDataURL(url);
  return {
    url,
    qr,
    mesa: resultado.mesa,
    expira_em: resultado.sessao.expira_em,
  };
}

function isBcryptHash(valor) {
  return typeof valor === "string" && /^\$2[aby]\$\d{2}\$/.test(valor);
}

async function hashSenha(senha) {
  return bcrypt.hash(String(senha), BCRYPT_ROUNDS);
}

async function senhaConfere(senhaInformada, senhaSalva) {
  if (!senhaSalva) return false;
  if (isBcryptHash(senhaSalva)) {
    return bcrypt.compare(String(senhaInformada), senhaSalva);
  }
  return String(senhaInformada) === String(senhaSalva);
}

function gerarToken(usuario) {
  return jwt.sign(
    {
      sub: String(usuario.id),
      id: usuario.id,
      role: usuario.role,
      restaurante_id: usuario.restaurante_id,
      restaurante_slug: usuario.restaurante_slug,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    role: usuario.role,
    login: usuario.login,
    restaurante_id: usuario.restaurante_id,
    restaurante_slug: usuario.restaurante_slug,
    restaurante_nome: usuario.restaurante_nome,
  };
}

function usuarioPlataformaPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    login: usuario.login,
    role: usuario.role,
  };
}

function gerarTokenPlataforma(usuario) {
  return jwt.sign(
    {
      sub: String(usuario.id),
      id: usuario.id,
      role: "platform_admin",
      scope: "platform",
    },
    JWT_SECRET,
    { expiresIn: PLATFORM_JWT_EXPIRES_IN },
  );
}

function autenticarJWT(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [tipo, token] = authHeader.split(" ");
  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ erro: "Token de autenticacao ausente" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const restauranteId = Number(payload.restaurante_id);
    if (!Number.isInteger(restauranteId) || restauranteId <= 0) {
      return res.status(401).json({ erro: "Token sem contexto de restaurante" });
    }
    req.user = {
      id: Number(payload.sub || payload.id),
      role: payload.role,
      restaurante_id: restauranteId,
      restaurante_slug: payload.restaurante_slug,
    };
    return next();
  } catch (e) {
    return res.status(401).json({ erro: "Token invalido ou expirado" });
  }
}

function autenticarJWTSePresente(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [tipo, token] = authHeader.split(" ");
  if (tipo !== "Bearer" || !token) return next();

  try {
    req.user = usuarioDoToken(token);
    return next();
  } catch {
    return res.status(401).json({ erro: "Token invalido ou expirado" });
  }
}

async function autenticarPlataforma(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [tipo, token] = authHeader.split(" ");
  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ erro: "Token da plataforma ausente" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.scope !== "platform" || payload.role !== "platform_admin") {
      return res.status(403).json({ erro: "Acesso exclusivo da plataforma" });
    }

    const { rows } = await query(
      `SELECT id, nome, login, role, ativo
       FROM platform_usuarios
       WHERE id = $1 AND role = 'platform_admin' AND ativo = TRUE`,
      [Number(payload.sub || payload.id)],
    );
    if (!rows[0]) {
      return res.status(401).json({ erro: "Acesso da plataforma revogado" });
    }
    req.platformUser = rows[0];
    return next();
  } catch {
    return res.status(401).json({ erro: "Token da plataforma invalido ou expirado" });
  }
}

function usuarioDoToken(token) {
  if (!token) return null;
  const payload = jwt.verify(token, JWT_SECRET);
  const restauranteId = Number(payload.restaurante_id);
  if (!Number.isInteger(restauranteId) || restauranteId <= 0) {
    throw new Error("Token sem contexto de restaurante");
  }
  return {
    id: Number(payload.sub || payload.id),
    role: payload.role,
    restaurante_id: restauranteId,
    restaurante_slug: payload.restaurante_slug,
  };
}

function autorizarRoles(...rolesPermitidas) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ erro: "Nao autenticado" });
    if (req.user.role === "admin" || rolesPermitidas.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ erro: "Permissao insuficiente" });
  };
}

function protegerListagemPedidos(req, res, next) {
  if (req.query.mesa_id) return autenticarJWTSePresente(req, res, next);
  return autenticarJWT(req, res, () =>
    autorizarRoles("garcom", "cozinha", "financeiro")(req, res, next),
  );
}

async function migrarSenhasLegadas(restauranteId) {
  const { rows } = await tenantQuery(
    restauranteId,
    "SELECT id, senha FROM usuarios WHERE restaurante_id = $1",
    [restauranteId],
  );
  for (const usuario of rows) {
    if (usuario.senha && !isBcryptHash(usuario.senha)) {
      const senhaHash = await hashSenha(usuario.senha);
      await tenantQuery(
        restauranteId,
        "UPDATE usuarios SET senha = $1 WHERE id = $2 AND restaurante_id = $3",
        [senhaHash, usuario.id, restauranteId],
      );
    }
  }
}

async function criarAdminInicialSeNecessario(restauranteId) {
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminPasswordHash) return;

  if (!isBcryptHash(adminPasswordHash)) {
    const msg = "ADMIN_PASSWORD_HASH deve ser um hash bcrypt valido.";
    if (isProduction) throw new Error(msg);
    console.warn(`AVISO: ${msg}`);
    return;
  }

  const adminLogin = normalizarLogin(process.env.ADMIN_LOGIN || "admin");
  const { rows: admins } = await tenantQuery(
    restauranteId,
    "SELECT id FROM usuarios WHERE role = 'admin' AND restaurante_id = $1 LIMIT 1",
    [restauranteId],
  );
  if (admins[0]) return;

  const { rows: porLogin } = await tenantQuery(
    restauranteId,
    "SELECT id FROM usuarios WHERE login = $1 AND restaurante_id = $2 LIMIT 1",
    [adminLogin, restauranteId],
  );

  if (porLogin[0]) {
    await tenantQuery(
      restauranteId,
      `UPDATE usuarios SET role = 'admin', senha = $1, ativo = 1
       WHERE id = $2 AND restaurante_id = $3`,
      [adminPasswordHash, porLogin[0].id, restauranteId],
    );
    return;
  }

  await tenantQuery(
    restauranteId,
    `INSERT INTO usuarios (nome, login, senha, role, ativo, restaurante_id)
     VALUES ($1, $2, $3, $4, 1, $5)`,
    ["Administrador", adminLogin, adminPasswordHash, "admin", restauranteId],
  );
}

// ─── INICIALIZAÇÃO DO BANCO ────────────────────────────────────────────────
async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      login TEXT,
      role TEXT NOT NULL DEFAULT 'garcom',
      senha TEXT NOT NULL,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      categoria_id INTEGER,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL NOT NULL,
      imagem TEXT,
      disponivel INTEGER DEFAULT 1,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );

    CREATE TABLE IF NOT EXISTS mesas (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'livre',
      forma_pagamento TEXT,
      obs_pagamento TEXT
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      numero_dia INTEGER,
      mesa_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pendente',
      nome_cliente TEXT,
      garcom_id INTEGER,
      garcom_nome TEXT,
      forma_pagamento TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mesa_id) REFERENCES mesas(id)
    );

    CREATE TABLE IF NOT EXISTS itens_pedido (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      observacao TEXT,
      status TEXT DEFAULT 'pendente',
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    );

    CREATE TABLE IF NOT EXISTS chamadas (
      id SERIAL PRIMARY KEY,
      mesa_id INTEGER NOT NULL,
      motivo TEXT DEFAULT 'garcom',
      nome_cliente TEXT,
      atendida INTEGER DEFAULT 0,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id SERIAL PRIMARY KEY,
      restaurante_id INTEGER NOT NULL,
      mesa_id INTEGER,
      nome_cliente TEXT NOT NULL,
      telefone TEXT NOT NULL,
      email TEXT,
      data_reserva DATE NOT NULL,
      horario TIME NOT NULL,
      quantidade_pessoas INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'pendente',
      observacao TEXT,
      origem TEXT NOT NULL DEFAULT 'publica',
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      confirmada_em TIMESTAMP,
      cancelada_em TIMESTAMP,
      concluida_em TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

    ALTER TABLE categorias
      ADD COLUMN IF NOT EXISTS ativo INTEGER NOT NULL DEFAULT 1;
  `);

  const restaurantePadrao = await buscarRestaurantePorSlug("autenix");
  if (!restaurantePadrao) {
    throw new Error("Execute npm run migrate antes de iniciar o backend");
  }
  const restauranteId = restaurantePadrao.id;

  await query(`
    CREATE TABLE IF NOT EXISTS sessoes_mesa (
      id SERIAL PRIMARY KEY,
      restaurante_id INTEGER NOT NULL,
      mesa_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativa',
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expira_em TIMESTAMP NOT NULL,
      encerrado_em TIMESTAMP,
      ultimo_acesso_em TIMESTAMP,
      criado_por_usuario_id INTEGER
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sessoes_mesa_ativa_unica
      ON sessoes_mesa (restaurante_id, mesa_id)
      WHERE status = 'ativa';

    CREATE INDEX IF NOT EXISTS idx_sessoes_mesa_restaurante_mesa_status
      ON sessoes_mesa (restaurante_id, mesa_id, status, expira_em);
  `);

  // Seed dados de exemplo se vazio
  const { rows: cats } = await tenantQuery(
    restauranteId,
    "SELECT COUNT(*) as c FROM categorias WHERE restaurante_id = $1",
    [restauranteId],
  );
  if (parseInt(cats[0].c) === 0) {
    const inserirCategoria = (nome, ordem) => tenantQuery(
      restauranteId,
      `INSERT INTO categorias (nome, ordem, restaurante_id)
       VALUES ($1, $2, $3)`,
      [nome, ordem, restauranteId],
    );
    await inserirCategoria("Entradas", 1);
    await inserirCategoria("Pratos Principais", 2);
    await inserirCategoria("Bebidas", 3);
    await inserirCategoria("Sobremesas", 4);

    const { rows: catRows } = await tenantQuery(
      restauranteId,
      `SELECT id, nome FROM categorias
       WHERE restaurante_id = $1 ORDER BY ordem`,
      [restauranteId],
    );
    const catId = (nome) => catRows.find((c) => c.nome === nome)?.id;

    const insP = (cat, nome, desc, preco) =>
      tenantQuery(
        restauranteId,
        `INSERT INTO produtos
           (categoria_id, nome, descricao, preco, restaurante_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [catId(cat), nome, desc, preco, restauranteId],
      );

    await insP("Entradas", "Pão de Alho", "Pão artesanal com alho e manteiga", 18.9);
    await insP("Entradas", "Bruschetta", "Tomate, manjericão e azeite", 22.0);
    await insP("Pratos Principais", "Frango Grelhado", "Com legumes e arroz", 45.9);
    await insP("Pratos Principais", "Picanha 300g", "Acompanha farofa e vinagrete", 89.9);
    await insP("Pratos Principais", "Massa Carbonara", "Espaguete, bacon e molho cremoso", 52.0);
    await insP("Bebidas", "Coca-Cola Lata", "350ml gelada", 8.0);
    await insP("Bebidas", "Suco de Laranja", "Natural 500ml", 14.0);
    await insP("Bebidas", "Água Mineral", "500ml", 5.0);
    await insP("Sobremesas", "Pudim", "Pudim de leite condensado", 18.0);
    await insP("Sobremesas", "Brownie", "Com sorvete de creme", 24.0);

    for (let i = 1; i <= 12; i++) {
      await tenantQuery(
        restauranteId,
        "INSERT INTO mesas (numero, restaurante_id) VALUES ($1, $2)",
        [String(i), restauranteId],
      );
    }
  }

  // Garantir login único onde não existe
  await tenantQuery(
    restauranteId,
    `UPDATE usuarios SET login = lower(replace(nome,' ','_'))
     WHERE restaurante_id = $1 AND (login IS NULL OR login = '')`,
    [restauranteId],
  );
  await migrarSenhasLegadas(restauranteId);
  await criarAdminInicialSeNecessario(restauranteId);

  console.log("✅ Banco de dados inicializado!");
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

async function proximoNumeroDia(client, restauranteId) {
  const { rows: cfg } = await client.query(
    "SELECT valor FROM configuracoes WHERE restaurante_id = $1 AND chave = 'ultimo_reinicio'",
    [restauranteId],
  );
  const desde = cfg[0]?.valor || new Date().toISOString().slice(0, 10);
  const { rows: ultimo } = await client.query(
    `SELECT MAX(numero_dia) as ultimo
     FROM pedidos
     WHERE restaurante_id = $1 AND criado_em >= $2`,
    [restauranteId, desde],
  );
  return (parseInt(ultimo[0]?.ultimo) || 0) + 1;
}

async function getPedidoCompleto(restauranteId, pedidoId, client = null) {
  const executor = client || {
    query: (sql, params) => tenantQuery(restauranteId, sql, params),
  };
  const { rows } = await executor.query(
    `SELECT p.*, m.numero as mesa_numero
     FROM pedidos p
     JOIN mesas m
       ON m.id = p.mesa_id AND m.restaurante_id = p.restaurante_id
     WHERE p.id = $1 AND p.restaurante_id = $2`,
    [pedidoId, restauranteId],
  );
  const pedido = rows[0];
  if (!pedido) return null;
  const { rows: itens } = await executor.query(
    `SELECT ip.*, pr.nome, pr.preco
     FROM itens_pedido ip
     JOIN produtos pr
       ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
     WHERE ip.pedido_id = $1 AND ip.restaurante_id = $2`,
    [pedidoId, restauranteId],
  );
  pedido.itens = itens;
  return pedido;
}

async function buscarReservaCompleta(restauranteId, reservaId, client = null) {
  const executor = client || {
    query: (sql, params) => tenantQuery(restauranteId, sql, params),
  };
  const { rows } = await executor.query(
    `SELECT
       r.id, r.restaurante_id, r.mesa_id, r.nome_cliente, r.telefone, r.email,
       to_char(r.data_reserva, 'YYYY-MM-DD') AS data_reserva,
       to_char(r.horario, 'HH24:MI') AS horario,
       r.quantidade_pessoas, r.status, r.observacao, r.origem,
       r.criado_em, r.atualizado_em, r.confirmada_em, r.cancelada_em,
       r.concluida_em, m.numero AS mesa_numero
     FROM reservas r
     LEFT JOIN mesas m
       ON m.id = r.mesa_id AND m.restaurante_id = r.restaurante_id
     WHERE r.id = $1 AND r.restaurante_id = $2`,
    [reservaId, restauranteId],
  );
  return rows[0] || null;
}

async function validarMesaReserva(client, restauranteId, mesaId) {
  if (!mesaId) return null;
  const { rows } = await client.query(
    "SELECT id, numero FROM mesas WHERE id = $1 AND restaurante_id = $2",
    [mesaId, restauranteId],
  );
  if (!rows[0]) {
    const error = new ReservasValidationError("Mesa da reserva nao encontrada");
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

function responderErroReserva(res, error) {
  if (error instanceof ReservasValidationError) {
    return res.status(error.statusCode || 400).json({ erro: error.message });
  }
  console.error("Falha em reservas:", error.message);
  return res.status(error.statusCode || 500).json({
    erro: error.statusCode ? error.message : "Nao foi possivel processar a reserva",
  });
}

const salaRestaurante = (restauranteId) => `restaurante:${restauranteId}`;
const salaEquipe = (restauranteId) => `${salaRestaurante(restauranteId)}:equipe`;
const salaMesa = (restauranteId, mesaId) =>
  `${salaRestaurante(restauranteId)}:mesa:${mesaId}`;

function emitirRestaurante(restauranteId, evento, dados) {
  io.to(salaRestaurante(restauranteId)).emit(evento, dados);
}

function emitirEquipe(restauranteId, evento, dados) {
  io.to(salaEquipe(restauranteId)).emit(evento, dados);
}

function emitirMesa(restauranteId, mesaId, evento, dados) {
  io.to(salaMesa(restauranteId, mesaId)).emit(evento, dados);
}

// ─── ROTAS API ─────────────────────────────────────────────────────────────

// Cardápio
app.get("/api/cardapio", async (req, res) => {
  try {
    const restaurante = await buscarRestaurantePorSlug(
      req.query.restaurante_slug || "autenix",
    );
    if (!restaurante) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }
    const { rows: categorias } = await tenantQuery(
      restaurante.id,
      `SELECT id, nome, ordem, ativo, restaurante_id
       FROM categorias
       WHERE restaurante_id = $1 AND ativo = 1
       ORDER BY ordem`,
      [restaurante.id],
    );
    const { rows: produtos } = await tenantQuery(
      restaurante.id,
      `SELECT p.*
       FROM produtos p
       JOIN categorias c
         ON c.id = p.categoria_id AND c.restaurante_id = p.restaurante_id
       WHERE p.restaurante_id = $1
         AND p.disponivel = 1
         AND c.ativo = 1`,
      [restaurante.id],
    );
    res.json({ restaurante, categorias, produtos });
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

// Mesas
app.get("/api/mesas", autenticarJWT, autorizarRoles("garcom", "financeiro"), async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT m.*,
              EXISTS (
                SELECT 1
                FROM sessoes_mesa sm
                WHERE sm.restaurante_id = m.restaurante_id
                  AND sm.mesa_id = m.id
                  AND sm.status = 'ativa'
                  AND sm.expira_em > CURRENT_TIMESTAMP
              ) AS sessao_ativa
       FROM mesas m
       WHERE m.restaurante_id = $1
       ORDER BY NULLIF(regexp_replace(m.numero, '[^0-9]', '', 'g'), '')::INTEGER NULLS LAST,
                m.numero`,
      [req.user.restaurante_id],
    );
    res.json(rows);
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

app.get("/api/mesas/:id", async (req, res) => {
  try {
    const contexto = await buscarRestauranteDaMesa(
      req.params.id,
      req.query.restaurante_slug || "autenix",
    );
    if (!contexto) return res.status(404).json({ erro: "Mesa não encontrada" });
    await validarSessaoMesaRequest(req, contexto);
    res.json({
      ...contexto.mesa,
      restaurante: contexto.restaurante,
      sessao_ativa: true,
    });
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

app.post("/api/mesas", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  const { numero } = req.body;
  if (!numero) return res.status(400).json({ erro: "Número obrigatório" });
  try {
    const limites = await carregarLimitesPlano(req.user.restaurante_id);
    const totalMesas = await contarRegistrosTenant(req.user.restaurante_id, "mesas");
    if (totalMesas >= limites.limite_mesas) {
      return res.status(400).json({
        erro: `Limite de ${limites.limite_mesas} mesas atingido pelo plano atual`,
      });
    }

    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `INSERT INTO mesas (numero, restaurante_id)
       VALUES ($1, $2)
       RETURNING *`,
      [String(numero), req.user.restaurante_id],
    );
    emitirEquipe(req.user.restaurante_id, "mesa_atualizada", rows[0]);
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ erro: "Mesa já existe" });
  }
});

app.delete("/api/mesas/:id", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      "SELECT * FROM mesas WHERE id = $1 AND restaurante_id = $2",
      [req.params.id, req.user.restaurante_id],
    );
    if (!rows[0]) return res.status(404).json({ erro: "Mesa não encontrada" });
    if (rows[0].status === "ocupada") return res.status(400).json({ erro: "Mesa ocupada" });
    await tenantQuery(
      req.user.restaurante_id,
      "DELETE FROM mesas WHERE id = $1 AND restaurante_id = $2",
      [req.params.id, req.user.restaurante_id],
    );
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Fazer pedido (cliente)
app.post("/api/pedidos", async (req, res) => {
  const { mesa_id, itens, nome_cliente, restaurante_slug } = req.body;
  if (!mesa_id || !itens?.length)
    return res.status(400).json({ erro: "Dados inválidos" });

  try {
    const contexto = await buscarRestauranteDaMesa(
      mesa_id,
      restaurante_slug || "autenix",
    );
    if (!contexto) return res.status(404).json({ erro: "Mesa não encontrada" });

    const restauranteId = contexto.restaurante.id;
    const itensValidos = itens.every(
      (item) =>
        Number.isInteger(Number(item.produto_id)) &&
        Number.isInteger(Number(item.quantidade)) &&
        Number(item.quantidade) > 0,
    );
    if (!itensValidos) {
      return res.status(400).json({ erro: "Itens do pedido invalidos" });
    }

    const resultado = await withTenantTransaction(
      restauranteId,
      async (client) => {
        await validarSessaoMesaRequest(req, contexto, client);

        const produtoIds = [...new Set(itens.map((item) => Number(item.produto_id)))];
        const { rows: produtosValidos } = await client.query(
          `SELECT id FROM produtos
           WHERE restaurante_id = $1
             AND disponivel = 1
             AND id = ANY($2::INTEGER[])`,
          [restauranteId, produtoIds],
        );
        if (produtosValidos.length !== produtoIds.length) {
          const error = new Error("Produto indisponivel ou invalido");
          error.statusCode = 400;
          throw error;
        }

        const numeroDia = await proximoNumeroDia(client, restauranteId);
        const { rows: pedRows } = await client.query(
          `INSERT INTO pedidos
             (mesa_id, status, nome_cliente, numero_dia, restaurante_id)
           VALUES ($1, 'pendente', $2, $3, $4)
           RETURNING id`,
          [mesa_id, nome_cliente || null, numeroDia, restauranteId],
        );
        const pedidoId = pedRows[0].id;

        for (const item of itens) {
          await client.query(
            `INSERT INTO itens_pedido
               (pedido_id, produto_id, quantidade, observacao, restaurante_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              pedidoId,
              Number(item.produto_id),
              Number(item.quantidade),
              item.observacao || "",
              restauranteId,
            ],
          );
        }

        await client.query(
          `UPDATE mesas SET status = 'ocupada'
           WHERE id = $1 AND restaurante_id = $2`,
          [mesa_id, restauranteId],
        );
        const pedido = await getPedidoCompleto(
          restauranteId,
          pedidoId,
          client,
        );
        const { rows: mesaAtual } = await client.query(
          "SELECT * FROM mesas WHERE id = $1 AND restaurante_id = $2",
          [mesa_id, restauranteId],
        );
        return { pedido, mesa: mesaAtual[0] };
      },
    );

    emitirEquipe(restauranteId, "novo_pedido", resultado.pedido);
    emitirEquipe(restauranteId, "mesa_atualizada", resultado.mesa);
    emitirMesa(restauranteId, mesa_id, "pedido_atualizado", resultado.pedido);
    res.json({ sucesso: true, pedido_id: resultado.pedido.id });
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

// Listar pedidos (cozinha/admin)
app.get("/api/pedidos", protegerListagemPedidos, async (req, res) => {
  try {
    const { mesa_id, status, restaurante_slug } = req.query;
    let restauranteId = req.user?.restaurante_id;
    if (!restauranteId && mesa_id) {
      const contexto = await buscarRestauranteDaMesa(
        mesa_id,
        restaurante_slug || "autenix",
      );
      if (!contexto) {
        return res.status(404).json({ erro: "Mesa nao encontrada" });
      }
      await validarSessaoMesaRequest(req, contexto);
      restauranteId = contexto?.restaurante.id;
    }
    if (!restauranteId) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }

    let sql = `SELECT p.*, m.numero as mesa_numero
               FROM pedidos p
               JOIN mesas m
                 ON m.id = p.mesa_id AND m.restaurante_id = p.restaurante_id
               WHERE p.restaurante_id = $1`;
    const params = [restauranteId];
    let i = 2;

    if (mesa_id) {
      sql += ` AND p.mesa_id = $${i++}`;
      params.push(mesa_id);
    }
    if (status) {
      sql += ` AND p.status = $${i++}`;
      params.push(status);
    }
    sql += " ORDER BY p.criado_em DESC";

    const { rows: pedidos } = await tenantQuery(restauranteId, sql, params);
    const resultado = await Promise.all(
      pedidos.map(async (p) => {
        const { rows: itens } = await tenantQuery(
          restauranteId,
          `SELECT ip.*, pr.nome, pr.preco
           FROM itens_pedido ip
           JOIN produtos pr
             ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
           WHERE ip.pedido_id = $1 AND ip.restaurante_id = $2`,
          [p.id, restauranteId],
        );
        return { ...p, itens };
      })
    );
    res.json(resultado);
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

// Atualizar status do pedido
app.patch("/api/pedidos/:id/status", autenticarJWT, autorizarRoles("garcom", "cozinha"), async (req, res) => {
  try {
    const { status, garcom_id, garcom_nome } = req.body;
    if (!["pendente", "preparo", "pronto", "entregue", "finalizado"].includes(status)) {
      return res.status(400).json({ erro: "Status de pedido invalido" });
    }
    if (garcom_id) {
      await tenantQuery(
        req.user.restaurante_id,
        `UPDATE pedidos
         SET status = $1, garcom_id = $2, garcom_nome = $3
         WHERE id = $4 AND restaurante_id = $5`,
        [status, req.user.id, garcom_nome, req.params.id, req.user.restaurante_id],
      );
    } else {
      await tenantQuery(
        req.user.restaurante_id,
        "UPDATE pedidos SET status = $1 WHERE id = $2 AND restaurante_id = $3",
        [status, req.params.id, req.user.restaurante_id],
      );
    }
    const pedido = await getPedidoCompleto(
      req.user.restaurante_id,
      Number(req.params.id),
    );
    if (!pedido) return res.status(404).json({ erro: "Pedido nao encontrado" });
    emitirEquipe(req.user.restaurante_id, "pedido_atualizado", pedido);
    emitirMesa(req.user.restaurante_id, pedido.mesa_id, "pedido_atualizado", pedido);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Atualizar status do item
app.patch("/api/itens/:id/status", autenticarJWT, autorizarRoles("cozinha"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pendente", "preparo", "pronto"].includes(status)) {
      return res.status(400).json({ erro: "Status de item invalido" });
    }

    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      "SELECT * FROM itens_pedido WHERE id = $1 AND restaurante_id = $2",
      [req.params.id, req.user.restaurante_id],
    );
    if (!rows[0]) return res.status(404).json({ erro: "Item nao encontrado" });

    await tenantQuery(
      req.user.restaurante_id,
      `UPDATE itens_pedido SET status = $1
       WHERE id = $2 AND restaurante_id = $3`,
      [status, req.params.id, req.user.restaurante_id],
    );

    const pedido = await getPedidoCompleto(
      req.user.restaurante_id,
      rows[0].pedido_id,
    );
    emitirEquipe(req.user.restaurante_id, "pedido_atualizado", pedido);
    emitirMesa(req.user.restaurante_id, pedido.mesa_id, "pedido_atualizado", pedido);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Cancelar item
app.patch("/api/itens/:id/cancelar", async (req, res) => {
  try {
    const mesaId = Number(req.body?.mesa_id);
    if (!Number.isInteger(mesaId) || mesaId <= 0) {
      return res.status(400).json({ erro: "Mesa invalida" });
    }
    const contexto = await buscarRestauranteDaMesa(
      mesaId,
      req.body?.restaurante_slug || "autenix",
    );
    if (!contexto) {
      return res.status(404).json({ erro: "Mesa nao encontrada" });
    }
    await validarSessaoMesaRequest(req, contexto);

    const { rows } = await tenantQuery(
      contexto.restaurante.id,
      `SELECT ip.*
       FROM itens_pedido ip
       JOIN pedidos p
         ON p.id = ip.pedido_id AND p.restaurante_id = ip.restaurante_id
       WHERE ip.id = $1
         AND ip.restaurante_id = $2
         AND p.mesa_id = $3`,
      [req.params.id, contexto.restaurante.id, mesaId],
    );
    if (!rows[0]) return res.status(404).json({ erro: "Item nao encontrado" });
    if (rows[0].status !== "pendente") return res.status(400).json({ erro: "Item ja em preparo" });

    await tenantQuery(
      contexto.restaurante.id,
      `UPDATE itens_pedido SET status = 'cancelado'
       WHERE id = $1 AND restaurante_id = $2`,
      [req.params.id, contexto.restaurante.id],
    );
    const pedido = await getPedidoCompleto(contexto.restaurante.id, rows[0].pedido_id);
    emitirEquipe(contexto.restaurante.id, "pedido_atualizado", pedido);
    emitirMesa(contexto.restaurante.id, pedido.mesa_id, "pedido_atualizado", pedido);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

// Fechar mesa
app.post("/api/mesas/:id/fechar", autenticarJWT, autorizarRoles("garcom", "financeiro"), async (req, res) => {
  try {
    const { forma_pagamento, obs_pagamento } = req.body || {};
    if (!forma_pagamento) return res.status(400).json({ erro: "Forma de pagamento obrigatoria" });

    const { rows } = await withTenantTransaction(
      req.user.restaurante_id,
      async (client) => {
        const mesaAtualizada = await client.query(
          `UPDATE mesas
           SET status = 'livre', forma_pagamento = $1, obs_pagamento = $2
           WHERE id = $3 AND restaurante_id = $4
           RETURNING *`,
          [
            forma_pagamento,
            obs_pagamento || null,
            req.params.id,
            req.user.restaurante_id,
          ],
        );
        if (!mesaAtualizada.rows[0]) {
          const error = new Error("Mesa nao encontrada");
          error.statusCode = 404;
          throw error;
        }
        await client.query(
          `UPDATE pedidos
           SET status = 'finalizado', forma_pagamento = $1
           WHERE mesa_id = $2
             AND restaurante_id = $3
             AND status != 'finalizado'`,
          [forma_pagamento, req.params.id, req.user.restaurante_id],
        );
        await encerrarSessoesMesa(
          req.user.restaurante_id,
          req.params.id,
          client,
        );
        return mesaAtualizada;
      },
    );

    emitirEquipe(req.user.restaurante_id, "mesa_atualizada", rows[0]);
    emitirEquipe(req.user.restaurante_id, "mesa_fechada", req.params.id);
    emitirMesa(req.user.restaurante_id, req.params.id, "mesa_fechada", req.params.id);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

// Atendimento de mesa
app.post("/api/mesas/:id/atendimento/iniciar", autenticarJWT, autorizarRoles("garcom"), async (req, res) => {
  try {
    const resultado = await criarSessaoMesa(
      req.user.restaurante_id,
      req.params.id,
      req.user.id,
    );
    const resposta = await montarRespostaAtendimento(
      req.user.restaurante_slug,
      resultado,
    );
    emitirEquipe(req.user.restaurante_id, "mesa_atualizada", resposta.mesa);
    res.json(resposta);
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

app.post("/api/mesas/:id/atendimento/encerrar", autenticarJWT, autorizarRoles("garcom", "financeiro"), async (req, res) => {
  try {
    const mesa = await withTenantTransaction(
      req.user.restaurante_id,
      async (client) => {
        const { rows: mesas } = await client.query(
          `SELECT id, numero, status, restaurante_id
           FROM mesas
           WHERE id = $1 AND restaurante_id = $2`,
          [req.params.id, req.user.restaurante_id],
        );
        if (!mesas[0]) {
          const error = new Error("Mesa nao encontrada");
          error.statusCode = 404;
          throw error;
        }

        const { rows: pedidosAbertos } = await client.query(
          `SELECT count(*)::integer AS total
           FROM pedidos
           WHERE mesa_id = $1
             AND restaurante_id = $2
             AND status != 'finalizado'`,
          [req.params.id, req.user.restaurante_id],
        );
        if (pedidosAbertos[0]?.total > 0) {
          const error = new Error("Feche a conta antes de encerrar o atendimento da mesa");
          error.statusCode = 400;
          throw error;
        }

        await encerrarSessoesMesa(
          req.user.restaurante_id,
          req.params.id,
          client,
        );

        const { rows } = await client.query(
          `UPDATE mesas
           SET status = 'livre',
               forma_pagamento = NULL,
               obs_pagamento = NULL
           WHERE id = $1 AND restaurante_id = $2
           RETURNING *`,
          [req.params.id, req.user.restaurante_id],
        );
        return rows[0];
      },
    );

    emitirEquipe(req.user.restaurante_id, "mesa_atualizada", mesa);
    emitirMesa(req.user.restaurante_id, req.params.id, "mesa_fechada", req.params.id);
    res.json({ sucesso: true, mesa });
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

// Chamar garçom
app.post("/api/chamadas", async (req, res) => {
  try {
    const { mesa_id, motivo, nome_cliente, restaurante_slug } = req.body;
    const contexto = await buscarRestauranteDaMesa(
      mesa_id,
      restaurante_slug || "autenix",
    );
    if (!contexto) return res.status(404).json({ erro: "Mesa nao encontrada" });
    await validarSessaoMesaRequest(req, contexto);

    const { rows } = await tenantQuery(
      contexto.restaurante.id,
      `INSERT INTO chamadas
         (mesa_id, motivo, nome_cliente, restaurante_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        mesa_id,
        motivo || "garcom",
        nome_cliente || null,
        contexto.restaurante.id,
      ],
    );
    emitirEquipe(contexto.restaurante.id, "chamada_garcom", {
      id: rows[0].id,
      mesa_id,
      mesa_numero: contexto.mesa.numero,
      motivo: motivo || "garcom",
      nome_cliente,
    });
    res.json({ sucesso: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

// Atender chamada
app.patch("/api/chamadas/:id/atender", autenticarJWT, autorizarRoles("garcom", "cozinha"), async (req, res) => {
  try {
    await tenantQuery(
      req.user.restaurante_id,
      `UPDATE chamadas SET atendida = 1
       WHERE id = $1 AND restaurante_id = $2`,
      [req.params.id, req.user.restaurante_id],
    );
    emitirEquipe(req.user.restaurante_id, "chamada_atendida", {
      id: Number(req.params.id),
    });
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Chamadas pendentes
app.get("/api/chamadas", autenticarJWT, autorizarRoles("garcom", "cozinha"), async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT ch.*, m.numero as mesa_numero
       FROM chamadas ch
       JOIN mesas m
         ON m.id = ch.mesa_id AND m.restaurante_id = ch.restaurante_id
       WHERE ch.restaurante_id = $1 AND ch.atendida = 0
       ORDER BY ch.criado_em DESC`,
      [req.user.restaurante_id],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// QR Code por mesa
app.get("/api/qrcode/:mesa_id", autenticarJWT, autorizarRoles("garcom"), async (req, res) => {
  try {
    const resultado = await criarSessaoMesa(
      req.user.restaurante_id,
      req.params.mesa_id,
      req.user.id,
    );
    const resposta = await montarRespostaAtendimento(
      req.user.restaurante_slug,
      resultado,
    );
    emitirEquipe(req.user.restaurante_id, "mesa_atualizada", resposta.mesa);
    res.json(resposta);
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

app.post("/api/reservas", async (req, res) => {
  try {
    const restaurante = await buscarRestaurantePorSlug(
      req.body?.restaurante_slug || "autenix",
    );
    if (!restaurante) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }

    const dados = normalizarCriacaoReserva(req.body, { origem: "publica" });
    const reserva = await withTenantTransaction(
      restaurante.id,
      async (client, restauranteId) => {
        await validarMesaReserva(client, restauranteId, dados.mesa_id);
        const { rows } = await client.query(
          `INSERT INTO reservas
             (restaurante_id, mesa_id, nome_cliente, telefone, email,
              data_reserva, horario, quantidade_pessoas, observacao, origem)
           VALUES ($1, $2, $3, $4, $5, $6, $7::time, $8, $9, $10)
           RETURNING id`,
          [
            restauranteId,
            dados.mesa_id,
            dados.nome_cliente,
            dados.telefone,
            dados.email,
            dados.data_reserva,
            dados.horario,
            dados.quantidade_pessoas,
            dados.observacao,
            dados.origem,
          ],
        );
        return buscarReservaCompleta(restauranteId, rows[0].id, client);
      },
    );

    emitirEquipe(restaurante.id, "nova_reserva", reserva);
    return res.status(201).json({ sucesso: true, reserva });
  } catch (error) {
    return responderErroReserva(res, error);
  }
});

app.get(
  "/api/reservas",
  autenticarJWT,
  autorizarRoles("garcom", "financeiro"),
  async (req, res) => {
    try {
      const filtros = normalizarFiltrosReservas(req.query);
      const params = [req.user.restaurante_id];
      let index = 2;
      let sql = `
        SELECT
          r.id, r.restaurante_id, r.mesa_id, r.nome_cliente, r.telefone, r.email,
          to_char(r.data_reserva, 'YYYY-MM-DD') AS data_reserva,
          to_char(r.horario, 'HH24:MI') AS horario,
          r.quantidade_pessoas, r.status, r.observacao, r.origem,
          r.criado_em, r.atualizado_em, r.confirmada_em, r.cancelada_em,
          r.concluida_em, m.numero AS mesa_numero
        FROM reservas r
        LEFT JOIN mesas m
          ON m.id = r.mesa_id AND m.restaurante_id = r.restaurante_id
        WHERE r.restaurante_id = $1`;

      if (filtros.status) {
        sql += ` AND r.status = $${index++}`;
        params.push(filtros.status);
      }
      if (filtros.data) {
        sql += ` AND r.data_reserva = $${index++}`;
        params.push(filtros.data);
      }
      if (filtros.de) {
        sql += ` AND r.data_reserva >= $${index++}`;
        params.push(filtros.de);
      }
      if (filtros.ate) {
        sql += ` AND r.data_reserva <= $${index++}`;
        params.push(filtros.ate);
      }

      sql += " ORDER BY r.data_reserva ASC, r.horario ASC, r.id ASC";
      const { rows } = await tenantQuery(req.user.restaurante_id, sql, params);
      return res.json(rows);
    } catch (error) {
      return responderErroReserva(res, error);
    }
  },
);

app.post(
  "/api/reservas/admin",
  autenticarJWT,
  autorizarRoles("garcom"),
  async (req, res) => {
    try {
      const dados = normalizarCriacaoReserva(req.body, { origem: "admin" });
      const reserva = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          await validarMesaReserva(client, restauranteId, dados.mesa_id);
          const { rows } = await client.query(
            `INSERT INTO reservas
               (restaurante_id, mesa_id, nome_cliente, telefone, email,
                data_reserva, horario, quantidade_pessoas, observacao, origem)
             VALUES ($1, $2, $3, $4, $5, $6, $7::time, $8, $9, $10)
             RETURNING id`,
            [
              restauranteId,
              dados.mesa_id,
              dados.nome_cliente,
              dados.telefone,
              dados.email,
              dados.data_reserva,
              dados.horario,
              dados.quantidade_pessoas,
              dados.observacao,
              dados.origem,
            ],
          );
          return buscarReservaCompleta(restauranteId, rows[0].id, client);
        },
      );

      emitirEquipe(req.user.restaurante_id, "nova_reserva", reserva);
      return res.status(201).json({ sucesso: true, reserva });
    } catch (error) {
      return responderErroReserva(res, error);
    }
  },
);

app.patch(
  "/api/reservas/:id/status",
  autenticarJWT,
  autorizarRoles("garcom"),
  async (req, res) => {
    try {
      const reservaId = Number(req.params.id);
      if (!Number.isInteger(reservaId) || reservaId <= 0) {
        throw new ReservasValidationError("Reserva invalida");
      }
      const status = normalizarStatusReserva(req.body?.status);
      const colunasTimestamp = {
        confirmada: "confirmada_em",
        cancelada: "cancelada_em",
        concluida: "concluida_em",
      };
      const colunaTimestamp = colunasTimestamp[status];
      const atualizarTimestamp = colunaTimestamp
        ? `, ${colunaTimestamp} = COALESCE(${colunaTimestamp}, NOW())`
        : "";

      const reserva = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          const { rows } = await client.query(
            `UPDATE reservas
             SET status = $1,
                 atualizado_em = NOW()
                 ${atualizarTimestamp}
             WHERE id = $2 AND restaurante_id = $3
             RETURNING id`,
            [status, reservaId, restauranteId],
          );
          if (!rows[0]) {
            const error = new ReservasValidationError("Reserva nao encontrada");
            error.statusCode = 404;
            throw error;
          }
          return buscarReservaCompleta(restauranteId, reservaId, client);
        },
      );

      emitirEquipe(req.user.restaurante_id, "reserva_atualizada", reserva);
      return res.json({ sucesso: true, reserva });
    } catch (error) {
      return responderErroReserva(res, error);
    }
  },
);

app.post(
  "/api/uploads/imagem",
  autenticarJWT,
  autorizarRoles("admin"),
  processarUploadImagem,
  async (req, res) => {
    try {
      const imagem = await enviarImagemRestaurante({
        restauranteId: req.user.restaurante_id,
        tipo: normalizarTipo(req.body?.tipo),
        file: req.file,
      });
      return res.status(201).json(imagem);
    } catch (error) {
      return responderErroUpload(res, error);
    }
  },
);

app.get(
  "/api/importacoes/modelo/:tipo",
  autenticarJWT,
  autorizarRoles("admin"),
  (req, res) => {
    try {
      const csv = gerarCsvModelo(req.params.tipo);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=autenix-${req.params.tipo}.csv`,
      );
      return res.send(csv);
    } catch (error) {
      if (error instanceof ImportacaoValidationError) {
        return res.status(error.statusCode).json({ erro: error.message });
      }
      return res.status(500).json({ erro: "Nao foi possivel gerar o modelo" });
    }
  },
);

app.post(
  "/api/importacoes/validar",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const analise = await withTenantTransaction(
        req.user.restaurante_id,
        (client, restauranteId) =>
          analisarImportacao(client, restauranteId, req.body),
      );
      return res.json(analise);
    } catch (error) {
      if (error instanceof ImportacaoValidationError) {
        return res.status(error.statusCode).json({ erro: error.message });
      }
      return res.status(500).json({ erro: "Nao foi possivel validar a importacao" });
    }
  },
);

app.post(
  "/api/importacoes/executar",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const resultado = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          const analise = await analisarImportacao(client, restauranteId, req.body);
          if (!analise.pode_executar) {
            const erro = new ImportacaoValidationError(
              analise.erros[0] || "Corrija as linhas invalidas antes de importar",
            );
            erro.analise = analise;
            throw erro;
          }
          const importacao = await executarImportacao(client, restauranteId, analise);
          return { analise, importacao };
        },
      );

      if (["categorias", "produtos"].includes(resultado.analise.tipo)) {
        emitirRestaurante(req.user.restaurante_id, "cardapio_atualizado");
      }
      return res.json(resultado);
    } catch (error) {
      if (error instanceof ImportacaoValidationError) {
        return res.status(error.statusCode).json({
          erro: error.message,
          analise: error.analise,
        });
      }
      if (error.code === "23505") {
        return res.status(409).json({ erro: "Registro duplicado na importacao" });
      }
      console.error("Falha na importacao:", error.message);
      return res.status(500).json({ erro: "Nao foi possivel executar a importacao" });
    }
  },
);

// Categorias (admin)
app.post("/api/categorias", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    const { nome } = req.body;
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `INSERT INTO categorias (nome, ordem, restaurante_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [nome, 99, req.user.restaurante_id],
    );
    emitirRestaurante(req.user.restaurante_id, "cardapio_atualizado");
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.delete("/api/categorias/:id", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    await tenantQuery(
      req.user.restaurante_id,
      "DELETE FROM categorias WHERE id = $1 AND restaurante_id = $2",
      [req.params.id, req.user.restaurante_id],
    );
    emitirRestaurante(req.user.restaurante_id, "cardapio_atualizado");
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Produtos (admin)
app.post("/api/produtos", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    const { categoria_id, nome, descricao, preco, imagem } = req.body;
    const limites = await carregarLimitesPlano(req.user.restaurante_id);
    const totalProdutos = await contarRegistrosTenant(req.user.restaurante_id, "produtos");
    if (totalProdutos >= limites.limite_produtos) {
      return res.status(400).json({
        erro: `Limite de ${limites.limite_produtos} produtos atingido pelo plano atual`,
      });
    }

    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `INSERT INTO produtos
         (categoria_id, nome, descricao, preco, imagem, restaurante_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        categoria_id,
        nome,
        descricao,
        preco,
        imagem || null,
        req.user.restaurante_id,
      ],
    );
    emitirRestaurante(req.user.restaurante_id, "cardapio_atualizado");
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.patch("/api/produtos/:id", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    const { nome, descricao, preco, disponivel, imagem, categoria_id } = req.body;
    await tenantQuery(
      req.user.restaurante_id,
      `UPDATE produtos
       SET nome = $1,
           descricao = $2,
           preco = $3,
           disponivel = $4,
           imagem = $5,
           categoria_id = COALESCE($6, categoria_id)
       WHERE id = $7 AND restaurante_id = $8`,
      [
        nome,
        descricao,
        preco,
        disponivel ? 1 : 0,
        imagem || null,
        categoria_id || null,
        req.params.id,
        req.user.restaurante_id,
      ],
    );
    emitirRestaurante(req.user.restaurante_id, "cardapio_atualizado");
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.delete("/api/produtos/:id", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    await tenantQuery(
      req.user.restaurante_id,
      "DELETE FROM produtos WHERE id = $1 AND restaurante_id = $2",
      [req.params.id, req.user.restaurante_id],
    );
    emitirRestaurante(req.user.restaurante_id, "cardapio_atualizado");
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Histórico do dia
app.get("/api/historico", autenticarJWT, autorizarRoles("financeiro"), async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT
        p.id, p.numero_dia, p.mesa_id,
        m.numero as mesa_numero,
        p.garcom_nome, p.nome_cliente, p.forma_pagamento,
        to_char(p.criado_em AT TIME ZONE 'America/Bahia', 'HH24:MI') as fechado_em,
        SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
        COUNT(DISTINCT CASE WHEN ip.status != 'cancelado' THEN ip.id END) as total_itens
       FROM pedidos p
       JOIN mesas m ON m.id = p.mesa_id AND m.restaurante_id = p.restaurante_id
       JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.restaurante_id = p.restaurante_id
       JOIN produtos pr ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
       WHERE p.restaurante_id = $1
         AND p.status = 'finalizado'
         AND (p.criado_em AT TIME ZONE 'America/Bahia')::date = $2
       GROUP BY p.id, m.numero
       ORDER BY p.criado_em DESC`,
      [req.user.restaurante_id, hoje],
    );

    const resultado = await Promise.all(
      rows.map(async (r) => {
        const { rows: itens } = await tenantQuery(
          req.user.restaurante_id,
          `SELECT ip.*, pr.nome, pr.preco
           FROM itens_pedido ip
           JOIN produtos pr
             ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
           WHERE ip.pedido_id = $1
             AND ip.restaurante_id = $2
             AND ip.status != 'cancelado'`,
          [r.id, req.user.restaurante_id],
        );
        return { ...r, itens };
      })
    );
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Reiniciar numeração
app.post("/api/pedidos/reiniciar-numeracao", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    await tenantQuery(
      req.user.restaurante_id,
      `INSERT INTO configuracoes (restaurante_id, chave, valor)
       VALUES ($1, 'ultimo_reinicio', $2)
       ON CONFLICT (restaurante_id, chave)
       DO UPDATE SET valor = EXCLUDED.valor`,
      [req.user.restaurante_id, new Date().toISOString()],
    );
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Relatório por período
app.get("/api/relatorio", autenticarJWT, autorizarRoles("financeiro"), async (req, res) => {
  try {
    const { periodo, dataInicio: di, dataFim: df } = req.query;
    const agora = new Date();
    const hoje = agora.toISOString().slice(0, 10);
    let dataInicio, dataFim;

    if (di) {
      dataInicio = di;
      dataFim = df || hoje;
    } else if (periodo === "semana") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 7);
      dataInicio = d.toISOString().slice(0, 10);
      dataFim = hoje;
    } else if (periodo === "mes") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 30);
      dataInicio = d.toISOString().slice(0, 10);
      dataFim = hoje;
    } else if (periodo === "ano") {
      dataInicio = `${agora.getFullYear()}-01-01`;
      dataFim = hoje;
    } else {
      dataInicio = hoje;
      dataFim = hoje;
    }

    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT
        p.mesa_id,
        m.numero as mesa_numero,
        MAX(p.nome_cliente) as nome_cliente,
        MAX(p.garcom_nome) as garcom_nome,
        MAX(p.forma_pagamento) as forma_pagamento,
        COUNT(DISTINCT ip.id) as total_itens,
        SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
        to_char(MAX(p.criado_em) AT TIME ZONE 'America/Bahia', 'DD/MM HH24:MI') as fechado_em
       FROM pedidos p
       JOIN mesas m ON m.id = p.mesa_id AND m.restaurante_id = p.restaurante_id
       JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.restaurante_id = p.restaurante_id
       JOIN produtos pr ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
       WHERE p.restaurante_id = $1
         AND p.status = 'finalizado'
         AND (p.criado_em AT TIME ZONE 'America/Bahia')::date >= $2
         AND (p.criado_em AT TIME ZONE 'America/Bahia')::date <= $3
       GROUP BY p.id, m.numero
       ORDER BY MAX(p.criado_em) DESC`,
      [req.user.restaurante_id, dataInicio, dataFim],
    );

    const totalGeral = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    res.json({ rows, totalGeral, periodo, dataInicio, dataFim });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Financeiro hoje
app.get("/api/financeiro/hoje", autenticarJWT, autorizarRoles("financeiro"), async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT
        p.mesa_id,
        m.numero as mesa_numero,
        MAX(p.nome_cliente) as nome_cliente,
        COUNT(DISTINCT ip.id) as total_itens,
        SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
        to_char(MAX(p.criado_em) AT TIME ZONE 'America/Bahia', 'HH24:MI') as fechado_em
       FROM pedidos p
       JOIN mesas m ON m.id = p.mesa_id AND m.restaurante_id = p.restaurante_id
       JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.restaurante_id = p.restaurante_id
       JOIN produtos pr ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
       WHERE p.restaurante_id = $1
         AND p.status = 'finalizado'
         AND (p.criado_em AT TIME ZONE 'America/Bahia')::date = $2
       GROUP BY p.mesa_id, m.numero
       ORDER BY MAX(p.criado_em) DESC`,
      [req.user.restaurante_id, hoje],
    );
    const totalDia = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    res.json({ rows, totalDia, data: hoje });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ─── ADMINISTRACAO DA PLATAFORMA ──────────────────────────────────────────

function idPositivo(valor, campo = "ID") {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new TenantValidationError(`${campo} invalido`);
  }
  return numero;
}

async function carregarResumoRestaurante(restaurante) {
  const { rows } = await tenantQuery(
    restaurante.id,
    `SELECT
       (SELECT COUNT(*)::int FROM mesas WHERE restaurante_id = $1) AS mesas_cadastradas,
       (SELECT COUNT(*)::int FROM usuarios WHERE restaurante_id = $1 AND ativo = 1) AS usuarios_ativos,
       (SELECT COUNT(*)::int FROM produtos WHERE restaurante_id = $1) AS produtos_cadastrados,
       (SELECT COUNT(*)::int FROM pedidos WHERE restaurante_id = $1) AS pedidos_total,
       (
         SELECT row_to_json(master)
         FROM (
           SELECT id, nome, login, ativo
           FROM usuarios
           WHERE restaurante_id = $1 AND role = 'admin'
           ORDER BY id
           LIMIT 1
         ) AS master
       ) AS master`,
    [restaurante.id],
  );
  return { ...restaurante, ...rows[0] };
}

async function carregarLimitesPlano(restauranteId) {
  const { rows } = await query(
    `SELECT limite_mesas, limite_usuarios, limite_produtos
     FROM restaurantes
     WHERE id = $1 AND excluido_em IS NULL`,
    [restauranteId],
  );
  if (!rows[0]) {
    const error = new Error("Restaurante nao encontrado");
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function contarRegistrosTenant(restauranteId, tabela, condicaoExtra = "") {
  const { rows } = await tenantQuery(
    restauranteId,
    `SELECT COUNT(*)::int AS total
     FROM ${tabela}
     WHERE restaurante_id = $1 ${condicaoExtra}`,
    [restauranteId],
  );
  return rows[0]?.total || 0;
}

function resumoImportacaoVazio() {
  return {
    criar: 0,
    atualizar: 0,
    ignorar: 0,
    invalidas: 0,
  };
}

function mapearPorChave(rows, campo) {
  const mapa = new Map();
  for (const row of rows) {
    const chave = normalizarBusca(row[campo]);
    if (chave && !mapa.has(chave)) mapa.set(chave, row);
  }
  return mapa;
}

async function carregarEstadoImportacao(client, restauranteId, tipo) {
  if (tipo === "categorias" || tipo === "produtos") {
    const { rows } = await client.query(
      "SELECT id, nome, ordem FROM categorias WHERE restaurante_id = $1 ORDER BY ordem, nome",
      [restauranteId],
    );
    const categorias = mapearPorChave(rows, "nome");
    if (tipo === "categorias") return { categorias };

    const { rows: produtos } = await client.query(
      "SELECT id, nome FROM produtos WHERE restaurante_id = $1 ORDER BY id",
      [restauranteId],
    );
    return { categorias, produtos: mapearPorChave(produtos, "nome") };
  }

  if (tipo === "mesas") {
    const { rows } = await client.query(
      "SELECT id, numero FROM mesas WHERE restaurante_id = $1 ORDER BY id",
      [restauranteId],
    );
    return { mesas: mapearPorChave(rows, "numero") };
  }

  if (tipo === "usuarios") {
    const { rows } = await client.query(
      "SELECT id, login, ativo FROM usuarios WHERE restaurante_id = $1 ORDER BY id",
      [restauranteId],
    );
    return { usuarios: mapearPorChave(rows, "login") };
  }

  return {};
}

function existenteDaImportacao(estado, tipo, item) {
  if (tipo === "categorias") return estado.categorias?.get(item.chave);
  if (tipo === "produtos") return estado.produtos?.get(item.chave);
  if (tipo === "mesas") return estado.mesas?.get(item.chave);
  if (tipo === "usuarios") return estado.usuarios?.get(item.chave);
  return null;
}

async function analisarImportacao(client, restauranteId, payload = {}) {
  const tipo = String(payload.tipo || "");
  const spec = TIPOS_IMPORTACAO[tipo];
  if (!spec) throw new ImportacaoValidationError("Tipo de importacao invalido");

  const itens = normalizarLinhasImportacao(tipo, payload.rows || payload.linhas || []);
  const atualizarExistentes = Boolean(payload.atualizar_existentes);
  const estado = await carregarEstadoImportacao(client, restauranteId, tipo);
  const resumo = resumoImportacaoVazio();
  const errosGerais = [];
  const preview = itens.map((item) => {
    const erros = [...item.erros];
    const existente = erros.length ? null : existenteDaImportacao(estado, tipo, item);
    let acao = "criar";

    if (erros.length) {
      acao = "invalida";
      resumo.invalidas += 1;
    } else if (existente && atualizarExistentes) {
      acao = "atualizar";
      resumo.atualizar += 1;
    } else if (existente) {
      acao = "ignorar";
      resumo.ignorar += 1;
    } else {
      resumo.criar += 1;
    }

    return {
      linha: item.linha,
      acao,
      existente_id: existente?.id || null,
      dados: item.dados,
      erros,
    };
  });

  const limites = await carregarLimitesPlano(restauranteId);
  if (tipo === "produtos") {
    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS total FROM produtos WHERE restaurante_id = $1",
      [restauranteId],
    );
    const totalFinal = (rows[0]?.total || 0) + resumo.criar;
    if (totalFinal > limites.limite_produtos) {
      errosGerais.push(`Limite de ${limites.limite_produtos} produtos seria excedido`);
    }
  }

  if (tipo === "mesas") {
    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS total FROM mesas WHERE restaurante_id = $1",
      [restauranteId],
    );
    const totalFinal = (rows[0]?.total || 0) + resumo.criar;
    if (totalFinal > limites.limite_mesas) {
      errosGerais.push(`Limite de ${limites.limite_mesas} mesas seria excedido`);
    }
  }

  if (tipo === "usuarios") {
    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS total FROM usuarios WHERE restaurante_id = $1 AND ativo = 1",
      [restauranteId],
    );
    const ativosCriados = preview.filter(
      (item) => item.acao === "criar" && item.dados.ativo,
    ).length;
    const totalFinal = (rows[0]?.total || 0) + ativosCriados;
    if (totalFinal > limites.limite_usuarios) {
      errosGerais.push(`Limite de ${limites.limite_usuarios} usuarios ativos seria excedido`);
    }
  }

  return {
    tipo,
    label: spec.label,
    colunas: spec.colunas,
    total_linhas: itens.length,
    resumo,
    pode_executar: errosGerais.length === 0 && resumo.invalidas === 0 && itens.length > 0,
    erros: errosGerais,
    preview,
  };
}

async function garantirCategoriaImportacao(client, restauranteId, estado, nomeCategoria) {
  const nome = String(nomeCategoria || "").trim();
  if (!nome) return null;

  const chave = normalizarBusca(nome);
  const existente = estado.categorias?.get(chave);
  if (existente) return existente.id;

  const { rows } = await client.query(
    `INSERT INTO categorias (nome, ordem, restaurante_id)
     VALUES ($1, $2, $3)
     RETURNING id, nome, ordem`,
    [nome, 99, restauranteId],
  );
  estado.categorias.set(chave, rows[0]);
  return rows[0].id;
}

async function executarImportacaoCategoria(client, restauranteId, item, estado) {
  const { dados } = item;
  if (item.acao === "atualizar") {
    await client.query(
      `UPDATE categorias
       SET nome = $1, ordem = $2
       WHERE id = $3 AND restaurante_id = $4`,
      [dados.nome, dados.ordem, item.existente_id, restauranteId],
    );
    return { acao: "atualizar", login: null };
  }

  const { rows } = await client.query(
    `INSERT INTO categorias (nome, ordem, restaurante_id)
     VALUES ($1, $2, $3)
     RETURNING id, nome, ordem`,
    [dados.nome, dados.ordem, restauranteId],
  );
  estado.categorias.set(normalizarBusca(rows[0].nome), rows[0]);
  return { acao: "criar", login: null };
}

async function executarImportacaoProduto(client, restauranteId, item, estado) {
  const { dados } = item;
  const categoriaId = await garantirCategoriaImportacao(
    client,
    restauranteId,
    estado,
    dados.categoria,
  );
  const parametros = [
    categoriaId,
    dados.nome,
    dados.descricao || null,
    dados.preco,
    dados.imagem || null,
    dados.disponivel ? 1 : 0,
    restauranteId,
  ];

  if (item.acao === "atualizar") {
    await client.query(
      `UPDATE produtos
       SET categoria_id = $1,
           nome = $2,
           descricao = $3,
           preco = $4,
           imagem = $5,
           disponivel = $6
       WHERE id = $7 AND restaurante_id = $8`,
      [...parametros.slice(0, 6), item.existente_id, restauranteId],
    );
    return { acao: "atualizar", login: null };
  }

  await client.query(
    `INSERT INTO produtos
       (categoria_id, nome, descricao, preco, imagem, disponivel, restaurante_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    parametros,
  );
  return { acao: "criar", login: null };
}

async function executarImportacaoMesa(client, restauranteId, item) {
  const { dados } = item;
  if (item.acao === "atualizar") {
    await client.query(
      `UPDATE mesas
       SET numero = $1, status = $2
       WHERE id = $3 AND restaurante_id = $4`,
      [dados.numero, dados.status, item.existente_id, restauranteId],
    );
    return { acao: "atualizar", login: null };
  }

  await client.query(
    `INSERT INTO mesas (numero, status, restaurante_id)
     VALUES ($1, $2, $3)`,
    [dados.numero, dados.status, restauranteId],
  );
  return { acao: "criar", login: null };
}

async function executarImportacaoUsuario(client, restauranteId, item) {
  const { dados } = item;
  const senhaTemporaria = !dados.senha_informada && item.acao === "criar"
    ? gerarSenhaTemporaria()
    : "";
  const senhaFinal = dados.senha_informada ? dados.senha : senhaTemporaria;

  if (item.acao === "atualizar") {
    const senhaSql = dados.senha_informada ? ", senha = $6" : "";
    const params = [
      dados.nome,
      dados.login,
      dados.role,
      dados.ativo ? 1 : 0,
      item.existente_id,
      ...(dados.senha_informada ? [await hashSenha(senhaFinal)] : []),
      restauranteId,
    ];
    await client.query(
      `UPDATE usuarios
       SET nome = $1,
           login = $2,
           role = $3,
           ativo = $4
           ${senhaSql}
       WHERE id = $5 AND restaurante_id = $${dados.senha_informada ? 7 : 6}`,
      params,
    );
    return { acao: "atualizar", login: dados.login, senha_temporaria: "" };
  }

  await client.query(
    `INSERT INTO usuarios (nome, login, senha, role, ativo, restaurante_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      dados.nome,
      dados.login,
      await hashSenha(senhaFinal),
      dados.role,
      dados.ativo ? 1 : 0,
      restauranteId,
    ],
  );
  return {
    acao: "criar",
    login: dados.login,
    senha_temporaria: senhaTemporaria,
  };
}

async function executarImportacao(client, restauranteId, analise) {
  const estado = await carregarEstadoImportacao(client, restauranteId, analise.tipo);
  const resultado = {
    ...resumoImportacaoVazio(),
    credenciais: [],
  };

  const executores = {
    categorias: executarImportacaoCategoria,
    produtos: executarImportacaoProduto,
    mesas: executarImportacaoMesa,
    usuarios: executarImportacaoUsuario,
  };
  const executor = executores[analise.tipo];

  for (const item of analise.preview) {
    if (item.acao === "invalida") {
      resultado.invalidas += 1;
      continue;
    }
    if (item.acao === "ignorar") {
      resultado.ignorar += 1;
      continue;
    }

    const parcial = await executor(client, restauranteId, item, estado);
    resultado[parcial.acao] += 1;
    if (parcial.senha_temporaria) {
      resultado.credenciais.push({
        nome: item.dados.nome,
        login: parcial.login,
        senha: parcial.senha_temporaria,
      });
    }
  }

  return resultado;
}

function responderErroPlataforma(res, error) {
  if (error instanceof TenantValidationError || error instanceof BrandingValidationError) {
    return res.status(error.statusCode || 400).json({ erro: error.message });
  }
  if (error.code === "23505") {
    return res.status(409).json({ erro: "Slug ou login ja cadastrado" });
  }
  console.error("Falha na administracao da plataforma:", error.message);
  return res.status(500).json({ erro: "Nao foi possivel concluir a operacao" });
}

app.post(
  "/api/platform/uploads/imagem",
  autenticarPlataforma,
  processarUploadImagem,
  async (req, res) => {
    try {
      const restauranteId = idPositivo(req.body?.restaurante_id, "Restaurante");
      const { rows } = await query(
        "SELECT id FROM restaurantes WHERE id = $1 AND excluido_em IS NULL",
        [restauranteId],
      );
      if (!rows[0]) {
        return res.status(404).json({ erro: "Restaurante nao encontrado" });
      }

      const imagem = await enviarImagemRestaurante({
        restauranteId,
        tipo: normalizarTipo(req.body?.tipo || "logo"),
        file: req.file,
      });
      return res.status(201).json(imagem);
    } catch (error) {
      if (error instanceof TenantValidationError) {
        return res.status(error.statusCode || 400).json({ erro: error.message });
      }
      return responderErroUpload(res, error);
    }
  },
);

app.post("/api/platform/auth/login", loginRateLimit, async (req, res) => {
  const login = normalizarLogin(req.body?.login);
  const senha = String(req.body?.senha || "");
  if (!login || !senha) {
    return res.status(400).json({ erro: "Login e senha sao obrigatorios" });
  }

  try {
    const { rows } = await query(
      `SELECT id, nome, login, senha, role, ativo
       FROM platform_usuarios
       WHERE login = $1 AND role = 'platform_admin' AND ativo = TRUE
       LIMIT 1`,
      [login],
    );
    const usuario = rows[0];
    if (!usuario || !(await senhaConfere(senha, usuario.senha))) {
      return res.status(401).json({ erro: "Login ou senha incorretos" });
    }

    await query(
      "UPDATE platform_usuarios SET ultimo_acesso_em = NOW() WHERE id = $1",
      [usuario.id],
    );
    return res.json({
      ...usuarioPlataformaPublico(usuario),
      token: gerarTokenPlataforma(usuario),
      token_type: "Bearer",
      expires_in: PLATFORM_JWT_EXPIRES_IN,
    });
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

app.get("/api/platform/restaurantes", autenticarPlataforma, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, slug, ativo, plano, limite_mesas, limite_usuarios,
              limite_produtos, mensalidade_centavos, ciclo_cobranca,
              status_cobranca, trial_termina_em, proxima_cobranca_em,
              observacoes_plano, excluido_em,
              white_label_ativo, nome_exibicao, logo_url,
              cor_primaria, cor_secundaria, criado_em, atualizado_em
       FROM restaurantes
       ORDER BY excluido_em NULLS FIRST, criado_em DESC`,
    );
    const restaurantes = await Promise.all(rows.map(carregarResumoRestaurante));
    return res.json(restaurantes);
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

app.post("/api/platform/restaurantes", autenticarPlataforma, async (req, res) => {
  try {
    const resultado = await provisionarRestaurante(pool, req.body, BCRYPT_ROUNDS);
    return res.status(201).json(resultado);
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

app.patch("/api/platform/restaurantes/:id", autenticarPlataforma, async (req, res) => {
  try {
    const restauranteId = idPositivo(req.params.id, "Restaurante");
    const nome = String(req.body?.nome || "").trim();
    const slug = normalizarSlugTenant(req.body?.slug || nome);
    const planoDetalhes = normalizarPlanoDetalhes(req.body);
    const marca = normalizarWhiteLabel(req.body);

    if (nome.length < 2 || nome.length > 120 || !slug || slug.length > 80) {
      throw new TenantValidationError("Nome ou slug do restaurante invalido");
    }
    const { rows: usoAtual } = await tenantQuery(
      restauranteId,
      `SELECT
         (SELECT COUNT(*)::int FROM mesas WHERE restaurante_id = $1) AS mesas,
         (SELECT COUNT(*)::int FROM usuarios WHERE restaurante_id = $1 AND ativo = 1) AS usuarios,
         (SELECT COUNT(*)::int FROM produtos WHERE restaurante_id = $1) AS produtos`,
      [restauranteId],
    );
    if ((usoAtual[0]?.mesas || 0) > planoDetalhes.limiteMesas) {
      throw new TenantValidationError(
        `O restaurante ja possui ${usoAtual[0].mesas} mesas cadastradas`,
      );
    }
    if ((usoAtual[0]?.usuarios || 0) > planoDetalhes.limiteUsuarios) {
      throw new TenantValidationError(
        `O restaurante ja possui ${usoAtual[0].usuarios} usuarios ativos`,
      );
    }
    if ((usoAtual[0]?.produtos || 0) > planoDetalhes.limiteProdutos) {
      throw new TenantValidationError(
        `O restaurante ja possui ${usoAtual[0].produtos} produtos cadastrados`,
      );
    }

    const { rows } = await query(
      `UPDATE restaurantes
       SET nome = $1,
           slug = $2,
           plano = $3,
           limite_mesas = $4,
           limite_usuarios = $5,
           limite_produtos = $6,
           mensalidade_centavos = $7,
           ciclo_cobranca = $8,
           status_cobranca = $9,
           trial_termina_em = $10,
           proxima_cobranca_em = $11,
           observacoes_plano = $12,
           white_label_ativo = $13,
           nome_exibicao = $14,
           logo_url = $15,
           cor_primaria = $16,
           cor_secundaria = $17,
           atualizado_em = NOW()
       WHERE id = $18
       RETURNING id, nome, slug, ativo, plano, limite_mesas, limite_usuarios,
                 limite_produtos, mensalidade_centavos, ciclo_cobranca,
                 status_cobranca, trial_termina_em, proxima_cobranca_em,
                 observacoes_plano, excluido_em,
                 white_label_ativo, nome_exibicao, logo_url,
                 cor_primaria, cor_secundaria, criado_em, atualizado_em`,
      [
        nome,
        slug,
        planoDetalhes.plano,
        planoDetalhes.limiteMesas,
        planoDetalhes.limiteUsuarios,
        planoDetalhes.limiteProdutos,
        planoDetalhes.mensalidadeCentavos,
        planoDetalhes.cicloCobranca,
        planoDetalhes.statusCobranca,
        planoDetalhes.trialTerminaEm,
        planoDetalhes.proximaCobrancaEm,
        planoDetalhes.observacoesPlano,
        marca.white_label_ativo,
        marca.nome_exibicao,
        marca.logo_url,
        marca.cor_primaria,
        marca.cor_secundaria,
        restauranteId,
      ],
    );
    if (!rows[0]) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }
    return res.json(await carregarResumoRestaurante(rows[0]));
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

app.patch(
  "/api/platform/restaurantes/:id/status",
  autenticarPlataforma,
  async (req, res) => {
    try {
      const restauranteId = idPositivo(req.params.id, "Restaurante");
      if (typeof req.body?.ativo !== "boolean") {
        throw new TenantValidationError("Status do restaurante invalido");
      }
      const { rows } = await query(
        `UPDATE restaurantes
         SET ativo = CASE WHEN $1 THEN 1 ELSE 0 END,
             excluido_em = CASE WHEN $1 THEN NULL ELSE excluido_em END,
             atualizado_em = NOW()
         WHERE id = $2
         RETURNING id, nome, slug, ativo, plano, limite_mesas, limite_usuarios,
                   limite_produtos, mensalidade_centavos, ciclo_cobranca,
                   status_cobranca, trial_termina_em, proxima_cobranca_em,
                   observacoes_plano, excluido_em,
                   white_label_ativo, nome_exibicao, logo_url,
                   cor_primaria, cor_secundaria, criado_em, atualizado_em`,
        [req.body.ativo, restauranteId],
      );
      if (!rows[0]) {
        return res.status(404).json({ erro: "Restaurante nao encontrado" });
      }
      return res.json(await carregarResumoRestaurante(rows[0]));
    } catch (error) {
      return responderErroPlataforma(res, error);
    }
  },
);

app.delete("/api/platform/restaurantes/:id", autenticarPlataforma, async (req, res) => {
  try {
    const restauranteId = idPositivo(req.params.id, "Restaurante");
    const { rows } = await query(
      `UPDATE restaurantes
       SET ativo = 0, excluido_em = NOW(), atualizado_em = NOW()
       WHERE id = $1 AND excluido_em IS NULL
       RETURNING id, nome, slug, excluido_em`,
      [restauranteId],
    );
    if (!rows[0]) {
      return res.status(404).json({ erro: "Restaurante nao encontrado ou ja arquivado" });
    }
    return res.json({ ...rows[0], arquivado: true });
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

app.post(
  "/api/platform/restaurantes/:id/redefinir-master",
  autenticarPlataforma,
  async (req, res) => {
    try {
      const resultado = await redefinirSenhaMaster(
        pool,
        req.params.id,
        req.body?.senha,
        BCRYPT_ROUNDS,
      );
      return res.json(resultado);
    } catch (error) {
      return responderErroPlataforma(res, error);
    }
  },
);

app.patch("/api/platform/minha-senha", autenticarPlataforma, async (req, res) => {
  const senhaAtual = String(req.body?.senha_atual || "");
  const novaSenha = String(req.body?.nova_senha || "");
  if (novaSenha.length < 12) {
    return res.status(400).json({ erro: "A nova senha deve ter pelo menos 12 caracteres" });
  }

  try {
    const { rows } = await query(
      "SELECT senha FROM platform_usuarios WHERE id = $1 AND ativo = TRUE",
      [req.platformUser.id],
    );
    if (!rows[0] || !(await senhaConfere(senhaAtual, rows[0].senha))) {
      return res.status(401).json({ erro: "Senha atual incorreta" });
    }
    await query("UPDATE platform_usuarios SET senha = $1 WHERE id = $2", [
      await hashSenha(novaSenha),
      req.platformUser.id,
    ]);
    return res.json({ sucesso: true });
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

// ─── USUARIOS DOS RESTAURANTES ────────────────────────────────────────────

app.post("/api/auth/login", loginRateLimit, async (req, res) => {
  const { login, senha, restaurante_slug } = req.body;
  if (!login || !senha) return res.status(400).json({ erro: "Dados incompletos" });
  try {
    const restaurante = await buscarRestaurantePorSlug(restaurante_slug || "autenix");
    if (!restaurante) {
      return res.status(401).json({ erro: "Restaurante, login ou senha incorretos" });
    }
    const loginNormalizado = normalizarLogin(login);
    const { rows } = await tenantQuery(
      restaurante.id,
      `SELECT * FROM usuarios
       WHERE restaurante_id = $1
         AND (login = $2 OR nome = $3)
         AND ativo = 1`,
      [restaurante.id, loginNormalizado, String(login).trim()],
    );
    const u = rows[0]
      ? {
          ...rows[0],
          restaurante_slug: restaurante.slug,
          restaurante_nome: restaurante.nome,
        }
      : null;
    if (!u || !(await senhaConfere(senha, u.senha)))
      return res.status(401).json({ erro: "Login ou senha incorretos" });

    if (!isBcryptHash(u.senha)) {
      await tenantQuery(
        restaurante.id,
        `UPDATE usuarios SET senha = $1
         WHERE id = $2 AND restaurante_id = $3`,
        [await hashSenha(senha), u.id, restaurante.id],
      );
    }

    res.json({
      ...usuarioPublico(u),
      token: gerarToken(u),
      token_type: "Bearer",
      expires_in: JWT_EXPIRES_IN,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get("/api/restaurante", autenticarJWT, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, slug, ativo, white_label_ativo, nome_exibicao,
              logo_url, cor_primaria, cor_secundaria, plano, limite_mesas,
              limite_usuarios, limite_produtos, mensalidade_centavos,
              ciclo_cobranca, status_cobranca, trial_termina_em,
              proxima_cobranca_em, atualizado_em
       FROM restaurantes WHERE id = $1 AND ativo = 1`,
      [req.user.restaurante_id],
    );
    if (!rows[0]) return res.status(404).json({ erro: "Restaurante nao encontrado" });
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
});

app.patch(
  "/api/restaurante/white-label",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const dados = normalizarWhiteLabel(req.body);
      const { rows } = await query(
        `UPDATE restaurantes
         SET white_label_ativo = $1,
             nome_exibicao = $2,
             logo_url = $3,
             cor_primaria = $4,
             cor_secundaria = $5,
             atualizado_em = NOW()
         WHERE id = $6 AND ativo = 1
         RETURNING id, nome, slug, ativo, white_label_ativo, nome_exibicao,
                   logo_url, cor_primaria, cor_secundaria, atualizado_em`,
        [
          dados.white_label_ativo,
          dados.nome_exibicao,
          dados.logo_url,
          dados.cor_primaria,
          dados.cor_secundaria,
          req.user.restaurante_id,
        ],
      );

      if (!rows[0]) {
        return res.status(404).json({ erro: "Restaurante nao encontrado" });
      }
      return res.json(rows[0]);
    } catch (error) {
      if (error instanceof BrandingValidationError) {
        return res.status(error.statusCode).json({ erro: error.message });
      }
      return res.status(500).json({ erro: "Nao foi possivel salvar o white label" });
    }
  },
);

app.get("/api/usuarios", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT id, nome, login, role, ativo, restaurante_id
       FROM usuarios
       WHERE restaurante_id = $1
       ORDER BY role, nome`,
      [req.user.restaurante_id],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post("/api/usuarios", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  const { nome, login, senha, role } = req.body;
  if (!nome || !senha || !role) return res.status(400).json({ erro: "Dados incompletos" });
  if (!["garcom", "cozinha", "financeiro", "admin"].includes(role))
    return res.status(400).json({ erro: "Role invalido" });

  const loginFinal = normalizarLogin(login || nome);
  try {
    const { rows: existing } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT id FROM usuarios
       WHERE login = $1 AND restaurante_id = $2`,
      [loginFinal, req.user.restaurante_id],
    );
    if (existing[0]) return res.status(400).json({ erro: "Login ja existe, escolha outro" });

    const limites = await carregarLimitesPlano(req.user.restaurante_id);
    const usuariosAtivos = await contarRegistrosTenant(
      req.user.restaurante_id,
      "usuarios",
      "AND ativo = 1",
    );
    if (usuariosAtivos >= limites.limite_usuarios) {
      return res.status(400).json({
        erro: `Limite de ${limites.limite_usuarios} usuarios ativos atingido pelo plano atual`,
      });
    }

    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `INSERT INTO usuarios
         (nome, login, senha, role, restaurante_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [nome, loginFinal, await hashSenha(senha), role, req.user.restaurante_id],
    );
    res.json({ id: rows[0].id, login: loginFinal });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.patch("/api/usuarios/:id", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    const { nome, login, senha, ativo, role } = req.body;
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      "SELECT * FROM usuarios WHERE id = $1 AND restaurante_id = $2",
      [req.params.id, req.user.restaurante_id],
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuario nao encontrado" });
    const u = rows[0];
    const novoLogin = normalizarLogin(login || u.login || u.nome);
    const novaSenha = senha && senha.length > 0 ? await hashSenha(senha) : u.senha;
    const novoAtivo = ativo ?? u.ativo;
    if (Number(novoAtivo) === 1 && Number(u.ativo) !== 1) {
      const limites = await carregarLimitesPlano(req.user.restaurante_id);
      const usuariosAtivos = await contarRegistrosTenant(
        req.user.restaurante_id,
        "usuarios",
        "AND ativo = 1",
      );
      if (usuariosAtivos >= limites.limite_usuarios) {
        return res.status(400).json({
          erro: `Limite de ${limites.limite_usuarios} usuarios ativos atingido pelo plano atual`,
        });
      }
    }
    await tenantQuery(
      req.user.restaurante_id,
      `UPDATE usuarios
       SET nome = $1, login = $2, senha = $3, ativo = $4, role = $5
       WHERE id = $6 AND restaurante_id = $7`,
      [
        nome ?? u.nome,
        novoLogin,
        novaSenha,
        novoAtivo,
        role ?? u.role,
        req.params.id,
        req.user.restaurante_id,
      ],
    );
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.delete("/api/usuarios/:id", autenticarJWT, autorizarRoles("admin"), async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ erro: "Nao e possivel remover o usuario atual" });
    }
    await tenantQuery(
      req.user.restaurante_id,
      "DELETE FROM usuarios WHERE id = $1 AND restaurante_id = $2",
      [req.params.id, req.user.restaurante_id],
    );
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ─── SOCKET.IO ─────────────────────────────────────────────────────────────
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.message === "Origem nao permitida pelo CORS.") {
    return res.status(403).json({ erro: "Origem nao permitida" });
  }

  console.error("Erro nao tratado na API:", error.message);
  return res.status(500).json({ erro: "Erro interno do servidor" });
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  try {
    if (token) {
      socket.user = usuarioDoToken(token);
      socket.publicContext = null;
      return next();
    }

    socket.user = null;
    const mesaId = Number(socket.handshake.auth?.mesa_id);
    const restauranteSlug = socket.handshake.auth?.restaurante_slug;
    if (!Number.isInteger(mesaId) || mesaId <= 0 || !restauranteSlug) {
      socket.publicContext = null;
      return next();
    }

    const contexto = await buscarRestauranteDaMesa(mesaId, restauranteSlug);
    if (!contexto) {
      return next(new Error("Mesa ou restaurante invalido para o Socket.IO"));
    }
    await validarSessaoMesa(
      contexto.restaurante.id,
      contexto.mesa.id,
      socket.handshake.auth?.sessao,
    );
    socket.publicContext = {
      restaurante_id: contexto.restaurante.id,
      restaurante_slug: contexto.restaurante.slug,
      mesa_id: contexto.mesa.id,
    };
    return next();
  } catch (e) {
    return next(new Error("Token Socket.IO invalido ou expirado"));
  }
});

function socketTemRole(socket, ...rolesPermitidas) {
  return socket.user?.role === "admin" || rolesPermitidas.includes(socket.user?.role);
}

function exigirSocketRole(socket, evento, ...rolesPermitidas) {
  if (socketTemRole(socket, ...rolesPermitidas)) return true;
  socket.emit("erro_autorizacao", {
    evento,
    erro: "Permissao insuficiente para emitir este evento.",
  });
  return false;
}

io.on("connection", (socket) => {
  const restauranteId =
    socket.user?.restaurante_id || socket.publicContext?.restaurante_id;
  const mesaId = socket.publicContext?.mesa_id;

  if (restauranteId) socket.join(salaRestaurante(restauranteId));
  if (socket.user) socket.join(salaEquipe(restauranteId));
  if (mesaId) socket.join(salaMesa(restauranteId, mesaId));

  console.log(
    "Cliente conectado:",
    socket.id,
    socket.user?.role || (mesaId ? `mesa:${mesaId}` : "publico"),
  );

  socket.on("pedido_ficou_pronto", async (data) => {
    if (!exigirSocketRole(socket, "pedido_ficou_pronto", "cozinha")) return;
    try {
      emitirEquipe(restauranteId, "pedido_pronto", data);

      const mesaDoPedido = Number(data?.mesa_id);
      if (!Number.isInteger(mesaDoPedido) || mesaDoPedido <= 0) return;
      const { rows } = await tenantQuery(
        restauranteId,
        "SELECT id FROM mesas WHERE id = $1 AND restaurante_id = $2",
        [mesaDoPedido, restauranteId],
      );
      if (rows[0]) emitirMesa(restauranteId, mesaDoPedido, "pedido_pronto", data);
    } catch {
      socket.emit("erro_operacao", { evento: "pedido_ficou_pronto" });
    }
  });

  socket.on("mesa_fechada_event", async (mesa_id) => {
    if (!exigirSocketRole(socket, "mesa_fechada_event", "garcom", "financeiro")) return;
    try {
      const mesaIdFechada = Number(mesa_id);
      if (!Number.isInteger(mesaIdFechada) || mesaIdFechada <= 0) return;

      const { rows } = await tenantQuery(
        restauranteId,
        "SELECT id FROM mesas WHERE id = $1 AND restaurante_id = $2",
        [mesaIdFechada, restauranteId],
      );
      if (!rows[0]) return;

      emitirEquipe(restauranteId, "mesa_fechada", mesaIdFechada);
      emitirMesa(restauranteId, mesaIdFechada, "mesa_fechada", mesaIdFechada);
    } catch {
      socket.emit("erro_operacao", { evento: "mesa_fechada_event" });
    }
  });

  socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id));
});

// START
const PORT = process.env.PORT || 3001;

module.exports = server;

if (!process.env.VERCEL) {
  initDB()
    .then(() => {
      server.listen(PORT, "0.0.0.0", () => {
        const ip = getLocalIP();
        console.log(`\n🍽️  Servidor rodando!`);
        console.log(`   Local:    http://localhost:${PORT}`);
        console.log(`   Rede:     http://${ip}:${PORT}`);
        console.log(`   QR Code:  http://${ip}:${PORT}/api/qrcode/1\n`);
      });
    })
    .catch((err) => {
      console.error("❌ Erro ao conectar no banco:", err.message);
      process.exit(1);
    });
}
