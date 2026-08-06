// Wraps any route that requires a logged-in user.
// If not authenticated, redirects to /login.

import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "20vh" }}>Loading…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
