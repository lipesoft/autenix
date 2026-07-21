const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  parseWithSchema,
  safeErrorResponse,
} = require("../lib/http-validation");
const {
  criarPedidoBodySchema,
  fecharMesaBodySchema,
  importacaoBodySchema,
  loginBodySchema,
  usuarioCreateBodySchema,
} = require("../lib/request-schemas");

function mockResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("valida e normaliza payload sensivel de pedido", () => {
  const payload = parseWithSchema(criarPedidoBodySchema, {
    mesa_id: "12",
    restaurante_slug: "autenix",
    sessao: "abc_DEF-123",
    nome_cliente: " Ana ",
    itens: [
      { produto_id: "3", quantidade: "2", observacao: " Sem cebola " },
    ],
  });

  assert.equal(payload.mesa_id, 12);
  assert.equal(payload.nome_cliente, "Ana");
  assert.equal(payload.itens[0].produto_id, 3);
  assert.equal(payload.itens[0].quantidade, 2);
  assert.equal(payload.itens[0].observacao, "Sem cebola");
});

test("rejeita campo inesperado em pedido", () => {
  assert.throws(
    () => parseWithSchema(criarPedidoBodySchema, {
      mesa_id: 1,
      sessao: "abcDEF123",
      itens: [{ produto_id: 1, quantidade: 1 }],
      restaurante_id: 999,
    }),
    /restaurante_id|Unrecognized key/,
  );
});

test("valida forma de pagamento do fechamento de mesa", () => {
  const payload = parseWithSchema(fecharMesaBodySchema, {
    forma_pagamento: "pix",
    obs_pagamento: " pago no caixa ",
  });

  assert.equal(payload.forma_pagamento, "pix");
  assert.equal(payload.obs_pagamento, "pago no caixa");
  assert.throws(
    () => parseWithSchema(fecharMesaBodySchema, { forma_pagamento: "boleto" }),
    /forma_pagamento/,
  );
});

test("valida autenticacao e usuarios sem aceitar slug invalido", () => {
  const login = parseWithSchema(loginBodySchema, {
    login: " master ",
    senha: "senha-segura",
    restaurante_slug: "restaurante-demo",
  });
  assert.equal(login.login, "master");

  assert.throws(
    () => parseWithSchema(loginBodySchema, {
      login: "master",
      senha: "senha",
      restaurante_slug: "../outro",
    }),
    /slug invalido/,
  );

  const usuario = parseWithSchema(usuarioCreateBodySchema, {
    nome: "Garcom Teste",
    login: "garcom_teste",
    senha: "senha123",
    role: "garcom",
  });
  assert.equal(usuario.role, "garcom");
});

test("limita importacao a 500 linhas e exige registros", () => {
  const rows = Array.from({ length: 500 }, (_, i) => ({ nome: `Produto ${i}` }));
  const payload = parseWithSchema(importacaoBodySchema, {
    tipo: "produtos",
    rows,
    atualizar_existentes: false,
  });

  assert.equal(payload.rows.length, 500);
  assert.throws(
    () => parseWithSchema(importacaoBodySchema, {
      tipo: "produtos",
      rows: [...rows, { nome: "Produto extra" }],
    }),
    /500/,
  );
});

test("resposta segura nao expoe detalhe interno em erro 500", () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const res = mockResponse();
    safeErrorResponse(res, new Error("syntax error at or near SELECT"), {
      fallbackMessage: "Falha segura",
    });

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, { erro: "Falha segura" });
  } finally {
    console.error = originalError;
  }
});
