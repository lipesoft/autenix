import { createContext, useContext } from "react";

export const MARCA_PADRAO = {
  whiteLabelAtivo: false,
  nome: "Autenix",
  restauranteNome: null,
  logoUrl: "/logoAutenix.png",
  corPrimaria: "#0b2134",
  corDestaque: "#f2742d",
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
