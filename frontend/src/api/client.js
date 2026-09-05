/**
 * DevTrack API client.
 *
 * Every network call in the app goes through `request`. Responsibilities:
 *
 *   1. attach the bearer token
 *   2. normalise both backend error shapes into ApiError (see errors.js)
 *   3. refresh an expired access token and retry the original request once
 *   4. collapse concurrent refreshes into a single in-flight request
 *   5. hand control to the app when the session is truly gone
 *
 * (3) and (4) are what the prototype was missing. Access tokens expire after
 * 30 minutes; the refresh token was saved at login and then never used, so a
 * tab left open silently failed every action until a manual reload.
 */
import { ApiError, networkError, normaliseError } from "./errors";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "./tokens";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/* --- session-expiry notification ------------------------------------------
   The client can't navigate — it has no router. It publishes the event and
   the app decides (see AuthContext), which keeps this module framework-free
   and testable. */
const sessionListeners = new Set();

export function onSessionExpired(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function announceSessionExpired() {
  clearTokens();
  for (const listener of sessionListeners) listener();
}

/* --- single-flight refresh ------------------------------------------------
   If five queries 401 at once we must not fire five refreshes: the second
   would race the first and could be rejected, logging the user out mid-work.
   All callers await the same promise. */
let refreshInFlight = null;

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;
      const tokens = await response.json();
      saveTokens(tokens.access_token, tokens.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared in a microtask so every awaiting caller reads the same result
      // before the next 401 can start a fresh attempt.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

async function send(method, path, body, { signal, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = auth ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
    throw networkError(cause);
  }
}

/**
 * @param {string} method  HTTP verb
 * @param {string} path    path beginning with "/" — never a full URL
 * @param {*} [body]       JSON-serialisable request body
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.auth]    false for login/signup/refresh
 * @param {boolean} [options.retry]   internal: guards against retry loops
 */
export async function request(method, path, body, options = {}) {
  const { retry = true, ...rest } = options;

  let response = await send(method, path, body, rest);

  if (response.status === 401 && rest.auth !== false && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send(method, path, body, rest);
    } else {
      announceSessionExpired();
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    // A 401 that survives a successful refresh means the token is fine but
    // this specific call was rejected — treat it as terminal for the session.
    if (response.status === 401 && rest.auth !== false) announceSessionExpired();
    throw normaliseError(
      response.status,
      payload,
      response.statusText || "Request failed",
    );
  }

  return payload;
}

export const api = {
  get: (path, options) => request("GET", path, undefined, options),
  post: (path, body, options) => request("POST", path, body, options),
  patch: (path, body, options) => request("PATCH", path, body, options),
  put: (path, body, options) => request("PUT", path, body, options),
  delete: (path, options) => request("DELETE", path, undefined, options),
};

export { BASE_URL };
export { clearTokens, saveTokens, getAccessToken, getRefreshToken };
