import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "../api/endpoints";
import { clearTokens, onSessionExpired, saveTokens } from "../api/client";

/**
 * AuthContext
 *
 * The prototype's flow is preserved deliberately — it was correct:
 *   - signup then immediately logs in (the API returns a user, not tokens)
 *   - login saves tokens, then fetches /auth/me for the profile
 *   - on mount, /auth/me restores the session from a stored token
 *   - `user` is tri-state: null = checking, false = signed out, object = signed in
 *     (ProtectedRoute depends on being able to tell "checking" from "signed out",
 *     which a plain null/undefined pair cannot express)
 *
 * What is new: the client now refreshes expired access tokens on its own, and
 * publishes a session-expired event when the refresh fails. We subscribe here
 * so an expiry cleanly signs the user out instead of failing silently.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on first load.
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) setUser(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The API client tells us when a refresh failed and the session is gone.
  useEffect(() => onSessionExpired(() => setUser(false)), []);

  const login = useCallback(async (email, password) => {
    const tokens = await authApi.login({ email, password });
    saveTokens(tokens.access_token, tokens.refresh_token);
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const signup = useCallback(
    async (name, email, password) => {
      await authApi.signup({ name, email, password });
      return login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
