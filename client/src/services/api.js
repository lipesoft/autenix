const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/$/, "")
  : import.meta.env.DEV
    ? "http://localhost:3001"
    : window.location.origin;
