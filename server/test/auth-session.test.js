const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const {
  AuthSessionError,
  revalidarUsuarioToken,
  verificarTokenRestaurante,
} = require("../lib/auth-session");

const SECRET = "segredo-de-teste-com-tamanho-suficiente";

function tokenRestaurante(payload = {}) {
  return jwt.sign(
    {
      sub: "7",
      restaurante_id: 3,
      role: "admin",
      ...payload,
    },
    SECRET,
    { expiresIn: "5m" },
  );
}

test("revalida usuario no banco e usa a role atual", async () => {
  const chamadas = [];
  const usuario = await revalidarUsuarioToken({
    token: tokenRestaurante({ role: "admin" }),
    secret: SECRET,
    tenantQuery: async (restauranteId, sql, params) => {
      chamadas.push({ restauranteId, sql, params });
      return {
        rows: [{
          id: 7,
          nome: "Joao",
          login: "joao",
          role: "garcom",
          restaurante_id: 3,
          restaurante_slug: "bistro",
        }],
      };
    },
  });

  assert.equal(usuario.role, "garcom");
  assert.equal(chamadas[0].restauranteId, 3);
  assert.deepEqual(chamadas[0].params, [7, 3]);
  assert.match(chamadas[0].sql, /u\.ativo/);
  assert.match(chamadas[0].sql, /r\.ativo/);
  assert.match(chamadas[0].sql, /status_comercial/);
});

test("revoga sessao quando usuario ou restaurante nao esta ativo", async () => {
  await assert.rejects(
    revalidarUsuarioToken({
      token: tokenRestaurante(),
      secret: SECRET,
      tenantQuery: async () => ({ rows: [] }),
    }),
    AuthSessionError,
  );
});

test("recusa token da plataforma nas rotas do restaurante", () => {
  const token = tokenRestaurante({ scope: "platform", restaurante_id: undefined });
  assert.throws(() => verificarTokenRestaurante(token, SECRET), AuthSessionError);
});

test("recusa token expirado", () => {
  const token = jwt.sign({ sub: "7", restaurante_id: 3 }, SECRET, { expiresIn: -1 });
  assert.throws(() => verificarTokenRestaurante(token, SECRET), AuthSessionError);
});
