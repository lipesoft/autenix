const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  gerarCsvModelo,
  normalizarLinhasImportacao,
} = require("../lib/importacao");

test("normaliza produtos com preco brasileiro e categoria", () => {
  const [produto] = normalizarLinhasImportacao("produtos", [
    {
      categoria: "Pratos principais",
      nome: "Burger Autenix",
      descricao: "Artesanal",
      preco: "34,90",
      disponivel: "sim",
    },
  ]);

  assert.equal(produto.erros.length, 0);
  assert.equal(produto.dados.nome, "Burger Autenix");
  assert.equal(produto.dados.categoria_chave, "pratos_principais");
  assert.equal(produto.dados.preco, 34.9);
  assert.equal(produto.dados.disponivel, true);
});

test("permite referencia local de imagem somente quando habilitado", () => {
  const [validacao] = normalizarLinhasImportacao(
    "produtos",
    [{
      categoria: "Pratos principais",
      nome: "Pizza da Casa",
      preco: "49,90",
      imagem: "imagens/pizza-da-casa.jpg",
    }],
    { permitirImagemLocal: true },
  );
  const [execucao] = normalizarLinhasImportacao("produtos", [
    {
      categoria: "Pratos principais",
      nome: "Pizza da Casa",
      preco: "49,90",
      imagem: "pizza-da-casa.jpg",
    },
  ]);

  assert.equal(validacao.erros.length, 0);
  assert.equal(validacao.dados.imagem, "imagens/pizza-da-casa.jpg");
  assert.match(execucao.erros.join(" "), /URL http/);
});

test("normaliza produtos exportados de sistemas concorrentes", () => {
  const [produto] = normalizarLinhasImportacao("produtos", [
    {
      grupo_produto: "Lanches",
      descricao_produto: "Burger Concorrente",
      descricao_detalhada: "Pao, carne e queijo",
      valor_venda: "42,50",
      url_foto: "https://cdn.exemplo.com/burger.webp",
      situacao: "ativo",
    },
  ]);

  assert.equal(produto.erros.length, 0);
  assert.equal(produto.dados.categoria, "Lanches");
  assert.equal(produto.dados.nome, "Burger Concorrente");
  assert.equal(produto.dados.descricao, "Pao, carne e queijo");
  assert.equal(produto.dados.preco, 42.5);
  assert.equal(produto.dados.disponivel, true);
});

test("marca duplicidades dentro do mesmo arquivo", () => {
  const linhas = normalizarLinhasImportacao("mesas", [
    { numero: "1" },
    { numero: "1" },
  ]);

  assert.equal(linhas[0].erros.length, 0);
  assert.match(linhas[1].erros.join(" "), /duplicado/);
});

test("gera modelo CSV para usuarios", () => {
  const csv = gerarCsvModelo("usuarios");

  assert.match(csv, /^nome;login;role;senha;ativo/m);
  assert.match(csv, /joao_garcom/);
});
