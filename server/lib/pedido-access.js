const ROLES_CRIAM_PEDIDO = new Set(["admin", "garcom"]);

class PedidoAccessError extends Error {
  constructor(message) {
    super(message);
    this.name = "PedidoAccessError";
    this.statusCode = 403;
  }
}

function origemCriacaoPedido(usuario, restauranteId) {
  if (!usuario) return "mesa";

  if (!ROLES_CRIAM_PEDIDO.has(usuario.role)) {
    throw new PedidoAccessError("Perfil sem permissao para criar pedidos");
  }

  const tenantUsuario = Number(usuario.restaurante_id);
  const tenantMesa = Number(restauranteId);
  if (
    !Number.isInteger(tenantUsuario)
    || !Number.isInteger(tenantMesa)
    || tenantUsuario !== tenantMesa
  ) {
    throw new PedidoAccessError("Mesa fora do restaurante do usuario");
  }

  return "equipe";
}

module.exports = {
  PedidoAccessError,
  origemCriacaoPedido,
};
