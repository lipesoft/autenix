import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../services/api.js";
import { BrandingContext, MARCA_PADRAO } from "./branding-context.js";

function escurecerCor(hex, proporcao = 0.18) {
  const valor = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(valor)) return "#c9511c";
  const canais = [0, 2, 4].map((inicio) => {
    const canal = Number.parseInt(valor.slice(inicio, inicio + 2), 16);
    return Math.max(0, Math.round(canal * (1 - proporcao)))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${canais.join("")}`;
}

function criarMarca(restaurante, slug, carregando = false) {
  const whiteLabelAtivo = restaurante?.white_label_ativo === true;
  const corPrimaria = whiteLabelAtivo && restaurante.cor_primaria
    ? restaurante.cor_primaria
    : MARCA_PADRAO.corPrimaria;
  const corDestaque = whiteLabelAtivo && restaurante.cor_secundaria
    ? restaurante.cor_secundaria
    : MARCA_PADRAO.corDestaque;

  return {
    whiteLabelAtivo,
    nome: whiteLabelAtivo
      ? restaurante.nome_exibicao || restaurante.nome || "Restaurante"
      : MARCA_PADRAO.nome,
    restauranteNome: restaurante?.nome || null,
    logoUrl: whiteLabelAtivo ? restaurante.logo_url || null : MARCA_PADRAO.logoUrl,
    corPrimaria,
    corDestaque,
    corDestaqueEscura: escurecerCor(corDestaque),
    whatsappNumero: restaurante?.whatsapp_numero || "",
    slug: restaurante?.slug || slug || "autenix",
    carregando,
  };
}

export default function BrandingProvider({ children, slug = "autenix", ativo = true }) {
  const [restaurante, setRestaurante] = useState(null);
  const [carregando, setCarregando] = useState(ativo);

  useEffect(() => {
    let montado = true;
    if (!ativo) return undefined;

    async function carregarMarca() {
      try {
        const resposta = await fetch(
          `${API_URL}/api/restaurantes/${encodeURIComponent(slug)}/publico`,
        );
        if (!resposta.ok) throw new Error("Marca indisponivel");
        const dados = await resposta.json();
        if (montado) setRestaurante(dados);
      } catch {
        if (montado) setRestaurante(null);
      } finally {
        if (montado) setCarregando(false);
      }
    }

    carregarMarca();
    return () => {
      montado = false;
    };
  }, [ativo, slug]);

  useEffect(() => {
    if (!ativo) return undefined;
    const atualizar = (event) => {
      if (event.detail?.slug === slug) setRestaurante(event.detail);
    };
    window.addEventListener("autenix:branding-updated", atualizar);
    return () => window.removeEventListener("autenix:branding-updated", atualizar);
  }, [ativo, slug]);

  const marca = useMemo(
    () => (ativo
      ? criarMarca(restaurante, slug, carregando)
      : { ...MARCA_PADRAO, slug, carregando: false }),
    [ativo, carregando, restaurante, slug],
  );

  const estilo = {
    "--app-primary": marca.corPrimaria,
    "--app-accent": marca.corDestaque,
    "--app-accent-dark": marca.corDestaqueEscura || "#c9511c",
  };

  return (
    <BrandingContext.Provider value={marca}>
      <div className="autenix-brand-scope" style={estilo}>{children}</div>
    </BrandingContext.Provider>
  );
}
