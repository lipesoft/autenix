const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BrandingValidationError,
  marcaPublica,
  normalizarWhiteLabel,
} = require("../lib/branding");

test("normaliza a configuracao de white label", () => {
  assert.deepEqual(
    normalizarWhiteLabel({
      white_label_ativo: true,
      nome_exibicao: "  Restaurante Aurora  ",
      logo_url: "https://cdn.example.com/logo.png",
      cor_primaria: "#0B2134",
      cor_secundaria: "#F2742D",
    }),
    {
      white_label_ativo: true,
      nome_exibicao: "Restaurante Aurora",
      logo_url: "https://cdn.example.com/logo.png",
      cor_primaria: "#0b2134",
      cor_secundaria: "#f2742d",
    },
  );
});

test("recusa logo sem HTTPS", () => {
  assert.throws(
    () => normalizarWhiteLabel({ logo_url: "http://example.com/logo.png" }),
    BrandingValidationError,
  );
});

test("recusa cor fora do formato hexadecimal", () => {
  assert.throws(
    () => normalizarWhiteLabel({ cor_primaria: "navy" }),
    BrandingValidationError,
  );
});

test("nao expoe a marca personalizada quando o white label esta desligado", () => {
  const publico = marcaPublica({
    id: 1,
    nome: "Restaurante Aurora",
    slug: "aurora",
    white_label_ativo: false,
    nome_exibicao: "Aurora",
    logo_url: "https://cdn.example.com/logo.png",
    cor_primaria: "#0b2134",
    cor_secundaria: "#f2742d",
  });

  assert.equal(publico.white_label_ativo, false);
  assert.equal(publico.logo_url, null);
  assert.equal(publico.cor_primaria, null);
  assert.equal(publico.cor_secundaria, null);
});

