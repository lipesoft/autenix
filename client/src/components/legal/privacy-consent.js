import { API_URL } from "../../services/api.js";

export const PRIVACY_POLICY_VERSION = "2026-07-23";
export const TERMS_VERSION = "2026-07-23";
export const COOKIE_CONSENT_VERSION = "2026-07-23";
export const COOKIE_CONSENT_STORAGE_KEY = "autenix_cookie_consent";

export const COOKIE_CATEGORIES = [
  {
    id: "necessarios",
    title: "Necessarios",
    description: "Mantem seguranca, login, roteamento e preferencias essenciais.",
    required: true,
  },
  {
    id: "funcionais",
    title: "Funcionais",
    description: "Lembra escolhas de experiencia, como preferencias visuais futuras.",
    required: false,
  },
  {
    id: "estatisticas",
    title: "Estatisticas",
    description: "Ajuda a medir uso e desempenho sem identificar clientes individualmente.",
    required: false,
  },
  {
    id: "marketing",
    title: "Marketing",
    description: "Permite campanhas, pixels e midias de conversao somente com aceite.",
    required: false,
  },
];

export const DEFAULT_COOKIE_PREFERENCES = Object.freeze({
  necessarios: true,
  funcionais: false,
  estatisticas: false,
  marketing: false,
});

function storageDisponivel() {
  try {
    const teste = "__autenix_privacy_test__";
    window.localStorage.setItem(teste, "1");
    window.localStorage.removeItem(teste);
    return true;
  } catch {
    return false;
  }
}

export function normalizarPreferenciasCookies(preferencias = {}) {
  return COOKIE_CATEGORIES.reduce((acc, categoria) => {
    acc[categoria.id] = categoria.required
      ? true
      : Boolean(preferencias[categoria.id]);
    return acc;
  }, {});
}

export function getCookieConsent() {
  if (typeof window === "undefined" || !storageDisponivel()) return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== COOKIE_CONSENT_VERSION) return null;
    return {
      ...parsed,
      preferences: normalizarPreferenciasCookies(parsed.preferences),
    };
  } catch {
    return null;
  }
}

export function saveCookieConsent(preferences, source = "banner") {
  const consent = {
    version: COOKIE_CONSENT_VERSION,
    privacy_version: PRIVACY_POLICY_VERSION,
    terms_version: TERMS_VERSION,
    source,
    preferences: normalizarPreferenciasCookies(preferences),
    accepted_at: new Date().toISOString(),
  };

  if (typeof window !== "undefined" && storageDisponivel()) {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent("autenix:privacy-consent", { detail: consent }));
  }

  return consent;
}

export function canUseCookieCategory(categoryId) {
  const consent = getCookieConsent();
  return Boolean(consent?.preferences?.[categoryId]);
}

export async function recordLegalConsent({
  contexto,
  restauranteSlug,
  aceites = {},
  categorias = {},
  metadados = {},
}) {
  const payload = {
    contexto,
    restaurante_slug: restauranteSlug,
    politica_versao: PRIVACY_POLICY_VERSION,
    termos_versao: TERMS_VERSION,
    aceite_privacidade: Boolean(aceites.privacidade),
    aceite_termos: Boolean(aceites.termos),
    categorias: normalizarPreferenciasCookies(categorias),
    metadados,
  };

  const response = await fetch(`${API_URL}/api/consentimentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.erro || "Nao foi possivel registrar o consentimento.");
  }

  return data;
}
