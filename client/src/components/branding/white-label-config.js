export const WHITE_LABEL_PADRAO = {
  white_label_ativo: false,
  nome_exibicao: "",
  logo_url: "",
  cor_primaria: "#0b2134",
  cor_secundaria: "#f2742d",
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
  };
}
