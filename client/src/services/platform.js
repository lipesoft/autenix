import { API_URL } from "./api.js";

const STORAGE_KEY = "autenixPlatformSession";

export function getPlatformSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function setPlatformSession(session) {
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
}

export async function loginPlataforma(login, senha) {
  let resposta;
  try {
    resposta = await fetch(`${API_URL}/api/platform/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, senha }),
    });
  } catch {
    throw new Error("Não foi possível conectar à plataforma agora.");
  }

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Login ou senha incorretos.");
  setPlatformSession(dados);
  return dados;
}

export async function platformFetch(caminho, options = {}) {
  const session = getPlatformSession();
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
  });

  if (resposta.status === 401 || resposta.status === 403) {
    setPlatformSession(null);
  }
  return resposta;
}
