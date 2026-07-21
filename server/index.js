const express = require("express");
const http = require("http");
const crypto = require("crypto");
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
  CommercialControlValidationError,
  anexarControleComercial,
  normalizarCamposComerciais,
  resumoSaas,
} = require("./lib/commercial-control");
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
  ImportacaoHistoricoError,
  ImportacaoRollbackError,
  JANELA_ROLLBACK_HORAS,
  normalizarMetadadosImportacao,
  objetosEquivalentes,
  rollbackDisponivel,
} = require("./lib/importacao-historico");
const {
  PlanHistoryValidationError,
  descreverHistoricoPlano,
  normalizarHistoricoPlano,
  normalizarLinhaHistoricoPlano,
} = require("./lib/plan-history");
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
  gerarCodigoAcompanhamentoReserva,
  normalizarCriacaoReserva,
  normalizarFiltrosReservas,
  normalizarMesaId,
  normalizarSalaoId,
  normalizarStatusReserva,
} = require("./lib/reservas");
const {
  ReservaEventoValidationError,
  descricaoCompartilhamentoReserva,
  normalizarEventoReserva,
  origemEventoPorUsuario,
} = require("./lib/reserva-eventos");
const {
  ReservaNotificacaoValidationError,
  montarNotificacoesReserva,
  normalizarNotificacaoReserva,
  resumoNotificacoesReserva,
} = require("./lib/reserva-notificacoes");
const {
  CONFIG_RESERVAS_PADRAO,
  STATUS_RESERVA_BLOQUEIAM_CAPACIDADE,
  ReservaDisponibilidadeValidationError,
  avaliarSlotReserva,
  gerarHorariosReserva,
  normalizarConfiguracaoReservas,
  normalizarSalaoReserva,
} = require("./lib/reserva-disponibilidade");
const {
  MesaSessionValidationError,
  calcularExpiracaoSessaoMesa,
  criarTokenSessaoMesa,
  hashTokenSessaoMesa,
} = require("./lib/mesa-session");
const {
  AuthSessionError,
  revalidarUsuarioToken,
} = require("./lib/auth-session");
const { origemCriacaoPedido } = require("./lib/pedido-access");
const {
  dataISOEmFuso,
  intervaloRelatorio,
} = require("./lib/restaurant-time");
const {
  acaoMesaRateLimit,
  acompanharReservaRateLimit,
  criarReservaRateLimit,
  leituraMesaRateLimit,
  leituraPublicaRateLimit,
} = require("./lib/request-limits");

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
const RESERVA_NOTIFICACAO_WEBHOOK_URL = String(
  process.env.RESERVA_NOTIFICACAO_WEBHOOK_URL || "",
).trim();
const RESERVA_NOTIFICACAO_WEBHOOK_TOKEN = String(
  process.env.RESERVA_NOTIFICACAO_WEBHOOK_TOKEN || "",
).trim();
const RESERVA_NOTIFICACAO_PROVIDER = String(
  process.env.RESERVA_NOTIFICACAO_PROVIDER || "webhook",
).trim();

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
app.use(express.json({ limit: "1mb" }));
app.use(registrarLogRequisicao);

app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Falha no health check do banco:", error.message);
    res.status(503).json({ status: "indisponivel" });
  }
});

app.get("/api/restaurantes/:slug/publico", leituraPublicaRateLimit, async (req, res) => {
  try {
    const restaurante = await buscarRestaurantePorSlug(req.params.slug);
    if (!restaurante) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }
    registrarRestauranteRequest(req, restaurante);
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

function limitarSeSemAutenticacao(limitador) {
  return (req, res, next) => {
    if (req.headers.authorization) return next();
    return limitador(req, res, next);
  };
}

function limitarSeSemUsuario(limitador) {
  return (req, res, next) => {
    if (req.user) return next();
    return limitador(req, res, next);
  };
}

function gerarRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function caminhoRequest(req) {
  return String(req.originalUrl || req.url || req.path || "").split("?")[0] || "/";
}

function registrarRestauranteRequest(req, contexto) {
  const restaurante = contexto?.restaurante || contexto;
  if (!restaurante?.id) return;
  req.restauranteId = restaurante.id;
  req.restauranteSlug = restaurante.slug || req.restauranteSlug || null;
}

function registrarLogRequisicao(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const headerRequestId = req.headers["x-request-id"];
  req.requestId = String(
    Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId || gerarRequestId(),
  );
  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const usuario = req.user || req.platformUser || null;
    const payload = {
      timestamp: new Date().toISOString(),
      type: "http_request",
      request_id: req.requestId,
      method: req.method,
      route: req.route?.path || caminhoRequest(req),
      path: caminhoRequest(req),
      status: res.statusCode,
      latency_ms: Number(latencyMs.toFixed(1)),
      restaurante_id: req.user?.restaurante_id || req.restauranteId || null,
      role: req.user?.role || req.platformUser?.role || null,
      user_id: usuario?.id || null,
      scope: req.platformUser ? "platform" : req.user ? "tenant" : "public",
    };
    const linha = JSON.stringify(payload);

    if (res.statusCode >= 500) {
      console.error(linha);
    } else if (res.statusCode >= 400) {
      console.warn(linha);
    } else {
      console.log(linha);
    }
  });

  return next();
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

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
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

async function buscarRestaurantePorSlug(slugInformado, options = {}) {
  const slug = normalizarSlug(slugInformado || "autenix");
  if (!slug) return null;
  const incluirArquivado = options.incluirArquivado === true;
  const incluirInativo = options.incluirInativo === true || incluirArquivado;

  const { rows } = await query(
    `SELECT id, nome, slug, ativo, white_label_ativo, nome_exibicao,
            logo_url, cor_primaria, cor_secundaria,
            cor_texto_principal, cor_texto_secundario, cor_titulo,
            cor_texto_inverso, whatsapp_numero, excluido_em
     FROM restaurantes
     WHERE slug = $1
       AND ($2::boolean OR ativo = 1)
       AND ($3::boolean OR excluido_em IS NULL)
     LIMIT 1`,
    [slug, incluirInativo, incluirArquivado],
  );
  return rows[0] || null;
}

async function buscarRestauranteNotificacao(client, restauranteId) {
  const { rows } = await client.query(
    `SELECT id, nome, slug, white_label_ativo, nome_exibicao, whatsapp_numero
     FROM restaurantes
     WHERE id = $1
     LIMIT 1`,
    [restauranteId],
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

function responderErroAutenticacao(res, error, contexto = "sessao") {
  if (error instanceof AuthSessionError) {
    return res.status(401).json({ erro: error.message });
  }
  console.error(`Falha ao validar ${contexto}:`, error.message);
  return res.status(503).json({ erro: "Nao foi possivel validar o acesso agora" });
}

async function autenticarJWT(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [tipo, token] = authHeader.split(" ");
  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ erro: "Token de autenticacao ausente" });
  }

  try {
    req.user = await revalidarUsuarioToken({ token, secret: JWT_SECRET, tenantQuery });
    return next();
  } catch (error) {
    return responderErroAutenticacao(res, error);
  }
}

async function autenticarJWTSePresente(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [tipo, token] = authHeader.split(" ");
  if (tipo !== "Bearer" || !token) return next();

  try {
    req.user = await revalidarUsuarioToken({ token, secret: JWT_SECRET, tenantQuery });
    return next();
  } catch (error) {
    return responderErroAutenticacao(res, error);
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
      finalizado_em TIMESTAMPTZ,
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
      salao_id INTEGER,
      nome_cliente TEXT NOT NULL,
      telefone TEXT NOT NULL,
      email TEXT,
      data_reserva DATE NOT NULL,
      horario TIME NOT NULL,
      quantidade_pessoas INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'pendente',
      observacao TEXT,
      origem TEXT NOT NULL DEFAULT 'publica',
      tipo TEXT NOT NULL DEFAULT 'reserva',
      codigo_acompanhamento TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      confirmada_em TIMESTAMP,
      cancelada_em TIMESTAMP,
      concluida_em TIMESTAMP,
      entrou_fila_em TIMESTAMP,
      chamada_em TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservas_eventos (
      id SERIAL PRIMARY KEY,
      restaurante_id INTEGER NOT NULL,
      reserva_id INTEGER NOT NULL,
      usuario_id INTEGER,
      usuario_nome TEXT,
      usuario_role TEXT,
      origem TEXT NOT NULL DEFAULT 'sistema',
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      status_anterior TEXT,
      status_novo TEXT,
      mesa_id_anterior INTEGER,
      mesa_id_novo INTEGER,
      detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservas_configuracoes (
      restaurante_id INTEGER PRIMARY KEY,
      ativo INTEGER NOT NULL DEFAULT 1,
      dias_semana JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
      hora_inicio TIME NOT NULL DEFAULT '18:00',
      hora_fim TIME NOT NULL DEFAULT '23:00',
      intervalo_minutos INTEGER NOT NULL DEFAULT 30,
      duracao_minutos INTEGER NOT NULL DEFAULT 90,
      antecedencia_minutos INTEGER NOT NULL DEFAULT 60,
      horizonte_dias INTEGER NOT NULL DEFAULT 30,
      limite_reservas_horario INTEGER NOT NULL DEFAULT 0,
      limite_pessoas_horario INTEGER NOT NULL DEFAULT 0,
      permitir_fila INTEGER NOT NULL DEFAULT 1,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservas_saloes (
      id SERIAL PRIMARY KEY,
      restaurante_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      capacidade_pessoas INTEGER NOT NULL DEFAULT 40,
      ativo INTEGER NOT NULL DEFAULT 1,
      ordem INTEGER NOT NULL DEFAULT 0,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

    ALTER TABLE categorias
      ADD COLUMN IF NOT EXISTS ativo INTEGER NOT NULL DEFAULT 1;

    ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ;

    ALTER TABLE restaurantes
      ADD COLUMN IF NOT EXISTS whatsapp_numero TEXT,
      ADD COLUMN IF NOT EXISTS cor_texto_principal TEXT,
      ADD COLUMN IF NOT EXISTS cor_texto_secundario TEXT,
      ADD COLUMN IF NOT EXISTS cor_titulo TEXT,
      ADD COLUMN IF NOT EXISTS cor_texto_inverso TEXT,
      ADD COLUMN IF NOT EXISTS status_comercial TEXT NOT NULL DEFAULT 'trial',
      ADD COLUMN IF NOT EXISTS data_inicio_contrato DATE,
      ADD COLUMN IF NOT EXISTS ultimo_contato_comercial_em DATE,
      ADD COLUMN IF NOT EXISTS responsavel_comercial TEXT,
      ADD COLUMN IF NOT EXISTS motivo_suspensao TEXT;

    ALTER TABLE reservas
      ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'reserva',
      ADD COLUMN IF NOT EXISTS codigo_acompanhamento TEXT,
      ADD COLUMN IF NOT EXISTS entrou_fila_em TIMESTAMP,
      ADD COLUMN IF NOT EXISTS chamada_em TIMESTAMP,
      ADD COLUMN IF NOT EXISTS salao_id INTEGER;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_restaurante_codigo_acompanhamento
      ON reservas (restaurante_id, codigo_acompanhamento)
      WHERE codigo_acompanhamento IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_reservas_eventos_reserva_criado
      ON reservas_eventos (restaurante_id, reserva_id, criado_em DESC);

    CREATE INDEX IF NOT EXISTS idx_reservas_saloes_restaurante_ativo_ordem
      ON reservas_saloes (restaurante_id, ativo, ordem);

    CREATE INDEX IF NOT EXISTS idx_reservas_restaurante_salao_data_horario
      ON reservas (restaurante_id, salao_id, data_reserva, horario)
      WHERE salao_id IS NOT NULL;
  `);

  const restaurantePadrao = await buscarRestaurantePorSlug("autenix", {
    incluirArquivado: true,
  });
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
       r.id, r.restaurante_id, r.mesa_id, r.salao_id,
       r.nome_cliente, r.telefone, r.email,
       to_char(r.data_reserva, 'YYYY-MM-DD') AS data_reserva,
       to_char(r.horario, 'HH24:MI') AS horario,
       r.quantidade_pessoas, r.status, r.observacao, r.origem, r.tipo,
       r.codigo_acompanhamento, r.entrou_fila_em, r.chamada_em,
       r.criado_em, r.atualizado_em, r.confirmada_em, r.cancelada_em,
       r.concluida_em, m.numero AS mesa_numero,
       s.nome AS salao_nome, s.capacidade_pessoas AS salao_capacidade
     FROM reservas r
     LEFT JOIN mesas m
       ON m.id = r.mesa_id AND m.restaurante_id = r.restaurante_id
     LEFT JOIN reservas_saloes s
       ON s.id = r.salao_id AND s.restaurante_id = r.restaurante_id
     WHERE r.id = $1 AND r.restaurante_id = $2`,
    [reservaId, restauranteId],
  );
  return anexarPosicaoFila(restauranteId, rows[0] || null, executor);
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

function normalizarConfigReservaLinha(linha = {}) {
  return normalizarConfiguracaoReservas({
    ...linha,
    hora_inicio: linha.hora_inicio?.slice?.(0, 5) || linha.hora_inicio,
    hora_fim: linha.hora_fim?.slice?.(0, 5) || linha.hora_fim,
  });
}

async function buscarConfiguracaoReservas(client, restauranteId) {
  const { rows } = await client.query(
    `SELECT restaurante_id, ativo, dias_semana,
            to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
            to_char(hora_fim, 'HH24:MI') AS hora_fim,
            intervalo_minutos, duracao_minutos, antecedencia_minutos,
            horizonte_dias, limite_reservas_horario, limite_pessoas_horario,
            permitir_fila, atualizado_em
     FROM reservas_configuracoes
     WHERE restaurante_id = $1
     LIMIT 1`,
    [restauranteId],
  );
  if (rows[0]) return normalizarConfigReservaLinha(rows[0]);

  await client.query(
    `INSERT INTO reservas_configuracoes (restaurante_id)
     VALUES ($1)
     ON CONFLICT (restaurante_id) DO NOTHING`,
    [restauranteId],
  );
  return { ...CONFIG_RESERVAS_PADRAO };
}

async function listarSaloesReserva(client, restauranteId, incluirInativos = false) {
  const { rows } = await client.query(
    `SELECT id, restaurante_id, nome, capacidade_pessoas, ativo, ordem,
            criado_em, atualizado_em
     FROM reservas_saloes
     WHERE restaurante_id = $1
       AND ($2::boolean OR ativo = 1)
     ORDER BY ativo DESC, ordem ASC, nome ASC`,
    [restauranteId, incluirInativos],
  );
  if (rows.length || incluirInativos) return rows;

  const { rows: mesas } = await client.query(
    "SELECT COUNT(*)::integer AS total FROM mesas WHERE restaurante_id = $1",
    [restauranteId],
  );
  const capacidade = Math.max(Number(mesas[0]?.total || 0) * 4, 20);
  const { rows: criados } = await client.query(
    `INSERT INTO reservas_saloes
       (restaurante_id, nome, capacidade_pessoas, ativo, ordem)
     VALUES ($1, 'Salao principal', $2, 1, 1)
     RETURNING id, restaurante_id, nome, capacidade_pessoas, ativo, ordem,
               criado_em, atualizado_em`,
    [restauranteId, capacidade],
  );
  return criados;
}

async function buscarSalaoReserva(client, restauranteId, salaoId, incluirInativo = false) {
  const id = normalizarSalaoId(salaoId);
  if (!id) return null;
  const { rows } = await client.query(
    `SELECT id, restaurante_id, nome, capacidade_pessoas, ativo, ordem
     FROM reservas_saloes
     WHERE id = $1 AND restaurante_id = $2
       AND ($3::boolean OR ativo = 1)
     LIMIT 1`,
    [id, restauranteId, incluirInativo],
  );
  if (!rows[0]) {
    const error = new ReservasValidationError("Salao da reserva nao encontrado");
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function obterOcupacaoHorarioReserva(client, restauranteId, dados, ignorarReservaId = null) {
  const { rows } = await client.query(
    `SELECT
       COUNT(*)::integer AS reservas_horario,
       COALESCE(SUM(quantidade_pessoas), 0)::integer AS pessoas_horario,
       COALESCE(
         SUM(quantidade_pessoas) FILTER (
           WHERE $4::integer IS NOT NULL AND salao_id = $4::integer
         ),
         0
       )::integer AS pessoas_salao_horario
     FROM reservas
     WHERE restaurante_id = $1
       AND data_reserva = $2
       AND horario = $3::time
       AND status = ANY($5::text[])
       AND id <> COALESCE($6::integer, -1)`,
    [
      restauranteId,
      dados.data_reserva,
      dados.horario,
      dados.salao_id || null,
      STATUS_RESERVA_BLOQUEIAM_CAPACIDADE,
      ignorarReservaId,
    ],
  );
  return rows[0] || {
    reservas_horario: 0,
    pessoas_horario: 0,
    pessoas_salao_horario: 0,
  };
}

async function validarDisponibilidadeReserva(
  client,
  restauranteId,
  dados,
  options = {},
) {
  const configuracao = await buscarConfiguracaoReservas(client, restauranteId);
  const salao = await buscarSalaoReserva(client, restauranteId, dados.salao_id);

  if (dados.tipo === "fila") {
    if (!configuracao.permitir_fila) {
      throw new ReservasValidationError("Fila de espera esta pausada no momento");
    }
    return { configuracao, salao, salao_id: salao?.id || null };
  }

  const ocupacao = await obterOcupacaoHorarioReserva(
    client,
    restauranteId,
    dados,
    options.ignorarReservaId,
  );
  const resultado = avaliarSlotReserva({
    configuracao,
    data_reserva: dados.data_reserva,
    horario: dados.horario,
    quantidade_pessoas: dados.quantidade_pessoas,
    salao,
    reservas_horario: ocupacao.reservas_horario,
    pessoas_horario: ocupacao.pessoas_horario,
    pessoas_salao_horario: ocupacao.pessoas_salao_horario,
  });
  if (!resultado.disponivel) {
    throw new ReservasValidationError(resultado.motivo);
  }
  return { configuracao, salao, salao_id: salao?.id || null, resultado };
}

async function listarHorariosDisponibilidadeReserva(client, restauranteId, queryParams) {
  const configuracao = await buscarConfiguracaoReservas(client, restauranteId);
  const salaoId = normalizarSalaoId(queryParams.salao_id);
  const salao = await buscarSalaoReserva(client, restauranteId, salaoId);
  const quantidade = Number(queryParams.quantidade_pessoas || 2);
  const data = String(queryParams.data_reserva || queryParams.data || "").trim();
  if (!data) return [];

  const horarios = gerarHorariosReserva(configuracao);
  const { rows } = await client.query(
    `SELECT
       to_char(horario, 'HH24:MI') AS horario,
       COUNT(*)::integer AS reservas_horario,
       COALESCE(SUM(quantidade_pessoas), 0)::integer AS pessoas_horario,
       COALESCE(
         SUM(quantidade_pessoas) FILTER (
           WHERE $3::integer IS NOT NULL AND salao_id = $3::integer
         ),
         0
       )::integer AS pessoas_salao_horario
     FROM reservas
     WHERE restaurante_id = $1
       AND data_reserva = $2
       AND status = ANY($4::text[])
     GROUP BY to_char(horario, 'HH24:MI')`,
    [restauranteId, data, salaoId, STATUS_RESERVA_BLOQUEIAM_CAPACIDADE],
  );
  const ocupacaoPorHorario = new Map(rows.map((row) => [row.horario, row]));

  return horarios.map((horario) => {
    const ocupacao = ocupacaoPorHorario.get(horario) || {};
    const avaliado = avaliarSlotReserva({
      configuracao,
      data_reserva: data,
      horario,
      quantidade_pessoas: quantidade,
      salao,
      reservas_horario: ocupacao.reservas_horario || 0,
      pessoas_horario: ocupacao.pessoas_horario || 0,
      pessoas_salao_horario: ocupacao.pessoas_salao_horario || 0,
    });
    return {
      ...avaliado,
      reservas_horario: Number(ocupacao.reservas_horario || 0),
      pessoas_horario: Number(ocupacao.pessoas_horario || 0),
      pessoas_salao_horario: Number(ocupacao.pessoas_salao_horario || 0),
    };
  });
}

async function gerarCodigoReservaUnico(client, restauranteId) {
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    const codigo = gerarCodigoAcompanhamentoReserva();
    const { rows } = await client.query(
      `SELECT id
       FROM reservas
       WHERE restaurante_id = $1 AND codigo_acompanhamento = $2
       LIMIT 1`,
      [restauranteId, codigo],
    );
    if (!rows[0]) return codigo;
  }

  const error = new ReservasValidationError("Nao foi possivel gerar o acompanhamento da reserva");
  error.statusCode = 500;
  throw error;
}

async function calcularPosicaoFilaReserva(client, restauranteId, reservaId) {
  const { rows } = await client.query(
    `WITH alvo AS (
       SELECT id, data_reserva, horario, COALESCE(entrou_fila_em, criado_em) AS entrada_fila
       FROM reservas
       WHERE restaurante_id = $1 AND id = $2 AND status = 'fila'
       LIMIT 1
     )
     SELECT (count(r.id) + 1)::integer AS posicao
     FROM alvo a
     LEFT JOIN reservas r
       ON r.restaurante_id = $1
      AND r.status = 'fila'
      AND r.id <> a.id
      AND (
        r.data_reserva,
        r.horario,
        COALESCE(r.entrou_fila_em, r.criado_em),
        r.id
      ) < (
        a.data_reserva,
        a.horario,
        a.entrada_fila,
        a.id
      )`,
    [restauranteId, reservaId],
  );
  return rows[0]?.posicao || null;
}

async function anexarPosicaoFila(restauranteId, reserva, client = null) {
  if (!reserva || reserva.status !== "fila") return reserva;
  const executor = client || {
    query: (sql, params) => tenantQuery(restauranteId, sql, params),
  };
  const posicao = await calcularPosicaoFilaReserva(executor, restauranteId, reserva.id);
  return {
    ...reserva,
    posicao_fila: posicao,
    pessoas_antes: posicao ? Math.max(posicao - 1, 0) : null,
  };
}

function urlAcompanhamentoReserva(restauranteSlug, codigo) {
  return `${PUBLIC_APP_URL}/r/${restauranteSlug}/reservas/acompanhar/${encodeURIComponent(codigo)}`;
}

function dadosUsuarioEventoReserva(usuario, origemPadrao = "sistema") {
  return {
    usuario_id: usuario?.id || null,
    usuario_nome: usuario?.nome || null,
    usuario_role: usuario?.role || null,
    origem: origemEventoPorUsuario(usuario, origemPadrao),
  };
}

async function dadosUsuarioEventoReservaComNome(
  client,
  restauranteId,
  usuario,
  origemPadrao = "sistema",
) {
  const dados = dadosUsuarioEventoReserva(usuario, origemPadrao);
  if (!dados.usuario_nome && dados.usuario_id) {
    const { rows } = await client.query(
      "SELECT nome FROM usuarios WHERE id = $1 AND restaurante_id = $2",
      [dados.usuario_id, restauranteId],
    );
    dados.usuario_nome = rows[0]?.nome || null;
  }
  return dados;
}

async function registrarEventoReserva(client, restauranteId, reservaId, payload = {}) {
  const evento = normalizarEventoReserva(payload);
  await client.query(
    `INSERT INTO reservas_eventos
       (restaurante_id, reserva_id, usuario_id, usuario_nome, usuario_role,
        origem, tipo, descricao, status_anterior, status_novo,
        mesa_id_anterior, mesa_id_novo, detalhes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)`,
    [
      restauranteId,
      reservaId,
      payload.usuario_id || null,
      payload.usuario_nome || null,
      payload.usuario_role || null,
      evento.origem,
      evento.tipo,
      evento.descricao,
      evento.status_anterior,
      evento.status_novo,
      evento.mesa_id_anterior,
      evento.mesa_id_novo,
      JSON.stringify(evento.detalhes),
    ],
  );
}

async function listarEventosReserva(restauranteId, reservaId) {
  const { rows } = await tenantQuery(
    restauranteId,
    `SELECT id, reserva_id, usuario_id, usuario_nome, usuario_role,
            origem, tipo, descricao, status_anterior, status_novo,
            mesa_id_anterior, mesa_id_novo, detalhes, criado_em
     FROM reservas_eventos
     WHERE restaurante_id = $1 AND reserva_id = $2
     ORDER BY criado_em DESC, id DESC`,
    [restauranteId, reservaId],
  );
  return rows;
}

function providerNotificacaoReservasConfigurado() {
  return Boolean(RESERVA_NOTIFICACAO_WEBHOOK_URL);
}

async function registrarNotificacoesAutomaticasReserva(
  client,
  restauranteId,
  reserva,
  { restaurante, evento },
) {
  const restauranteNotificacao = restaurante
    || (await buscarRestauranteNotificacao(client, restauranteId));
  const acompanhamentoUrl = urlAcompanhamentoReserva(
    restauranteNotificacao?.slug || "autenix",
    reserva.codigo_acompanhamento,
  );
  const providerConfigurado = providerNotificacaoReservasConfigurado();
  const statusInicial = providerConfigurado ? "pendente" : "sem_provedor";
  const provider = providerConfigurado ? RESERVA_NOTIFICACAO_PROVIDER : null;
  const erroInicial = providerConfigurado
    ? null
    : "Provedor de notificacao nao configurado";

  const notificacoes = montarNotificacoesReserva({
    reserva,
    restaurante: restauranteNotificacao,
    evento,
    acompanhamentoUrl,
  }).map((item) => normalizarNotificacaoReserva({
    ...item,
    restaurante_id: restauranteId,
    reserva_id: reserva.id,
    provider,
    status: statusInicial,
    erro: erroInicial,
  }));

  if (!notificacoes.length) return [];

  const criadas = [];
  for (const notificacao of notificacoes) {
    const { rows } = await client.query(
      `INSERT INTO reservas_notificacoes
         (restaurante_id, reserva_id, canal, evento, destinatario, assunto,
          mensagem, payload, provider, status, erro, processado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11,
               CASE WHEN $10 = 'sem_provedor' THEN NOW() ELSE NULL END)
       RETURNING id, restaurante_id, reserva_id, canal, evento, destinatario,
                 assunto, mensagem, payload, provider, provider_message_id,
                 status, tentativas, erro, criado_em, processado_em`,
      [
        notificacao.restaurante_id,
        notificacao.reserva_id,
        notificacao.canal,
        notificacao.evento,
        notificacao.destinatario,
        notificacao.assunto,
        notificacao.mensagem,
        JSON.stringify(notificacao.payload),
        notificacao.provider,
        notificacao.status,
        notificacao.erro,
      ],
    );
    criadas.push(rows[0]);
  }

  const resumo = resumoNotificacoesReserva(criadas);
  await registrarEventoReserva(client, restauranteId, reserva.id, {
    tipo: "notificacao_automatica",
    origem: "sistema",
    descricao: providerConfigurado
      ? "Notificacao automatica enviada para processamento."
      : "Notificacao automatica registrada sem provedor configurado.",
    detalhes: {
      evento,
      canais: [...new Set(criadas.map((item) => item.canal))],
      resumo,
      provider_configurado: providerConfigurado,
    },
  });

  return criadas;
}

async function enviarNotificacaoReservaWebhook(notificacao) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const resposta = await fetch(RESERVA_NOTIFICACAO_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(RESERVA_NOTIFICACAO_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${RESERVA_NOTIFICACAO_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        id: notificacao.id,
        restaurante_id: notificacao.restaurante_id,
        reserva_id: notificacao.reserva_id,
        canal: notificacao.canal,
        evento: notificacao.evento,
        destinatario: notificacao.destinatario,
        assunto: notificacao.assunto,
        mensagem: notificacao.mensagem,
        payload: notificacao.payload,
      }),
      signal: controller.signal,
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(dados.erro || dados.message || "Webhook recusou a notificacao");
    }
    return {
      enviado: true,
      providerMessageId: dados.id || dados.message_id || dados.provider_message_id || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function processarNotificacoesReservas(notificacoes = []) {
  if (!providerNotificacaoReservasConfigurado()) return;
  for (const notificacao of notificacoes.filter((item) => item.status === "pendente")) {
    try {
      const envio = await enviarNotificacaoReservaWebhook(notificacao);
      await withTenantTransaction(notificacao.restaurante_id, (client) =>
        client.query(
          `UPDATE reservas_notificacoes
           SET status = 'enviado',
               provider_message_id = $1,
               tentativas = tentativas + 1,
               erro = NULL,
               processado_em = NOW()
           WHERE id = $2 AND restaurante_id = $3`,
          [envio.providerMessageId, notificacao.id, notificacao.restaurante_id],
        ),
      );
    } catch (error) {
      await withTenantTransaction(notificacao.restaurante_id, (client) =>
        client.query(
          `UPDATE reservas_notificacoes
           SET status = 'erro',
               tentativas = tentativas + 1,
               erro = LEFT($1, 500),
               processado_em = NOW()
           WHERE id = $2 AND restaurante_id = $3`,
          [error.message || "Falha ao enviar notificacao", notificacao.id, notificacao.restaurante_id],
        ),
      );
    }
  }
}

function responderErroReserva(res, error) {
  if (
    error instanceof ReservasValidationError ||
    error instanceof ReservaEventoValidationError ||
    error instanceof ReservaDisponibilidadeValidationError ||
    error instanceof ReservaNotificacaoValidationError
  ) {
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
app.get("/api/cardapio", leituraPublicaRateLimit, async (req, res) => {
  try {
    const restaurante = await buscarRestaurantePorSlug(
      req.query.restaurante_slug || "autenix",
    );
    if (!restaurante) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }
    registrarRestauranteRequest(req, restaurante);
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

app.get("/api/mesas/:id", leituraMesaRateLimit, async (req, res) => {
  try {
    const contexto = await buscarRestauranteDaMesa(
      req.params.id,
      req.query.restaurante_slug || "autenix",
    );
    if (!contexto) return res.status(404).json({ erro: "Mesa não encontrada" });
    registrarRestauranteRequest(req, contexto);
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

// Fazer pedido (cliente com sessao da mesa ou garcom autenticado)
app.post(
  "/api/pedidos",
  autenticarJWTSePresente,
  limitarSeSemUsuario(acaoMesaRateLimit),
  async (req, res) => {
  const { mesa_id, itens, nome_cliente, restaurante_slug } = req.body;
  if (!mesa_id || !itens?.length)
    return res.status(400).json({ erro: "Dados inválidos" });

  try {
    const contexto = await buscarRestauranteDaMesa(
      mesa_id,
      req.user?.restaurante_slug || restaurante_slug || "autenix",
    );
    if (!contexto) return res.status(404).json({ erro: "Mesa não encontrada" });

    registrarRestauranteRequest(req, contexto);
    const restauranteId = contexto.restaurante.id;
    const origemPedido = origemCriacaoPedido(req.user, restauranteId);
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
        if (origemPedido === "mesa") {
          await validarSessaoMesaRequest(req, contexto, client);
        }

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
          [
            mesa_id,
            origemPedido === "equipe"
              ? `Garcom: ${req.user.nome}`
              : nome_cliente || null,
            numeroDia,
            restauranteId,
          ],
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
  },
);

// Listar pedidos (cozinha/admin)
app.get(
  "/api/pedidos",
  limitarSeSemAutenticacao(leituraMesaRateLimit),
  protegerListagemPedidos,
  async (req, res) => {
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
      registrarRestauranteRequest(req, contexto);
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
         SET status = $1,
             garcom_id = $2,
             garcom_nome = $3,
             finalizado_em = CASE
               WHEN $1 = 'finalizado' THEN CURRENT_TIMESTAMP
               ELSE finalizado_em
             END
         WHERE id = $4 AND restaurante_id = $5`,
        [status, req.user.id, garcom_nome, req.params.id, req.user.restaurante_id],
      );
    } else {
      await tenantQuery(
        req.user.restaurante_id,
        `UPDATE pedidos
         SET status = $1,
             finalizado_em = CASE
               WHEN $1 = 'finalizado' THEN CURRENT_TIMESTAMP
               ELSE finalizado_em
             END
         WHERE id = $2 AND restaurante_id = $3`,
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
app.patch("/api/itens/:id/cancelar", acaoMesaRateLimit, async (req, res) => {
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
    registrarRestauranteRequest(req, contexto);
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
           SET status = 'finalizado',
               forma_pagamento = $1,
               finalizado_em = CURRENT_TIMESTAMP
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
app.post("/api/chamadas", acaoMesaRateLimit, async (req, res) => {
  try {
    const { mesa_id, motivo, nome_cliente, restaurante_slug } = req.body;
    const contexto = await buscarRestauranteDaMesa(
      mesa_id,
      restaurante_slug || "autenix",
    );
    if (!contexto) return res.status(404).json({ erro: "Mesa nao encontrada" });
    registrarRestauranteRequest(req, contexto);
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

app.post("/api/reservas", criarReservaRateLimit, async (req, res) => {
  try {
    const restaurante = await buscarRestaurantePorSlug(
      req.body?.restaurante_slug || "autenix",
    );
    if (!restaurante) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }
    registrarRestauranteRequest(req, restaurante);

    const dados = normalizarCriacaoReserva(req.body, { origem: "publica" });
    const resultado = await withTenantTransaction(
      restaurante.id,
      async (client, restauranteId) => {
        await validarMesaReserva(client, restauranteId, dados.mesa_id);
        const disponibilidadeReserva = await validarDisponibilidadeReserva(
          client,
          restauranteId,
          dados,
        );
        const codigoAcompanhamento = await gerarCodigoReservaUnico(
          client,
          restauranteId,
        );
        const statusInicial = dados.tipo === "fila" ? "fila" : "pendente";
        const { rows } = await client.query(
          `INSERT INTO reservas
             (restaurante_id, mesa_id, salao_id, nome_cliente, telefone, email,
              data_reserva, horario, quantidade_pessoas, observacao, origem,
              tipo, status, codigo_acompanhamento, entrou_fila_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::time, $9, $10, $11,
                   $12, $13, $14, CASE WHEN $13 = 'fila' THEN NOW() ELSE NULL END)
           RETURNING id`,
          [
            restauranteId,
            dados.mesa_id,
            disponibilidadeReserva.salao_id,
            dados.nome_cliente,
            dados.telefone,
            dados.email,
            dados.data_reserva,
            dados.horario,
            dados.quantidade_pessoas,
            dados.observacao,
            dados.origem,
            dados.tipo,
            statusInicial,
            codigoAcompanhamento,
          ],
        );
        const reservaId = rows[0].id;
        await registrarEventoReserva(client, restauranteId, reservaId, {
          tipo: "criada",
          origem: "publica",
          status_novo: statusInicial,
          mesa_id_novo: dados.mesa_id,
          detalhes: {
            tipo: dados.tipo,
            origem: dados.origem,
            salao_id: disponibilidadeReserva.salao_id,
          },
        });
        const reserva = await buscarReservaCompleta(restauranteId, reservaId, client);
        const notificacoes = await registrarNotificacoesAutomaticasReserva(
          client,
          restauranteId,
          reserva,
          {
            restaurante,
            evento: statusInicial === "fila" ? "fila" : "criada",
          },
        );
        return { reserva, notificacoes };
      },
    );

    await processarNotificacoesReservas(resultado.notificacoes);
    emitirEquipe(restaurante.id, "nova_reserva", resultado.reserva);
    return res.status(201).json({
      sucesso: true,
      reserva: resultado.reserva,
      acompanhamento_url: urlAcompanhamentoReserva(
        restaurante.slug,
        resultado.reserva.codigo_acompanhamento,
      ),
      notificacoes_automaticas: resumoNotificacoesReserva(resultado.notificacoes),
    });
  } catch (error) {
    return responderErroReserva(res, error);
  }
});

app.get(
  "/api/reservas/acompanhar/:codigo",
  acompanharReservaRateLimit,
  async (req, res) => {
  try {
    const restaurante = await buscarRestaurantePorSlug(
      req.query.restaurante_slug || "autenix",
    );
    if (!restaurante) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }
    registrarRestauranteRequest(req, restaurante);

    const codigo = String(req.params.codigo || "").trim();
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(codigo)) {
      return res.status(400).json({ erro: "Codigo de acompanhamento invalido" });
    }

    const { rows } = await tenantQuery(
      restaurante.id,
      `SELECT id
       FROM reservas
       WHERE restaurante_id = $1 AND codigo_acompanhamento = $2
       LIMIT 1`,
      [restaurante.id, codigo],
    );
    if (!rows[0]) {
      return res.status(404).json({ erro: "Reserva nao encontrada" });
    }

    const reserva = await buscarReservaCompleta(restaurante.id, rows[0].id);
    return res.json({
      restaurante: marcaPublica(restaurante),
      reserva: {
        ...reserva,
        pessoas_antes: reserva.posicao_fila
          ? Math.max(Number(reserva.posicao_fila) - 1, 0)
          : null,
      },
    });
  } catch (error) {
    return responderErroReserva(res, error);
  }
});

app.get(
  "/api/reservas/disponibilidade",
  leituraPublicaRateLimit,
  async (req, res) => {
  try {
    const restaurante = await buscarRestaurantePorSlug(
      req.query.restaurante_slug || "autenix",
    );
    if (!restaurante) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }
    registrarRestauranteRequest(req, restaurante);

    const resposta = await withTenantTransaction(
      restaurante.id,
      async (client, restauranteId) => {
        const { rows } = await client.query(
          `SELECT
             count(*)::integer AS total_mesas,
             count(*) FILTER (WHERE status = 'livre')::integer AS mesas_livres,
             count(*) FILTER (WHERE status = 'ocupada')::integer AS mesas_ocupadas
           FROM mesas
           WHERE restaurante_id = $1`,
          [restauranteId],
        );
        const resumo = rows[0] || {
          total_mesas: 0,
          mesas_livres: 0,
          mesas_ocupadas: 0,
        };
        const configuracao = await buscarConfiguracaoReservas(client, restauranteId);
        const saloes = await listarSaloesReserva(client, restauranteId);
        const horarios = await listarHorariosDisponibilidadeReserva(
          client,
          restauranteId,
          req.query,
        );
        return {
          ...resumo,
          restaurante_cheio:
            Number(resumo.total_mesas) > 0 && Number(resumo.mesas_livres) === 0,
          configuracao,
          saloes,
          horarios,
        };
      },
    );
    return res.json(resposta);
  } catch (error) {
    return responderErroReserva(res, error);
  }
});

app.get(
  "/api/reservas/configuracao",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const dados = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => ({
          configuracao: await buscarConfiguracaoReservas(client, restauranteId),
          saloes: await listarSaloesReserva(client, restauranteId, true),
        }),
      );
      return res.json(dados);
    } catch (error) {
      return responderErroReserva(res, error);
    }
  },
);

app.patch(
  "/api/reservas/configuracao",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const configuracao = normalizarConfiguracaoReservas(req.body || {});
      const dados = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          await client.query(
            `INSERT INTO reservas_configuracoes
               (restaurante_id, ativo, dias_semana, hora_inicio, hora_fim,
                intervalo_minutos, duracao_minutos, antecedencia_minutos,
                horizonte_dias, limite_reservas_horario, limite_pessoas_horario,
                permitir_fila, atualizado_em)
             VALUES ($1, $2, $3::jsonb, $4::time, $5::time, $6, $7, $8,
                     $9, $10, $11, $12, NOW())
             ON CONFLICT (restaurante_id) DO UPDATE SET
               ativo = EXCLUDED.ativo,
               dias_semana = EXCLUDED.dias_semana,
               hora_inicio = EXCLUDED.hora_inicio,
               hora_fim = EXCLUDED.hora_fim,
               intervalo_minutos = EXCLUDED.intervalo_minutos,
               duracao_minutos = EXCLUDED.duracao_minutos,
               antecedencia_minutos = EXCLUDED.antecedencia_minutos,
               horizonte_dias = EXCLUDED.horizonte_dias,
               limite_reservas_horario = EXCLUDED.limite_reservas_horario,
               limite_pessoas_horario = EXCLUDED.limite_pessoas_horario,
               permitir_fila = EXCLUDED.permitir_fila,
               atualizado_em = NOW()`,
            [
              restauranteId,
              configuracao.ativo,
              JSON.stringify(configuracao.dias_semana),
              configuracao.hora_inicio,
              configuracao.hora_fim,
              configuracao.intervalo_minutos,
              configuracao.duracao_minutos,
              configuracao.antecedencia_minutos,
              configuracao.horizonte_dias,
              configuracao.limite_reservas_horario,
              configuracao.limite_pessoas_horario,
              configuracao.permitir_fila,
            ],
          );
          return {
            configuracao: await buscarConfiguracaoReservas(client, restauranteId),
            saloes: await listarSaloesReserva(client, restauranteId, true),
          };
        },
      );
      return res.json(dados);
    } catch (error) {
      return responderErroReserva(res, error);
    }
  },
);

app.post(
  "/api/reservas/saloes",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const salao = normalizarSalaoReserva(req.body || {});
      const dados = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          const { rows } = await client.query(
            `INSERT INTO reservas_saloes
               (restaurante_id, nome, capacidade_pessoas, ativo, ordem)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, restaurante_id, nome, capacidade_pessoas, ativo,
                       ordem, criado_em, atualizado_em`,
            [
              restauranteId,
              salao.nome,
              salao.capacidade_pessoas,
              salao.ativo,
              salao.ordem,
            ],
          );
          return rows[0];
        },
      );
      return res.status(201).json(dados);
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ erro: "Ja existe um salao com este nome" });
      }
      return responderErroReserva(res, error);
    }
  },
);

app.patch(
  "/api/reservas/saloes/:id",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const salaoId = normalizarSalaoId(req.params.id);
      const salao = normalizarSalaoReserva(req.body || {});
      const dados = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          const { rows } = await client.query(
            `UPDATE reservas_saloes
             SET nome = $1,
                 capacidade_pessoas = $2,
                 ativo = $3,
                 ordem = $4,
                 atualizado_em = NOW()
             WHERE id = $5 AND restaurante_id = $6
             RETURNING id, restaurante_id, nome, capacidade_pessoas, ativo,
                       ordem, criado_em, atualizado_em`,
            [
              salao.nome,
              salao.capacidade_pessoas,
              salao.ativo,
              salao.ordem,
              salaoId,
              restauranteId,
            ],
          );
          if (!rows[0]) {
            const error = new ReservasValidationError("Salao nao encontrado");
            error.statusCode = 404;
            throw error;
          }
          return rows[0];
        },
      );
      return res.json(dados);
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ erro: "Ja existe um salao com este nome" });
      }
      return responderErroReserva(res, error);
    }
  },
);

app.delete(
  "/api/reservas/saloes/:id",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const salaoId = normalizarSalaoId(req.params.id);
      await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          const { rows } = await client.query(
            `UPDATE reservas_saloes
             SET ativo = 0, atualizado_em = NOW()
             WHERE id = $1 AND restaurante_id = $2
             RETURNING id`,
            [salaoId, restauranteId],
          );
          if (!rows[0]) {
            const error = new ReservasValidationError("Salao nao encontrado");
            error.statusCode = 404;
            throw error;
          }
        },
      );
      return res.json({ sucesso: true });
    } catch (error) {
      return responderErroReserva(res, error);
    }
  },
);

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
          r.id, r.restaurante_id, r.mesa_id, r.salao_id,
          r.nome_cliente, r.telefone, r.email,
          to_char(r.data_reserva, 'YYYY-MM-DD') AS data_reserva,
          to_char(r.horario, 'HH24:MI') AS horario,
          r.quantidade_pessoas, r.status, r.observacao, r.origem, r.tipo,
          r.codigo_acompanhamento, r.entrou_fila_em, r.chamada_em,
          r.criado_em, r.atualizado_em, r.confirmada_em, r.cancelada_em,
          r.concluida_em, m.numero AS mesa_numero,
          s.nome AS salao_nome, s.capacidade_pessoas AS salao_capacidade,
          CASE WHEN r.status = 'fila' THEN (
            SELECT (count(f.id) + 1)::integer
            FROM reservas f
            WHERE f.restaurante_id = r.restaurante_id
              AND f.status = 'fila'
              AND f.id <> r.id
              AND (
                f.data_reserva,
                f.horario,
                COALESCE(f.entrou_fila_em, f.criado_em),
                f.id
              ) < (
                r.data_reserva,
                r.horario,
                COALESCE(r.entrou_fila_em, r.criado_em),
                r.id
              )
          ) ELSE NULL END AS posicao_fila
        FROM reservas r
        LEFT JOIN mesas m
          ON m.id = r.mesa_id AND m.restaurante_id = r.restaurante_id
        LEFT JOIN reservas_saloes s
          ON s.id = r.salao_id AND s.restaurante_id = r.restaurante_id
        WHERE r.restaurante_id = $1`;

      if (filtros.status) {
        sql += ` AND r.status = $${index++}`;
        params.push(filtros.status);
      }
      if (filtros.tipo) {
        sql += ` AND r.tipo = $${index++}`;
        params.push(filtros.tipo);
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
      const resultado = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          await validarMesaReserva(client, restauranteId, dados.mesa_id);
          const disponibilidadeReserva = await validarDisponibilidadeReserva(
            client,
            restauranteId,
            dados,
          );
          const codigoAcompanhamento = await gerarCodigoReservaUnico(
            client,
            restauranteId,
          );
          const statusInicial = dados.tipo === "fila" ? "fila" : "pendente";
          const { rows } = await client.query(
            `INSERT INTO reservas
               (restaurante_id, mesa_id, salao_id, nome_cliente, telefone, email,
                data_reserva, horario, quantidade_pessoas, observacao, origem,
                tipo, status, codigo_acompanhamento, entrou_fila_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::time, $9, $10, $11,
                     $12, $13, $14, CASE WHEN $13 = 'fila' THEN NOW() ELSE NULL END)
             RETURNING id`,
            [
              restauranteId,
              dados.mesa_id,
              disponibilidadeReserva.salao_id,
              dados.nome_cliente,
              dados.telefone,
              dados.email,
              dados.data_reserva,
              dados.horario,
              dados.quantidade_pessoas,
              dados.observacao,
              dados.origem,
              dados.tipo,
              statusInicial,
              codigoAcompanhamento,
            ],
          );
          const reservaId = rows[0].id;
          await registrarEventoReserva(client, restauranteId, reservaId, {
            tipo: "criada",
            ...(await dadosUsuarioEventoReservaComNome(
              client,
              restauranteId,
              req.user,
              "admin",
            )),
            status_novo: statusInicial,
            mesa_id_novo: dados.mesa_id,
            detalhes: {
              tipo: dados.tipo,
              origem: dados.origem,
              salao_id: disponibilidadeReserva.salao_id,
            },
          });
          const reserva = await buscarReservaCompleta(restauranteId, reservaId, client);
          const restaurante = await buscarRestauranteNotificacao(client, restauranteId);
          const notificacoes = await registrarNotificacoesAutomaticasReserva(
            client,
            restauranteId,
            reserva,
            {
              restaurante,
              evento: statusInicial === "fila" ? "fila" : "criada",
            },
          );
          return { reserva, notificacoes };
        },
      );

      await processarNotificacoesReservas(resultado.notificacoes);
      emitirEquipe(req.user.restaurante_id, "nova_reserva", resultado.reserva);
      return res.status(201).json({
        sucesso: true,
        reserva: resultado.reserva,
        acompanhamento_url: urlAcompanhamentoReserva(
          req.user.restaurante_slug,
          resultado.reserva.codigo_acompanhamento,
        ),
        notificacoes_automaticas: resumoNotificacoesReserva(resultado.notificacoes),
      });
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
      const deveAtualizarMesa = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "mesa_id",
      );
      const mesaId = deveAtualizarMesa
        ? normalizarMesaId(req.body?.mesa_id)
        : null;
      const colunasTimestamp = {
        confirmada: "confirmada_em",
        chamada: "chamada_em",
        cancelada: "cancelada_em",
        concluida: "concluida_em",
      };
      const colunaTimestamp = colunasTimestamp[status];
      const atualizarTimestamp = colunaTimestamp
        ? `, ${colunaTimestamp} = COALESCE(${colunaTimestamp}, NOW())`
        : "";
      const atualizarEntradaFila = status === "fila"
        ? ", entrou_fila_em = COALESCE(entrou_fila_em, NOW()), tipo = 'fila'"
        : "";

      const resultado = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          if (deveAtualizarMesa && mesaId) {
            await validarMesaReserva(client, restauranteId, mesaId);
          }
          const reservaAnterior = await buscarReservaCompleta(
            restauranteId,
            reservaId,
            client,
          );
          if (!reservaAnterior) {
            const error = new ReservasValidationError("Reserva nao encontrada");
            error.statusCode = 404;
            throw error;
          }
          const statusAtivoDestino = STATUS_RESERVA_BLOQUEIAM_CAPACIDADE.includes(status);
          const statusAtivoAnterior = STATUS_RESERVA_BLOQUEIAM_CAPACIDADE.includes(
            reservaAnterior.status,
          );
          const precisaValidarDisponibilidade =
            statusAtivoDestino &&
            (!statusAtivoAnterior ||
              (status === "fila" && reservaAnterior.status !== "fila"));
          if (precisaValidarDisponibilidade) {
            await validarDisponibilidadeReserva(
              client,
              restauranteId,
              {
                ...reservaAnterior,
                tipo: status === "fila" ? "fila" : reservaAnterior.tipo,
                salao_id: reservaAnterior.salao_id,
              },
              { ignorarReservaId: reservaId },
            );
          }
          const { rows } = await client.query(
            `UPDATE reservas
             SET status = $1,
                 mesa_id = CASE WHEN $4::boolean THEN $5::INTEGER ELSE mesa_id END,
                 atualizado_em = NOW()
                 ${atualizarTimestamp}
                 ${atualizarEntradaFila}
             WHERE id = $2 AND restaurante_id = $3
             RETURNING id`,
            [status, reservaId, restauranteId, deveAtualizarMesa, mesaId],
          );
          if (!rows[0]) {
            const error = new ReservasValidationError("Reserva nao encontrada");
            error.statusCode = 404;
            throw error;
          }
          const reservaAtualizada = await buscarReservaCompleta(
            restauranteId,
            reservaId,
            client,
          );
          if (status === "concluida") {
            if (reservaAtualizada?.mesa_id) {
              await client.query(
                `UPDATE mesas
                 SET status = 'ocupada'
                 WHERE id = $1 AND restaurante_id = $2`,
                [reservaAtualizada.mesa_id, restauranteId],
              );
            }
          }
          const usuarioEvento = await dadosUsuarioEventoReservaComNome(
            client,
            restauranteId,
            req.user,
            "garcom",
          );
          if (reservaAnterior.status !== reservaAtualizada.status) {
            await registrarEventoReserva(client, restauranteId, reservaId, {
              tipo: "status_alterado",
              ...usuarioEvento,
              status_anterior: reservaAnterior.status,
              status_novo: reservaAtualizada.status,
            });
          }
          if (
            String(reservaAnterior.mesa_id || "") !==
            String(reservaAtualizada.mesa_id || "")
          ) {
            await registrarEventoReserva(client, restauranteId, reservaId, {
              tipo: "mesa_alterada",
              ...usuarioEvento,
              mesa_id_anterior: reservaAnterior.mesa_id,
              mesa_id_novo: reservaAtualizada.mesa_id,
            });
          }
          let notificacoes = [];
          if (
            reservaAnterior.status !== reservaAtualizada.status &&
            ["confirmada", "fila", "chamada", "cancelada", "concluida"].includes(
              reservaAtualizada.status,
            )
          ) {
            const restaurante = await buscarRestauranteNotificacao(client, restauranteId);
            notificacoes = await registrarNotificacoesAutomaticasReserva(
              client,
              restauranteId,
              reservaAtualizada,
              {
                restaurante,
                evento: reservaAtualizada.status,
              },
            );
          }
          return { reserva: reservaAtualizada, notificacoes };
        },
      );

      await processarNotificacoesReservas(resultado.notificacoes);
      const { reserva } = resultado;
      emitirEquipe(req.user.restaurante_id, "reserva_atualizada", reserva);
      if (status === "concluida" && reserva.mesa_id) {
        const { rows: mesas } = await tenantQuery(
          req.user.restaurante_id,
          "SELECT * FROM mesas WHERE id = $1 AND restaurante_id = $2",
          [reserva.mesa_id, req.user.restaurante_id],
        );
        if (mesas[0]) emitirEquipe(req.user.restaurante_id, "mesa_atualizada", mesas[0]);
      }
      return res.json({
        sucesso: true,
        reserva,
        notificacoes_automaticas: resumoNotificacoesReserva(resultado.notificacoes),
      });
    } catch (error) {
      return responderErroReserva(res, error);
    }
  },
);

app.get(
  "/api/reservas/:id/eventos",
  autenticarJWT,
  autorizarRoles("garcom", "financeiro"),
  async (req, res) => {
    try {
      const reservaId = Number(req.params.id);
      if (!Number.isInteger(reservaId) || reservaId <= 0) {
        throw new ReservasValidationError("Reserva invalida");
      }
      const reserva = await buscarReservaCompleta(req.user.restaurante_id, reservaId);
      if (!reserva) {
        const error = new ReservasValidationError("Reserva nao encontrada");
        error.statusCode = 404;
        throw error;
      }
      const eventos = await listarEventosReserva(req.user.restaurante_id, reservaId);
      return res.json({ reserva_id: reservaId, eventos });
    } catch (error) {
      return responderErroReserva(res, error);
    }
  },
);

app.post(
  "/api/reservas/:id/eventos",
  autenticarJWT,
  autorizarRoles("garcom"),
  async (req, res) => {
    try {
      const reservaId = Number(req.params.id);
      if (!Number.isInteger(reservaId) || reservaId <= 0) {
        throw new ReservasValidationError("Reserva invalida");
      }
      const canal = req.body?.canal;
      const resultado = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          const reserva = await buscarReservaCompleta(restauranteId, reservaId, client);
          if (!reserva) {
            const error = new ReservasValidationError("Reserva nao encontrada");
            error.statusCode = 404;
            throw error;
          }
          await registrarEventoReserva(client, restauranteId, reservaId, {
            tipo: "compartilhamento",
            ...(await dadosUsuarioEventoReservaComNome(
              client,
              restauranteId,
              req.user,
              "garcom",
            )),
            descricao: descricaoCompartilhamentoReserva(canal),
            detalhes: { canal },
          });
          return reserva;
        },
      );
      return res.status(201).json({ sucesso: true, reserva: resultado });
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
          analisarImportacao(client, restauranteId, req.body, {
            permitirImagemLocal: req.body?.tipo === "produtos",
          }),
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
          const importacao = await executarImportacao(
            client,
            restauranteId,
            analise,
            { payload: req.body, usuario: req.user },
          );
          return { analise, importacao };
        },
      );

      if (["categorias", "produtos"].includes(resultado.analise.tipo)) {
        emitirRestaurante(req.user.restaurante_id, "cardapio_atualizado");
      }
      return res.json(resultado);
    } catch (error) {
      if (
        error instanceof ImportacaoValidationError
        || error instanceof ImportacaoHistoricoError
      ) {
        return res.status(error.statusCode).json({
          erro: error.message,
          analise: error.analise,
        });
      }
      if (error.code === "23505") {
        return res.status(409).json({ erro: "Registro duplicado na importacao" });
      }
      console.error("Falha na importacao:", error.message);
      return res.status(500).json({
        erro: "Nao foi possivel executar a importacao",
        ...(isProduction ? {} : { detalhe: error.message }),
      });
    }
  },
);

app.get(
  "/api/importacoes",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 20, 1), 50);
      const historico = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          const { rows } = await client.query(
            `SELECT i.*,
                    COUNT(ii.id)::int AS itens_afetados
             FROM importacoes AS i
             LEFT JOIN importacao_itens AS ii
               ON ii.importacao_id = i.id
              AND ii.restaurante_id = i.restaurante_id
             WHERE i.restaurante_id = $1
             GROUP BY i.id
             ORDER BY i.criado_em DESC, i.id DESC
             LIMIT $2`,
            [restauranteId, limite],
          );
          return rows.map(importacaoHistoricoPublica);
        },
      );
      return res.json({ historico });
    } catch (error) {
      console.error("Falha ao listar importacoes:", error.message);
      return res.status(500).json({ erro: "Nao foi possivel carregar o historico" });
    }
  },
);

app.get(
  "/api/importacoes/:id",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const importacaoId = Number(req.params.id);
      if (!Number.isInteger(importacaoId) || importacaoId <= 0) {
        return res.status(400).json({ erro: "Importacao invalida" });
      }
      const detalhe = await withTenantTransaction(
        req.user.restaurante_id,
        async (client, restauranteId) => {
          const { rows } = await client.query(
            `SELECT i.*,
                    COUNT(ii.id)::int AS itens_afetados
             FROM importacoes AS i
             LEFT JOIN importacao_itens AS ii
               ON ii.importacao_id = i.id
              AND ii.restaurante_id = i.restaurante_id
             WHERE i.id = $1 AND i.restaurante_id = $2
             GROUP BY i.id`,
            [importacaoId, restauranteId],
          );
          if (!rows[0]) return null;
          const { rows: itens } = await client.query(
            `SELECT ordem, entidade, registro_id, acao
             FROM importacao_itens
             WHERE importacao_id = $1 AND restaurante_id = $2
             ORDER BY ordem`,
            [importacaoId, restauranteId],
          );
          return { ...importacaoHistoricoPublica(rows[0]), itens };
        },
      );
      if (!detalhe) return res.status(404).json({ erro: "Importacao nao encontrada" });
      return res.json(detalhe);
    } catch (error) {
      console.error("Falha ao detalhar importacao:", error.message);
      return res.status(500).json({ erro: "Nao foi possivel carregar a importacao" });
    }
  },
);

app.post(
  "/api/importacoes/:id/rollback",
  autenticarJWT,
  autorizarRoles("admin"),
  async (req, res) => {
    try {
      const importacaoId = Number(req.params.id);
      if (!Number.isInteger(importacaoId) || importacaoId <= 0) {
        return res.status(400).json({ erro: "Importacao invalida" });
      }
      const importacao = await withTenantTransaction(
        req.user.restaurante_id,
        (client, restauranteId) => executarRollbackImportacao(
          client,
          restauranteId,
          importacaoId,
          req.user,
        ),
      );
      if (["categorias", "produtos"].includes(importacao.tipo)) {
        emitirRestaurante(req.user.restaurante_id, "cardapio_atualizado");
      }
      return res.json({ sucesso: true, importacao });
    } catch (error) {
      if (error instanceof ImportacaoRollbackError) {
        return res.status(error.statusCode).json({ erro: error.message });
      }
      if (error.code === "23503") {
        return res.status(409).json({
          erro: "Nao e possivel desfazer porque um registro importado ja esta em uso",
        });
      }
      if (error.code === "23505") {
        return res.status(409).json({
          erro: "Nao e possivel restaurar porque os dados anteriores agora estao em uso",
        });
      }
      console.error("Falha no rollback da importacao:", error.message);
      return res.status(500).json({ erro: "Nao foi possivel desfazer a importacao" });
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
    const hoje = dataISOEmFuso();
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT
        p.id, p.numero_dia, p.mesa_id,
        m.numero as mesa_numero,
        p.garcom_nome, p.nome_cliente, p.forma_pagamento,
        to_char(p.finalizado_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') as fechado_em,
        SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
        COUNT(DISTINCT CASE WHEN ip.status != 'cancelado' THEN ip.id END) as total_itens
       FROM pedidos p
       JOIN mesas m ON m.id = p.mesa_id AND m.restaurante_id = p.restaurante_id
       JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.restaurante_id = p.restaurante_id
       JOIN produtos pr ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
       WHERE p.restaurante_id = $1
         AND p.status = 'finalizado'
         AND p.finalizado_em >= ($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AND p.finalizado_em < (($2::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
       GROUP BY p.id, m.numero
       ORDER BY p.finalizado_em DESC`,
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
    const { dataInicio, dataFim } = intervaloRelatorio({
      periodo,
      dataInicio: di,
      dataFim: df,
    });

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
        to_char(MAX(p.finalizado_em) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') as fechado_em
       FROM pedidos p
       JOIN mesas m ON m.id = p.mesa_id AND m.restaurante_id = p.restaurante_id
       JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.restaurante_id = p.restaurante_id
       JOIN produtos pr ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
       WHERE p.restaurante_id = $1
         AND p.status = 'finalizado'
         AND p.finalizado_em >= ($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AND p.finalizado_em < (($3::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
       GROUP BY p.id, m.numero
       ORDER BY MAX(p.finalizado_em) DESC`,
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
    const hoje = dataISOEmFuso();
    const { rows } = await tenantQuery(
      req.user.restaurante_id,
      `SELECT
        p.mesa_id,
        m.numero as mesa_numero,
        MAX(p.nome_cliente) as nome_cliente,
        COUNT(DISTINCT ip.id) as total_itens,
        SUM(CASE WHEN ip.status != 'cancelado' THEN ip.quantidade * pr.preco ELSE 0 END) as total,
        to_char(MAX(p.finalizado_em) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') as fechado_em
       FROM pedidos p
       JOIN mesas m ON m.id = p.mesa_id AND m.restaurante_id = p.restaurante_id
       JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.restaurante_id = p.restaurante_id
       JOIN produtos pr ON pr.id = ip.produto_id AND pr.restaurante_id = ip.restaurante_id
       WHERE p.restaurante_id = $1
         AND p.status = 'finalizado'
         AND p.finalizado_em >= ($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AND p.finalizado_em < (($2::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
       GROUP BY p.mesa_id, m.numero
       ORDER BY MAX(p.finalizado_em) DESC`,
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
  return anexarControleComercial({ ...restaurante, ...rows[0] });
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

function mapearPorId(rows) {
  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function carregarEstadoImportacao(client, restauranteId, tipo) {
  if (tipo === "categorias" || tipo === "produtos") {
    const { rows } = await client.query(
      `SELECT id, nome, ordem, ativo
       FROM categorias
       WHERE restaurante_id = $1
       ORDER BY ordem, nome`,
      [restauranteId],
    );
    const categorias = mapearPorChave(rows, "nome");
    const categoriasPorId = mapearPorId(rows);
    if (tipo === "categorias") return { categorias, categoriasPorId };

    const { rows: produtos } = await client.query(
      `SELECT id, categoria_id, nome, descricao, preco, imagem, disponivel
       FROM produtos
       WHERE restaurante_id = $1
       ORDER BY id`,
      [restauranteId],
    );
    return {
      categorias,
      categoriasPorId,
      produtos: mapearPorChave(produtos, "nome"),
      produtosPorId: mapearPorId(produtos),
    };
  }

  if (tipo === "mesas") {
    const { rows } = await client.query(
      `SELECT id, numero, status
       FROM mesas
       WHERE restaurante_id = $1
       ORDER BY id`,
      [restauranteId],
    );
    return { mesas: mapearPorChave(rows, "numero"), mesasPorId: mapearPorId(rows) };
  }

  if (tipo === "usuarios") {
    const { rows } = await client.query(
      `SELECT id, nome, login, role, ativo, senha
       FROM usuarios
       WHERE restaurante_id = $1
       ORDER BY id`,
      [restauranteId],
    );
    return { usuarios: mapearPorChave(rows, "login"), usuariosPorId: mapearPorId(rows) };
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

async function analisarImportacao(client, restauranteId, payload = {}, opcoes = {}) {
  const tipo = String(payload.tipo || "");
  const spec = TIPOS_IMPORTACAO[tipo];
  if (!spec) throw new ImportacaoValidationError("Tipo de importacao invalido");

  const itens = normalizarLinhasImportacao(tipo, payload.rows || payload.linhas || [], {
    permitirImagemLocal: Boolean(opcoes.permitirImagemLocal),
  });
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

function snapshotCategoria(row) {
  return {
    nome: row.nome,
    ordem: row.ordem,
    ativo: Number(row.ativo ?? 1),
  };
}

function snapshotProduto(row) {
  return {
    categoria_id: row.categoria_id,
    nome: row.nome,
    descricao: row.descricao,
    preco: Number(row.preco),
    imagem: row.imagem,
    disponivel: Number(row.disponivel ?? 1),
  };
}

function snapshotMesa(row) {
  return {
    numero: row.numero,
    status: row.status,
  };
}

function snapshotUsuario(row, incluirSenha = false) {
  const snapshot = {
    nome: row.nome,
    login: row.login,
    role: row.role,
    ativo: Number(row.ativo ?? 1),
  };
  if (incluirSenha) snapshot.senha = row.senha;
  return snapshot;
}

function itemHistorico(entidade, acao, row, dadosAnteriores, dadosNovos) {
  return {
    entidade,
    acao,
    registro_id: Number(row.id),
    dados_anteriores: dadosAnteriores || null,
    dados_novos: dadosNovos,
  };
}

async function garantirCategoriaImportacao(client, restauranteId, estado, nomeCategoria) {
  const nome = String(nomeCategoria || "").trim();
  if (!nome) return { id: null, historico: null };

  const chave = normalizarBusca(nome);
  const existente = estado.categorias?.get(chave);
  if (existente) return { id: existente.id, historico: null };

  const { rows } = await client.query(
    `INSERT INTO categorias (nome, ordem, restaurante_id)
     VALUES ($1, $2, $3)
     RETURNING id, nome, ordem, ativo`,
    [nome, 99, restauranteId],
  );
  estado.categorias.set(chave, rows[0]);
  estado.categoriasPorId.set(Number(rows[0].id), rows[0]);
  return {
    id: rows[0].id,
    historico: itemHistorico(
      "categorias",
      "criar",
      rows[0],
      null,
      snapshotCategoria(rows[0]),
    ),
  };
}

async function executarImportacaoCategoria(client, restauranteId, item, estado) {
  const { dados } = item;
  if (item.acao === "atualizar") {
    const anterior = estado.categoriasPorId.get(Number(item.existente_id));
    await client.query(
      `UPDATE categorias
       SET nome = $1, ordem = $2
       WHERE id = $3 AND restaurante_id = $4`,
      [dados.nome, dados.ordem, item.existente_id, restauranteId],
    );
    const atualizado = {
      ...anterior,
      nome: dados.nome,
      ordem: dados.ordem,
    };
    estado.categorias.set(normalizarBusca(atualizado.nome), atualizado);
    return {
      acao: "atualizar",
      login: null,
      historico: [itemHistorico(
        "categorias",
        "atualizar",
        atualizado,
        snapshotCategoria(anterior),
        snapshotCategoria(atualizado),
      )],
    };
  }

  const { rows } = await client.query(
    `INSERT INTO categorias (nome, ordem, restaurante_id)
     VALUES ($1, $2, $3)
     RETURNING id, nome, ordem, ativo`,
    [dados.nome, dados.ordem, restauranteId],
  );
  estado.categorias.set(normalizarBusca(rows[0].nome), rows[0]);
  estado.categoriasPorId.set(Number(rows[0].id), rows[0]);
  return {
    acao: "criar",
    login: null,
    historico: [itemHistorico(
      "categorias",
      "criar",
      rows[0],
      null,
      snapshotCategoria(rows[0]),
    )],
  };
}

async function executarImportacaoProduto(client, restauranteId, item, estado) {
  const { dados } = item;
  const categoria = await garantirCategoriaImportacao(
    client,
    restauranteId,
    estado,
    dados.categoria,
  );
  const parametros = [
    categoria.id,
    dados.nome,
    dados.descricao || null,
    dados.preco,
    dados.imagem || null,
    dados.disponivel ? 1 : 0,
    restauranteId,
  ];

  if (item.acao === "atualizar") {
    const anterior = estado.produtosPorId.get(Number(item.existente_id));
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
    const atualizado = {
      ...anterior,
      categoria_id: categoria.id,
      nome: dados.nome,
      descricao: dados.descricao || null,
      preco: dados.preco,
      imagem: dados.imagem || null,
      disponivel: dados.disponivel ? 1 : 0,
    };
    return {
      acao: "atualizar",
      login: null,
      historico: [
        ...(categoria.historico ? [categoria.historico] : []),
        itemHistorico(
          "produtos",
          "atualizar",
          atualizado,
          snapshotProduto(anterior),
          snapshotProduto(atualizado),
        ),
      ],
    };
  }

  const { rows } = await client.query(
    `INSERT INTO produtos
       (categoria_id, nome, descricao, preco, imagem, disponivel, restaurante_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, categoria_id, nome, descricao, preco, imagem, disponivel`,
    parametros,
  );
  return {
    acao: "criar",
    login: null,
    historico: [
      ...(categoria.historico ? [categoria.historico] : []),
      itemHistorico(
        "produtos",
        "criar",
        rows[0],
        null,
        snapshotProduto(rows[0]),
      ),
    ],
  };
}

async function executarImportacaoMesa(client, restauranteId, item, estado) {
  const { dados } = item;
  if (item.acao === "atualizar") {
    const anterior = estado.mesasPorId.get(Number(item.existente_id));
    await client.query(
      `UPDATE mesas
       SET numero = $1, status = $2
       WHERE id = $3 AND restaurante_id = $4`,
      [dados.numero, dados.status, item.existente_id, restauranteId],
    );
    const atualizado = { ...anterior, numero: dados.numero, status: dados.status };
    return {
      acao: "atualizar",
      login: null,
      historico: [itemHistorico(
        "mesas",
        "atualizar",
        atualizado,
        snapshotMesa(anterior),
        snapshotMesa(atualizado),
      )],
    };
  }

  const { rows } = await client.query(
    `INSERT INTO mesas (numero, status, restaurante_id)
     VALUES ($1, $2, $3)
     RETURNING id, numero, status`,
    [dados.numero, dados.status, restauranteId],
  );
  return {
    acao: "criar",
    login: null,
    historico: [itemHistorico(
      "mesas",
      "criar",
      rows[0],
      null,
      snapshotMesa(rows[0]),
    )],
  };
}

async function executarImportacaoUsuario(client, restauranteId, item, estado) {
  const { dados } = item;
  const senhaTemporaria = !dados.senha_informada && item.acao === "criar"
    ? gerarSenhaTemporaria()
    : "";
  const senhaFinal = dados.senha_informada ? dados.senha : senhaTemporaria;

  if (item.acao === "atualizar") {
    const anterior = estado.usuariosPorId.get(Number(item.existente_id));
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
    const atualizado = {
      ...anterior,
      nome: dados.nome,
      login: dados.login,
      role: dados.role,
      ativo: dados.ativo ? 1 : 0,
      senha: dados.senha_informada ? params[5] : anterior.senha,
    };
    return {
      acao: "atualizar",
      login: dados.login,
      senha_temporaria: "",
      historico: [itemHistorico(
        "usuarios",
        "atualizar",
        atualizado,
        snapshotUsuario(anterior, dados.senha_informada),
        snapshotUsuario(atualizado, dados.senha_informada),
      )],
    };
  }

  const senhaHash = await hashSenha(senhaFinal);
  const { rows } = await client.query(
    `INSERT INTO usuarios (nome, login, senha, role, ativo, restaurante_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nome, login, senha, role, ativo`,
    [
      dados.nome,
      dados.login,
      senhaHash,
      dados.role,
      dados.ativo ? 1 : 0,
      restauranteId,
    ],
  );
  return {
    acao: "criar",
    login: dados.login,
    senha_temporaria: senhaTemporaria,
    historico: [itemHistorico(
      "usuarios",
      "criar",
      rows[0],
      null,
      snapshotUsuario(rows[0], true),
    )],
  };
}

function importacaoHistoricoPublica(row) {
  const criadoEm = new Date(row.criado_em);
  return {
    id: row.id,
    tipo: row.tipo,
    formato: row.formato,
    arquivo_nome: row.arquivo_nome,
    atualizar_existentes: row.atualizar_existentes,
    total_linhas: row.total_linhas,
    criar: row.criados,
    atualizar: row.atualizados,
    ignorar: row.ignorados,
    invalidas: row.invalidos,
    status: row.status,
    usuario: row.usuario_nome || row.usuario_login || "Usuario removido",
    criado_em: row.criado_em,
    revertido_em: row.revertido_em,
    revertido_por: row.revertido_por_nome,
    itens_afetados: row.itens_afetados,
    rollback_disponivel: Number(row.itens_afetados || 0) > 0 && rollbackDisponivel(row),
    rollback_expira_em: Number.isNaN(criadoEm.getTime())
      ? null
      : new Date(
        criadoEm.getTime() + JANELA_ROLLBACK_HORAS * 60 * 60 * 1000,
      ).toISOString(),
  };
}

async function registrarHistoricoImportacao(
  client,
  restauranteId,
  analise,
  resultado,
  itens,
  contexto,
) {
  const metadados = normalizarMetadadosImportacao(
    contexto.payload,
    analise.colunas,
  );
  const usuario = contexto.usuario || {};
  const { rows } = await client.query(
    `INSERT INTO importacoes (
       restaurante_id,
       usuario_id,
       usuario_nome,
       usuario_login,
       tipo,
       formato,
       arquivo_nome,
       atualizar_existentes,
       mapeamento,
       total_linhas,
       criados,
       atualizados,
       ignorados,
       invalidos
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
       $10, $11, $12, $13, $14
     )
     RETURNING *`,
    [
      restauranteId,
      Number(usuario.id) || null,
      String(usuario.nome || "").slice(0, 120) || null,
      String(usuario.login || "").slice(0, 120) || null,
      metadados.tipo,
      metadados.formato,
      metadados.arquivo_nome,
      metadados.atualizar_existentes,
      JSON.stringify(metadados.mapeamento),
      analise.total_linhas,
      resultado.criar,
      resultado.atualizar,
      resultado.ignorar,
      resultado.invalidas,
    ],
  );
  const importacao = rows[0];

  if (itens.length) {
    const itensOrdenados = itens.map((item, indice) => ({
      ...item,
      ordem: indice + 1,
    }));
    await client.query(
      `INSERT INTO importacao_itens (
         importacao_id,
         restaurante_id,
         ordem,
         entidade,
         registro_id,
         acao,
         dados_anteriores,
         dados_novos
       )
       SELECT
         $1,
         $2,
         item.ordem,
         item.entidade,
         item.registro_id,
         item.acao,
         item.dados_anteriores,
         item.dados_novos
       FROM jsonb_to_recordset($3::jsonb) AS item(
         ordem INTEGER,
         entidade TEXT,
         registro_id INTEGER,
         acao TEXT,
         dados_anteriores JSONB,
         dados_novos JSONB
       )`,
      [importacao.id, restauranteId, JSON.stringify(itensOrdenados)],
    );
  }

  return importacaoHistoricoPublica({
    ...importacao,
    itens_afetados: itens.length,
  });
}

async function executarImportacao(client, restauranteId, analise, contexto = {}) {
  const estado = await carregarEstadoImportacao(client, restauranteId, analise.tipo);
  const resultado = {
    ...resumoImportacaoVazio(),
    credenciais: [],
  };
  const itensHistorico = [];

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
    itensHistorico.push(...(parcial.historico || []));
    if (parcial.senha_temporaria) {
      resultado.credenciais.push({
        nome: item.dados.nome,
        login: parcial.login,
        senha: parcial.senha_temporaria,
      });
    }
  }

  const historico = await registrarHistoricoImportacao(
    client,
    restauranteId,
    analise,
    resultado,
    itensHistorico,
    contexto,
  );
  return { ...resultado, ...historico };
}

function snapshotEntidadeRollback(entidade, row, esperado) {
  if (entidade === "categorias") return snapshotCategoria(row);
  if (entidade === "produtos") return snapshotProduto(row);
  if (entidade === "mesas") return snapshotMesa(row);
  if (entidade === "usuarios") {
    return snapshotUsuario(
      row,
      Object.prototype.hasOwnProperty.call(esperado || {}, "senha"),
    );
  }
  throw new ImportacaoRollbackError("Entidade de rollback invalida");
}

async function carregarRegistroRollback(client, restauranteId, item) {
  let resultado;
  if (item.entidade === "categorias") {
    resultado = await client.query(
      `SELECT id, nome, ordem, ativo
       FROM categorias
       WHERE id = $1 AND restaurante_id = $2
       FOR UPDATE`,
      [item.registro_id, restauranteId],
    );
  } else if (item.entidade === "produtos") {
    resultado = await client.query(
      `SELECT id, categoria_id, nome, descricao, preco, imagem, disponivel
       FROM produtos
       WHERE id = $1 AND restaurante_id = $2
       FOR UPDATE`,
      [item.registro_id, restauranteId],
    );
  } else if (item.entidade === "mesas") {
    resultado = await client.query(
      `SELECT id, numero, status
       FROM mesas
       WHERE id = $1 AND restaurante_id = $2
       FOR UPDATE`,
      [item.registro_id, restauranteId],
    );
  } else if (item.entidade === "usuarios") {
    resultado = await client.query(
      `SELECT id, nome, login, role, ativo, senha
       FROM usuarios
       WHERE id = $1 AND restaurante_id = $2
       FOR UPDATE`,
      [item.registro_id, restauranteId],
    );
  } else {
    throw new ImportacaoRollbackError("Entidade de rollback invalida");
  }

  if (!resultado.rows[0]) {
    throw new ImportacaoRollbackError(
      `O registro ${item.entidade} #${item.registro_id} nao existe mais`,
    );
  }
  const atual = snapshotEntidadeRollback(
    item.entidade,
    resultado.rows[0],
    item.dados_novos,
  );
  if (!objetosEquivalentes(atual, item.dados_novos)) {
    throw new ImportacaoRollbackError(
      `O registro ${item.entidade} #${item.registro_id} foi alterado depois da importacao`,
    );
  }
}

async function apagarRegistroRollback(client, restauranteId, item) {
  if (item.entidade === "categorias") {
    return client.query(
      "DELETE FROM categorias WHERE id = $1 AND restaurante_id = $2",
      [item.registro_id, restauranteId],
    );
  }
  if (item.entidade === "produtos") {
    return client.query(
      "DELETE FROM produtos WHERE id = $1 AND restaurante_id = $2",
      [item.registro_id, restauranteId],
    );
  }
  if (item.entidade === "mesas") {
    return client.query(
      "DELETE FROM mesas WHERE id = $1 AND restaurante_id = $2",
      [item.registro_id, restauranteId],
    );
  }
  if (item.entidade === "usuarios") {
    return client.query(
      "DELETE FROM usuarios WHERE id = $1 AND restaurante_id = $2",
      [item.registro_id, restauranteId],
    );
  }
  throw new ImportacaoRollbackError("Entidade de rollback invalida");
}

async function restaurarRegistroRollback(client, restauranteId, item) {
  const dados = item.dados_anteriores;
  if (!dados) throw new ImportacaoRollbackError("Snapshot anterior nao encontrado");

  if (item.entidade === "categorias") {
    return client.query(
      `UPDATE categorias
       SET nome = $1, ordem = $2, ativo = $3
       WHERE id = $4 AND restaurante_id = $5`,
      [dados.nome, dados.ordem, dados.ativo, item.registro_id, restauranteId],
    );
  }
  if (item.entidade === "produtos") {
    return client.query(
      `UPDATE produtos
       SET categoria_id = $1,
           nome = $2,
           descricao = $3,
           preco = $4,
           imagem = $5,
           disponivel = $6
       WHERE id = $7 AND restaurante_id = $8`,
      [
        dados.categoria_id,
        dados.nome,
        dados.descricao,
        dados.preco,
        dados.imagem,
        dados.disponivel,
        item.registro_id,
        restauranteId,
      ],
    );
  }
  if (item.entidade === "mesas") {
    return client.query(
      `UPDATE mesas
       SET numero = $1, status = $2
       WHERE id = $3 AND restaurante_id = $4`,
      [dados.numero, dados.status, item.registro_id, restauranteId],
    );
  }
  if (item.entidade === "usuarios") {
    if (Object.prototype.hasOwnProperty.call(dados, "senha")) {
      return client.query(
        `UPDATE usuarios
         SET nome = $1, login = $2, role = $3, ativo = $4, senha = $5
         WHERE id = $6 AND restaurante_id = $7`,
        [
          dados.nome,
          dados.login,
          dados.role,
          dados.ativo,
          dados.senha,
          item.registro_id,
          restauranteId,
        ],
      );
    }
    return client.query(
      `UPDATE usuarios
       SET nome = $1, login = $2, role = $3, ativo = $4
       WHERE id = $5 AND restaurante_id = $6`,
      [
        dados.nome,
        dados.login,
        dados.role,
        dados.ativo,
        item.registro_id,
        restauranteId,
      ],
    );
  }
  throw new ImportacaoRollbackError("Entidade de rollback invalida");
}

async function executarRollbackImportacao(
  client,
  restauranteId,
  importacaoId,
  usuario,
) {
  const { rows } = await client.query(
    `SELECT *
     FROM importacoes
     WHERE id = $1 AND restaurante_id = $2
     FOR UPDATE`,
    [importacaoId, restauranteId],
  );
  const importacao = rows[0];
  if (!importacao) {
    throw new ImportacaoRollbackError("Importacao nao encontrada", 404);
  }
  if (importacao.status !== "concluida") {
    throw new ImportacaoRollbackError("Esta importacao ja foi revertida");
  }
  if (!rollbackDisponivel(importacao)) {
    throw new ImportacaoRollbackError(
      `O prazo de ${JANELA_ROLLBACK_HORAS} horas para rollback expirou`,
    );
  }

  const { rows: itens } = await client.query(
    `SELECT ordem, entidade, registro_id, acao, dados_anteriores, dados_novos
     FROM importacao_itens
     WHERE importacao_id = $1 AND restaurante_id = $2
     ORDER BY ordem DESC`,
    [importacaoId, restauranteId],
  );
  if (!itens.length) {
    throw new ImportacaoRollbackError("A importacao nao possui alteracoes para desfazer");
  }

  for (const item of itens) {
    await carregarRegistroRollback(client, restauranteId, item);
  }
  for (const item of itens) {
    if (item.acao === "criar") {
      await apagarRegistroRollback(client, restauranteId, item);
    } else if (item.acao === "atualizar") {
      await restaurarRegistroRollback(client, restauranteId, item);
    } else {
      throw new ImportacaoRollbackError("Acao de rollback invalida");
    }
  }

  const { rows: atualizadas } = await client.query(
    `UPDATE importacoes
     SET status = 'revertida',
         revertido_em = NOW(),
         revertido_por_usuario_id = $1,
         revertido_por_nome = $2
     WHERE id = $3 AND restaurante_id = $4
     RETURNING *`,
    [
      Number(usuario.id),
      String(usuario.nome || usuario.login || "Admin").slice(0, 120),
      importacaoId,
      restauranteId,
    ],
  );
  return importacaoHistoricoPublica({
    ...atualizadas[0],
    itens_afetados: itens.length,
  });
}

function responderErroPlataforma(res, error) {
  if (
    error instanceof TenantValidationError
    || error instanceof BrandingValidationError
    || error instanceof CommercialControlValidationError
    || error instanceof PlanHistoryValidationError
  ) {
    return res.status(error.statusCode || 400).json({ erro: error.message });
  }
  if (error.statusCode) {
    return res.status(error.statusCode).json({ erro: error.message });
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

const CAMPOS_RESTAURANTE_PLATAFORMA = `
  id, nome, slug, ativo, plano, limite_mesas, limite_usuarios,
  limite_produtos, mensalidade_centavos, ciclo_cobranca,
  status_cobranca, trial_termina_em, proxima_cobranca_em,
  observacoes_plano, status_comercial, data_inicio_contrato,
  ultimo_contato_comercial_em, responsavel_comercial,
  motivo_suspensao, excluido_em,
  white_label_ativo, nome_exibicao, logo_url,
  cor_primaria, cor_secundaria, cor_texto_principal,
  cor_texto_secundario, cor_titulo, cor_texto_inverso,
  whatsapp_numero,
  criado_em, atualizado_em
`;

async function buscarRestaurantePlataforma(client, restauranteId, options = {}) {
  const { rows } = await client.query(
    `SELECT ${CAMPOS_RESTAURANTE_PLATAFORMA}
     FROM restaurantes
     WHERE id = $1
     ${options.forUpdate ? "FOR UPDATE" : ""}`,
    [restauranteId],
  );
  return rows[0] || null;
}

async function registrarHistoricoPlanoRestaurante(
  client,
  { restauranteId, usuario, acao, anterior, novo, motivo },
) {
  const historico = normalizarHistoricoPlano({
    restaurante_id: restauranteId,
    usuario,
    acao,
    anterior,
    novo,
    motivo,
  });
  const { rows } = await client.query(
    `INSERT INTO restaurante_plano_historico
       (restaurante_id, platform_usuario_id, platform_usuario_nome,
        platform_usuario_login, acao, dados_anteriores, dados_novos, motivo)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
     RETURNING id, restaurante_id, platform_usuario_id, platform_usuario_nome,
               platform_usuario_login, acao, dados_anteriores, dados_novos,
               motivo, criado_em`,
    [
      historico.restaurante_id,
      historico.platform_usuario_id,
      historico.platform_usuario_nome,
      historico.platform_usuario_login,
      historico.acao,
      historico.dados_anteriores ? JSON.stringify(historico.dados_anteriores) : null,
      JSON.stringify(historico.dados_novos),
      historico.motivo,
    ],
  );
  return normalizarLinhaHistoricoPlano(rows[0]);
}

async function listarRestaurantesPlataforma() {
  const { rows } = await query(
    `SELECT ${CAMPOS_RESTAURANTE_PLATAFORMA}
     FROM restaurantes
     ORDER BY excluido_em NULLS FIRST, criado_em DESC`,
  );
  return Promise.all(rows.map(carregarResumoRestaurante));
}

app.get("/api/platform/restaurantes", autenticarPlataforma, async (req, res) => {
  try {
    return res.json(await listarRestaurantesPlataforma());
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

app.get("/api/platform/restaurantes/:id/historico-planos", autenticarPlataforma, async (req, res) => {
  try {
    const restauranteId = idPositivo(req.params.id, "Restaurante");
    const { rows: restaurante } = await query(
      "SELECT id FROM restaurantes WHERE id = $1",
      [restauranteId],
    );
    if (!restaurante[0]) {
      return res.status(404).json({ erro: "Restaurante nao encontrado" });
    }

    const { rows } = await query(
      `SELECT id, restaurante_id, platform_usuario_id, platform_usuario_nome,
              platform_usuario_login, acao, dados_anteriores, dados_novos,
              motivo, criado_em
       FROM restaurante_plano_historico
       WHERE restaurante_id = $1
       ORDER BY criado_em DESC, id DESC
       LIMIT 80`,
      [restauranteId],
    );
    return res.json(rows.map((row) => {
      const historico = normalizarLinhaHistoricoPlano(row);
      return {
        ...historico,
        descricao: descreverHistoricoPlano(historico),
      };
    }));
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

app.get("/api/platform/comercial", autenticarPlataforma, async (req, res) => {
  try {
    const restaurantes = await listarRestaurantesPlataforma();
    const alertas = restaurantes
      .flatMap((restaurante) => (restaurante.alertas_comerciais || []).map((alerta) => ({
        ...alerta,
        restaurante_id: restaurante.id,
        restaurante_nome: restaurante.nome,
        restaurante_slug: restaurante.slug,
      })))
      .sort((a, b) => {
        const peso = { critico: 0, atencao: 1, info: 2 };
        return (peso[a.severidade] ?? 9) - (peso[b.severidade] ?? 9);
      });
    return res.json({
      resumo: resumoSaas(restaurantes),
      alertas,
      restaurantes,
    });
  } catch (error) {
    return responderErroPlataforma(res, error);
  }
});

app.post("/api/platform/restaurantes", autenticarPlataforma, async (req, res) => {
  try {
    const resultado = await provisionarRestaurante(pool, req.body, BCRYPT_ROUNDS, {
      onBeforeCommit: (client, { restaurante }) =>
        registrarHistoricoPlanoRestaurante(client, {
          restauranteId: restaurante.id,
          usuario: req.platformUser,
          acao: "criacao",
          novo: restaurante,
          motivo: "Restaurante criado pelo onboarding da plataforma",
        }),
    });
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
    const comercial = normalizarCamposComerciais(req.body, {
      statusCobranca: planoDetalhes.statusCobranca,
    });
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

    const atualizado = await withTransaction(async (client) => {
      const anterior = await buscarRestaurantePlataforma(client, restauranteId, {
        forUpdate: true,
      });
      if (!anterior) {
        const error = new TenantValidationError("Restaurante nao encontrado");
        error.statusCode = 404;
        throw error;
      }

      const { rows } = await client.query(
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
           status_comercial = $13,
           data_inicio_contrato = $14,
           ultimo_contato_comercial_em = $15,
           responsavel_comercial = $16,
           motivo_suspensao = $17,
           white_label_ativo = $18,
           nome_exibicao = $19,
           logo_url = $20,
           cor_primaria = $21,
           cor_secundaria = $22,
           cor_texto_principal = $23,
           cor_texto_secundario = $24,
           cor_titulo = $25,
           cor_texto_inverso = $26,
           whatsapp_numero = $27,
           atualizado_em = NOW()
       WHERE id = $28
       RETURNING ${CAMPOS_RESTAURANTE_PLATAFORMA}`,
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
          comercial.statusComercial,
          comercial.dataInicioContrato,
          comercial.ultimoContatoComercialEm,
          comercial.responsavelComercial,
          comercial.motivoSuspensao,
          marca.white_label_ativo,
          marca.nome_exibicao,
          marca.logo_url,
          marca.cor_primaria,
          marca.cor_secundaria,
          marca.cor_texto_principal,
          marca.cor_texto_secundario,
          marca.cor_titulo,
          marca.cor_texto_inverso,
          marca.whatsapp_numero,
          restauranteId,
        ],
      );
      await registrarHistoricoPlanoRestaurante(client, {
        restauranteId,
        usuario: req.platformUser,
        acao: "alteracao_plano",
        anterior,
        novo: rows[0],
        motivo: req.body?.motivo_historico || "Cadastro comercial atualizado",
      });
      return rows[0];
    });
    return res.json(await carregarResumoRestaurante(atualizado));
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
      const atualizado = await withTransaction(async (client) => {
        const anterior = await buscarRestaurantePlataforma(client, restauranteId, {
          forUpdate: true,
        });
        if (!anterior) {
          const error = new TenantValidationError("Restaurante nao encontrado");
          error.statusCode = 404;
          throw error;
        }

        const { rows } = await client.query(
          `UPDATE restaurantes
         SET ativo = CASE WHEN $1 THEN 1 ELSE 0 END,
             status_comercial = CASE
               WHEN $1 AND status_comercial IN ('suspenso', 'cancelado') THEN 'cliente'
               WHEN NOT $1 AND status_comercial <> 'cancelado' THEN 'suspenso'
               ELSE status_comercial
             END,
             excluido_em = CASE WHEN $1 THEN NULL ELSE excluido_em END,
             atualizado_em = NOW()
         WHERE id = $2
         RETURNING ${CAMPOS_RESTAURANTE_PLATAFORMA}`,
          [req.body.ativo, restauranteId],
        );
        await registrarHistoricoPlanoRestaurante(client, {
          restauranteId,
          usuario: req.platformUser,
          acao: "alteracao_status",
          anterior,
          novo: rows[0],
          motivo: req.body.ativo ? "Restaurante reativado" : "Restaurante suspenso",
        });
        return rows[0];
      });
      return res.json(await carregarResumoRestaurante(atualizado));
    } catch (error) {
      return responderErroPlataforma(res, error);
    }
  },
);

app.delete("/api/platform/restaurantes/:id", autenticarPlataforma, async (req, res) => {
  try {
    const restauranteId = idPositivo(req.params.id, "Restaurante");
    const arquivado = await withTransaction(async (client) => {
      const anterior = await buscarRestaurantePlataforma(client, restauranteId, {
        forUpdate: true,
      });
      if (!anterior || anterior.excluido_em) {
        const error = new TenantValidationError("Restaurante nao encontrado ou ja arquivado");
        error.statusCode = 404;
        throw error;
      }

      const { rows } = await client.query(
        `UPDATE restaurantes
       SET ativo = 0,
           status_comercial = 'cancelado',
           excluido_em = NOW(),
           atualizado_em = NOW()
       WHERE id = $1 AND excluido_em IS NULL
       RETURNING ${CAMPOS_RESTAURANTE_PLATAFORMA}`,
        [restauranteId],
      );
      await registrarHistoricoPlanoRestaurante(client, {
        restauranteId,
        usuario: req.platformUser,
        acao: "arquivamento",
        anterior,
        novo: rows[0],
        motivo: req.body?.motivo_historico || "Restaurante arquivado pela plataforma",
      });
      return rows[0];
    });
    return res.json({ ...arquivado, arquivado: true });
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
    registrarRestauranteRequest(req, restaurante);
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
              logo_url, cor_primaria, cor_secundaria,
              cor_texto_principal, cor_texto_secundario,
              cor_titulo, cor_texto_inverso, whatsapp_numero,
              plano, limite_mesas,
              limite_usuarios, limite_produtos, mensalidade_centavos,
              ciclo_cobranca, status_cobranca, status_comercial, trial_termina_em,
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
             cor_texto_principal = $6,
             cor_texto_secundario = $7,
             cor_titulo = $8,
             cor_texto_inverso = $9,
             whatsapp_numero = $10,
             atualizado_em = NOW()
         WHERE id = $11 AND ativo = 1
         RETURNING id, nome, slug, ativo, white_label_ativo, nome_exibicao,
                   logo_url, cor_primaria, cor_secundaria,
                   cor_texto_principal, cor_texto_secundario,
                   cor_titulo, cor_texto_inverso, whatsapp_numero,
                   atualizado_em`,
        [
          dados.white_label_ativo,
          dados.nome_exibicao,
          dados.logo_url,
          dados.cor_primaria,
          dados.cor_secundaria,
          dados.cor_texto_principal,
          dados.cor_texto_secundario,
          dados.cor_titulo,
          dados.cor_texto_inverso,
          dados.whatsapp_numero,
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
      socket.user = await revalidarUsuarioToken({
        token,
        secret: JWT_SECRET,
        tenantQuery,
      });
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
