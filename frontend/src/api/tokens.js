/**
 * Token storage.
 *
 * localStorage is a deliberate choice, not an oversight: the backend issues
 * bearer tokens with no cookie or CSRF support, so httpOnly cookies would
 * require server changes. Access is funnelled through this module so the
 * decision is reversible in one place.
 */
const ACCESS = "access_token";
const REFRESH = "refresh_token";

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS);
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH);
  } catch {
    return null;
  }
}

export function saveTokens(accessToken, refreshToken) {
  try {
    if (accessToken) localStorage.setItem(ACCESS, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH, refreshToken);
  } catch {
    /* private mode / storage disabled — the session simply won't persist */
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  } catch {
    /* nothing to clear */
  }
}
