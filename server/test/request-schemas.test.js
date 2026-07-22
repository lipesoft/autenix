const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  parseWithSchema,
  safeErrorResponse,
} = require("../lib/http-validation");
const {
  categoriaCreateBodySchema,
  criarPedidoBodySchema,
  fecharMesaBodySchema,
  importacaoBodySchema,
  loginBodySchema,
  plataformaMinhaSenhaBodySchema,
  plataformaRestauranteBodySchema,
  produtoCreateBodySchema,
  produtoUpdateBodySchema,
  reservaConfiguracaoBodySchema,
  reservaSalaoBodySchema,
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

test("valida categorias e produtos administrativos", () => {
  const categoria = parseWithSchema(categoriaCreateBodySchema, { nome: " Entradas " });
  assert.equal(categoria.nome, "Entradas");

  const produto = parseWithSchema(produtoCreateBodySchema, {
    categoria_id: "2",
    nome: " Burger ",
    descricao: " Pao, queijo e molho ",
    preco: "39.9",
    imagem: "https://cdn.exemplo.com/burger.webp",
  });
  assert.equal(produto.categoria_id, 2);
  assert.equal(produto.nome, "Burger");
  assert.equal(produto.preco, 39.9);

  const update = parseWithSchema(produtoUpdateBodySchema, {
    id: 9,
    categoria_id: 2,
    nome: "Burger",
    descricao: "",
    preco: "41.50",
    disponivel: "0",
    imagem: "",
  });
  assert.equal(update.disponivel, 0);
  assert.equal(update.imagem, undefined);

  assert.throws(
    () => parseWithSchema(produtoCreateBodySchema, {
      categoria_id: 1,
      nome: "Produto",
      preco: -1,
      restaurante_id: 999,
    }),
    /preco|restaurante_id|Unrecognized key/,
  );
});

test("valida configuracao de reservas e saloes", () => {
  const config = parseWithSchema(reservaConfiguracaoBodySchema, {
    ativo: "1",
    dias_semana: ["1", "2", "5"],
    hora_inicio: "18:00",
    hora_fim: "23:00",
    intervalo_minutos: "30",
    duracao_minutos: 90,
    permitir_fila: false,
  });
  assert.deepEqual(config.dias_semana, [1, 2, 5]);
  assert.equal(config.permitir_fila, 0);

  const salao = parseWithSchema(reservaSalaoBodySchema, {
    nome: " Varanda ",
    capacidade_pessoas: "80",
    ativo: true,
    ordem: "2",
  });
  assert.equal(salao.nome, "Varanda");
  assert.equal(salao.ativo, 1);

  assert.throws(
    () => parseWithSchema(reservaConfiguracaoBodySchema, {
      hora_inicio: "25:00",
    }),
    /horario/,
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

test("valida payloads sensiveis da plataforma", () => {
  const restaurante = parseWithSchema(plataformaRestauranteBodySchema, {
    nome: " Restaurante Demo ",
    slug: "restaurante-demo",
    login: "master",
    senha: "SenhaMuitoForte123!",
    mesas: "10",
    plano: "profissional",
    limite_mesas: "60",
    limite_usuarios: 15,
    limite_produtos: 400,
    mensalidade: "199,00",
    mensalidade_centavos: "19900",
    ciclo_cobranca: "mensal",
    status_cobranca: "trial",
    status_comercial: "trial",
    white_label_ativo: true,
    logo_url: "https://cdn.exemplo.com/logo.webp",
    cor_primaria: "#ff6600",
  });

  assert.equal(restaurante.nome, "Restaurante Demo");
  assert.equal(restaurante.mensalidade_centavos, 19900);
  assert.equal(restaurante.white_label_ativo, true);

  assert.throws(
    () => parseWithSchema(plataformaRestauranteBodySchema, {
      nome: "Demo",
      senha: "curta",
      jwt_secret: "nao",
    }),
    /senha|jwt_secret|Unrecognized key/,
  );

  const senha = parseWithSchema(plataformaMinhaSenhaBodySchema, {
    senha_atual: "atual",
    nova_senha: "NovaSenhaMuitoForte123!",
  });
  assert.equal(senha.nova_senha, "NovaSenhaMuitoForte123!");
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
