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
