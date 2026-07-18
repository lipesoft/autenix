import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { readSheet } from "read-excel-file/node";
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

function criarXlsxMinimo() {
  const arquivos = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Produtos" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Produto</t></is></c><c r="B1" t="inlineStr"><is><t>Valor</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Massa E2E</t></is></c><c r="B2" t="inlineStr"><is><t>27,90</t></is></c></row></sheetData></worksheet>',
    ),
  };

  return Buffer.from(zipSync(arquivos));
}

test("le CSV com separador brasileiro e campo entre aspas", () => {
  const planilha = parseCsv('Grupo;Produto;Valor\nLanches;"Burger; Especial";34,90');

  assert.equal(planilha.rows.length, 1);
  assert.equal(planilha.rows[0][1], "Burger; Especial");
  assert.equal(planilha.rows[0][2], "34,90");
});

test("le uma planilha XLSX real", async () => {
  const matriz = await readSheet(criarXlsxMinimo());
  const planilha = criarPlanilha(matriz);

  assert.deepEqual(planilha.colunas.map(({ nome }) => nome), ["Produto", "Valor"]);
  assert.deepEqual(planilha.rows, [["Massa E2E", "27,90"]]);
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
