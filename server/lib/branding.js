const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

class BrandingValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "BrandingValidationError";
    this.statusCode = 400;
  }
}

function textoOpcional(valor, campo, limite) {
  const texto = String(valor || "").trim();
  if (!texto) return null;
  if (texto.length > limite) {
    throw new BrandingValidationError(`${campo} deve ter no maximo ${limite} caracteres`);
  }
  return texto;
}

function normalizarCor(valor, campo) {
  const cor = textoOpcional(valor, campo, 7);
  if (!cor) return null;
  if (!HEX_COLOR.test(cor)) {
    throw new BrandingValidationError(`${campo} deve usar o formato hexadecimal #RRGGBB`);
  }
  return cor.toLowerCase();
}

function normalizarLogoUrl(valor) {
  const logoUrl = textoOpcional(valor, "Logo", 2048);
  if (!logoUrl) return null;

  let url;
  try {
    url = new URL(logoUrl);
  } catch {
    throw new BrandingValidationError("Informe uma URL valida para a logo");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new BrandingValidationError("A logo deve usar uma URL HTTPS publica");
  }
  return url.toString();
}

function normalizarWhatsappNumero(valor) {
  const informado = textoOpcional(valor, "WhatsApp", 32);
  if (!informado) return null;

  let digitos = informado.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = `55${digitos}`;
  }

  if (!/^[0-9]{12,15}$/.test(digitos)) {
    throw new BrandingValidationError(
      "WhatsApp deve incluir DDD e numero, preferencialmente com codigo do pais",
    );
  }
  return digitos;
}

function normalizarWhiteLabel(payload = {}) {
  const nomeExibicao = textoOpcional(payload.nome_exibicao, "Nome de exibicao", 80);
  if (nomeExibicao && nomeExibicao.length < 2) {
    throw new BrandingValidationError("Nome de exibicao deve ter pelo menos 2 caracteres");
  }

  return {
    white_label_ativo: payload.white_label_ativo === true,
    nome_exibicao: nomeExibicao,
    logo_url: normalizarLogoUrl(payload.logo_url),
    cor_primaria: normalizarCor(payload.cor_primaria, "Cor principal"),
    cor_secundaria: normalizarCor(payload.cor_secundaria, "Cor de destaque"),
    cor_texto_principal: normalizarCor(payload.cor_texto_principal, "Cor do texto principal"),
    cor_texto_secundario: normalizarCor(payload.cor_texto_secundario, "Cor do texto secundario"),
    cor_titulo: normalizarCor(payload.cor_titulo, "Cor dos titulos"),
    cor_texto_inverso: normalizarCor(payload.cor_texto_inverso, "Cor do texto sobre destaque"),
    whatsapp_numero: normalizarWhatsappNumero(payload.whatsapp_numero),
  };
}

function marcaPublica(restaurante) {
  const whiteLabelAtivo = restaurante?.white_label_ativo === true;
  return {
    id: restaurante.id,
    nome: restaurante.nome,
    slug: restaurante.slug,
    white_label_ativo: whiteLabelAtivo,
    nome_exibicao: whiteLabelAtivo ? restaurante.nome_exibicao : null,
    logo_url: whiteLabelAtivo ? restaurante.logo_url : null,
    cor_primaria: whiteLabelAtivo ? restaurante.cor_primaria : null,
    cor_secundaria: whiteLabelAtivo ? restaurante.cor_secundaria : null,
    cor_texto_principal: whiteLabelAtivo ? restaurante.cor_texto_principal : null,
    cor_texto_secundario: whiteLabelAtivo ? restaurante.cor_texto_secundario : null,
    cor_titulo: whiteLabelAtivo ? restaurante.cor_titulo : null,
    cor_texto_inverso: whiteLabelAtivo ? restaurante.cor_texto_inverso : null,
    whatsapp_numero: restaurante.whatsapp_numero || null,
  };
}

module.exports = {
  BrandingValidationError,
  marcaPublica,
  normalizarWhiteLabel,
};
