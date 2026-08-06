// Central API client — every request to the backend goes through here.
// Later (auth step) this is the ONE place we'll attach the JWT header,
// instead of repeating it in every component.

// Vite exposes env vars that start with VITE_ via import.meta.env.
// Fallback covers local development with the default uvicorn port.
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function apiGet(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API error ${response.status} on GET ${path}`);
  }
  return response.json();
}
