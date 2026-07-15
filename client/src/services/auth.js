import { API_URL } from "./api.js";

export function getUsuarioSessao() {
  try {
    return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
  } catch {
    return null;
  }
}

export function authHeaders(headers = {}) {
  const token = getUsuarioSessao()?.token;
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

export function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
}

export function normalizarSlugRestaurante(slug) {
  return String(slug || "autenix")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "autenix";
}

export function rotaRestaurante(slug, destino = "") {
  const slugSeguro = encodeURIComponent(normalizarSlugRestaurante(slug));
  const caminho = String(destino || "").replace(/^\/+/, "");
  return `/r/${slugSeguro}${caminho ? `/${caminho}` : ""}`;
}

export async function loginUsuario(login, senha, restauranteSlug = "autenix") {
  let response;

  try {
    response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login,
        senha,
        restaurante_slug: normalizarSlugRestaurante(restauranteSlug),
      }),
    });
  } catch {
    throw new Error("Não foi possível conectar ao restaurante agora.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.erro || "Login ou senha incorretos.");
  }

  return data;
}

export function rotaDoPerfil(role, restauranteSlug = "autenix") {
  const destino = {
    admin: "central",
    garcom: "garcom",
    cozinha: "cozinha",
    financeiro: "financeiro",
  }[role];
  return destino ? rotaRestaurante(restauranteSlug, destino) : rotaRestaurante(restauranteSlug);
}
