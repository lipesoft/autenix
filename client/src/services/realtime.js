export const SYNC_INTERVALS = Object.freeze({
  mesaCliente: 3500,
  equipe: 3500,
  admin: 8000,
  financeiro: 4000,
  cardapio: 30000,
});

export function deveUsarSocketIo({ dev = false, flag = "" } = {}) {
  return Boolean(dev) || String(flag || "").trim().toLowerCase() === "true";
}

export function pedidoProntoParaRetirada(pedido) {
  const itensAtivos = pedido?.itens?.filter((item) => item.status !== "cancelado") || [];
  return (
    itensAtivos.length > 0 &&
    itensAtivos.every((item) => item.status === "pronto") &&
    pedido.status !== "entregue" &&
    pedido.status !== "finalizado"
  );
}

export function chaveChamada(chamada) {
  return String(chamada?.id || "");
}

