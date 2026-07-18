export const WHITE_LABEL_PADRAO = {
  white_label_ativo: false,
  nome_exibicao: "",
  logo_url: "",
  cor_primaria: "#0b2134",
  cor_secundaria: "#f2742d",
  cor_texto_principal: "#132331",
  cor_texto_secundario: "#4f6070",
  cor_titulo: "#0b2134",
  cor_texto_inverso: "#ffffff",
  whatsapp_numero: "",
};

export function normalizarWhiteLabel(value = {}) {
  const dados = value || {};
  return {
    ...WHITE_LABEL_PADRAO,
    ...dados,
    white_label_ativo: Boolean(dados.white_label_ativo),
    nome_exibicao: dados.nome_exibicao ?? "",
    logo_url: dados.logo_url ?? "",
    cor_primaria: dados.cor_primaria || WHITE_LABEL_PADRAO.cor_primaria,
    cor_secundaria: dados.cor_secundaria || WHITE_LABEL_PADRAO.cor_secundaria,
    cor_texto_principal: dados.cor_texto_principal || WHITE_LABEL_PADRAO.cor_texto_principal,
    cor_texto_secundario: dados.cor_texto_secundario || WHITE_LABEL_PADRAO.cor_texto_secundario,
    cor_titulo: dados.cor_titulo || WHITE_LABEL_PADRAO.cor_titulo,
    cor_texto_inverso: dados.cor_texto_inverso || WHITE_LABEL_PADRAO.cor_texto_inverso,
    whatsapp_numero: dados.whatsapp_numero ?? "",
  };
}
