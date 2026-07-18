import assert from "node:assert/strict";
import { test } from "node:test";
import {
  criarPlanilha,
  mapearAutomaticamente,
  mapearLinhas,
  parseCsv,
  validarMapeamento,
} from "./importacao-arquivos.js";

const CAMPOS_PRODUTO = [
  { id: "categoria", label: "Categoria", aliases: ["grupo"] },
  { id: "nome", label: "Nome", obrigatorio: true, aliases: ["produto"] },
  { id: "preco", label: "Preco", obrigatorio: true, aliases: ["valor"] },
];

test("le CSV com separador brasileiro e campo entre aspas", () => {
  const planilha = parseCsv('Grupo;Produto;Valor\nLanches;"Burger; Especial";34,90');

  assert.equal(planilha.rows.length, 1);
  assert.equal(planilha.rows[0][1], "Burger; Especial");
  assert.equal(planilha.rows[0][2], "34,90");
});

test("sugere mapeamento por aliases e monta registros canonicos", () => {
  const planilha = criarPlanilha([
    ["Grupo", "Produto", "Valor"],
    ["Lanches", "Burger Autenix", 34.9],
  ]);
  const mapeamento = mapearAutomaticamente(planilha.colunas, CAMPOS_PRODUTO);

  assert.deepEqual(validarMapeamento(mapeamento, CAMPOS_PRODUTO), []);
  assert.deepEqual(mapearLinhas(planilha, mapeamento, CAMPOS_PRODUTO), [
    { categoria: "Lanches", nome: "Burger Autenix", preco: 34.9 },
  ]);
});

test("impede campo obrigatorio sem coluna e coluna duplicada", () => {
  const ausente = validarMapeamento({ categoria: "", nome: "coluna_0", preco: "" }, CAMPOS_PRODUTO);
  assert.match(ausente.join(" "), /Preco/);

  const duplicado = validarMapeamento(
    { categoria: "coluna_0", nome: "coluna_0", preco: "coluna_1" },
    CAMPOS_PRODUTO,
  );
  assert.match(duplicado.join(" "), /so pode alimentar/);
});
