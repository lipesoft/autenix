import { createContext, useContext } from "react";

export const MARCA_PADRAO = {
  whiteLabelAtivo: false,
  nome: "Autenix",
  restauranteNome: null,
  logoUrl: "/logoAutenix.png",
  corPrimaria: "#0b2134",
  corDestaque: "#f2742d",
  corTextoPrincipal: "#132331",
  corTextoSecundario: "#4f6070",
  corTitulo: "#0b2134",
  corTextoInverso: "#ffffff",
  whatsappNumero: "",
  slug: "autenix",
  carregando: false,
};

export const BrandingContext = createContext(MARCA_PADRAO);

export function notificarMarcaAtualizada(restaurante) {
  window.dispatchEvent(
    new CustomEvent("autenix:branding-updated", { detail: restaurante }),
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
