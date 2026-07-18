const jwt = require("jsonwebtoken");

const ROLES_RESTAURANTE = new Set(["admin", "garcom", "cozinha", "financeiro"]);

class AuthSessionError extends Error {
  constructor(message = "Acesso revogado") {
    super(message);
    this.name = "AuthSessionError";
    this.statusCode = 401;
  }
}

function usuarioDoPayload(payload) {
  const id = Number(payload?.sub || payload?.id);
  const restauranteId = Number(payload?.restaurante_id);
  if (
    payload?.scope === "platform"
    || !Number.isInteger(id)
    || id <= 0
    || !Number.isInteger(restauranteId)
    || restauranteId <= 0
  ) {
    throw new AuthSessionError("Token sem contexto de restaurante");
  }
  return { id, restaurante_id: restauranteId };
}

function verificarTokenRestaurante(token, secret) {
  try {
    return usuarioDoPayload(jwt.verify(token, secret));
  } catch (error) {
    if (error instanceof AuthSessionError) throw error;
    throw new AuthSessionError("Token invalido ou expirado");
  }
}

async function revalidarUsuarioToken({ token, secret, tenantQuery }) {
  const usuarioToken = verificarTokenRestaurante(token, secret);
  const { rows } = await tenantQuery(
    usuarioToken.restaurante_id,
    `SELECT u.id, u.nome, u.login, u.role, u.restaurante_id,
            r.slug AS restaurante_slug, r.nome AS restaurante_nome
     FROM usuarios AS u
     INNER JOIN restaurantes AS r ON r.id = u.restaurante_id
     WHERE u.id = $1
       AND u.restaurante_id = $2
       AND COALESCE(u.ativo, 0) = 1
       AND r.ativo = 1
       AND r.excluido_em IS NULL
     LIMIT 1`,
    [usuarioToken.id, usuarioToken.restaurante_id],
  );
  const usuario = rows[0];
  if (!usuario || !ROLES_RESTAURANTE.has(usuario.role)) {
    throw new AuthSessionError("Usuario ou restaurante com acesso revogado");
  }
  return usuario;
}

module.exports = {
  AuthSessionError,
  revalidarUsuarioToken,
  usuarioDoPayload,
  verificarTokenRestaurante,
};
