// AuthContext makes the logged-in user available to any component,
// without passing it down through props at every level.
//
// Usage:
//   const { user, login, logout } = useAuth();

import { createContext, useContext, useEffect, useState } from "react";
import { api, clearTokens, saveTokens } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = not yet checked; false = logged out; object = logged in user
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, try to restore the session from the stored token.
  useEffect(() => {
    api
      .get("/auth/me")
      .then(setUser)
      .catch(() => setUser(false))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const tokens = await api.post("/auth/login", { email, password });
    saveTokens(tokens.access_token, tokens.refresh_token);
    const me = await api.get("/auth/me");
    setUser(me);
    return me;
  }

  async function signup(name, email, password) {
    await api.post("/auth/signup", { name, email, password });
    return login(email, password);
  }

  function logout() {
    clearTokens();
    setUser(false);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
