import { API_URL } from "./api.js";

export async function loginUsuario(login, senha) {
  let response;

  try {
    response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, senha }),
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

export function rotaDoPerfil(role) {
  return {
    admin: "/admin",
    garcom: "/garcom",
    cozinha: "/cozinha",
    financeiro: "/financeiro",
  }[role] || "/";
}
