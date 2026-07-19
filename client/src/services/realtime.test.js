import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chaveChamada,
  deveUsarSocketIo,
  pedidoProntoParaRetirada,
} from "./realtime.js";

test("habilita Socket.IO apenas em dev ou com flag explicita", () => {
  assert.equal(deveUsarSocketIo({ dev: true }), true);
  assert.equal(deveUsarSocketIo({ flag: "true" }), true);
  assert.equal(deveUsarSocketIo({ flag: "TRUE" }), true);
  assert.equal(deveUsarSocketIo({ dev: false, flag: "" }), false);
});

test("identifica pedido pronto para retirada sem contar itens cancelados", () => {
  assert.equal(
    pedidoProntoParaRetirada({
      status: "pronto",
      itens: [{ status: "pronto" }, { status: "cancelado" }],
    }),
    true,
  );
  assert.equal(
    pedidoProntoParaRetirada({
      status: "pronto",
      itens: [{ status: "preparo" }],
    }),
    false,
  );
  assert.equal(
    pedidoProntoParaRetirada({
      status: "entregue",
      itens: [{ status: "pronto" }],
    }),
    false,
  );
});

test("gera chave estavel para chamada", () => {
  assert.equal(chaveChamada({ id: 42 }), "42");
  assert.equal(chaveChamada({}), "");
});

