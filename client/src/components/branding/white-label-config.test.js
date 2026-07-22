import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizarWhiteLabel } from "./white-label-config.js";

test("normaliza apenas campos editaveis de white label", () => {
  const marca = normalizarWhiteLabel({
    id: 10,
    nome: "Restaurante Teste",
    ativo: 1,
    mesas_cadastradas: 8,
    receita_mrr_centavos: 19900,
    white_label_ativo: 1,
    nome_exibicao: "Restaurante Teste",
    logo_url: "https://example.com/logo.png",
    cor_primaria: "#123456",
  });

  assert.equal(marca.white_label_ativo, true);
  assert.equal(marca.nome_exibicao, "Restaurante Teste");
  assert.equal(marca.logo_url, "https://example.com/logo.png");
  assert.equal(marca.cor_primaria, "#123456");
  assert.equal(Object.hasOwn(marca, "id"), false);
  assert.equal(Object.hasOwn(marca, "mesas_cadastradas"), false);
  assert.equal(Object.hasOwn(marca, "receita_mrr_centavos"), false);
});
