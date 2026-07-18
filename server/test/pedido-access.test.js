const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  PedidoAccessError,
  origemCriacaoPedido,
} = require("../lib/pedido-access");

test("mantem pedido publico condicionado a sessao da mesa", () => {
  assert.equal(origemCriacaoPedido(null, 7), "mesa");
});

test("permite garcom e admin do mesmo restaurante", () => {
  assert.equal(
    origemCriacaoPedido({ role: "garcom", restaurante_id: 7 }, 7),
    "equipe",
  );
  assert.equal(
    origemCriacaoPedido({ role: "admin", restaurante_id: 7 }, 7),
    "equipe",
  );
});

test("recusa perfil operacional sem permissao", () => {
  assert.throws(
    () => origemCriacaoPedido({ role: "cozinha", restaurante_id: 7 }, 7),
    PedidoAccessError,
  );
});

test("recusa usuario de outro restaurante", () => {
  assert.throws(
    () => origemCriacaoPedido({ role: "garcom", restaurante_id: 8 }, 7),
    /fora do restaurante/,
  );
});
