import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { FullPageSpinner } from "../components/primitives/Spinner";

/**
 * Gate for routes that require a session.
 *
 * While `loading` we render a spinner rather than redirecting: bouncing the
 * user to /login before the token check finishes would flash the login screen
 * on every refresh.
 *
 * On redirect we remember where they were headed so login can return them.
 */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label="Loading DevTrack" />;

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}
