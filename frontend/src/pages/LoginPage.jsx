import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout, authStyles as styles } from "../components/layout/AuthLayout";
import { Button } from "../components/primitives/Button";
import { Input } from "../components/primitives/Input";

/**
 * Sign in.
 *
 * The auth flow itself is unchanged from the prototype — login() saves tokens
 * then fetches /auth/me. What is new is the error handling: ApiError separates
 * field-level validation (rendered by the Input) from form-level failures such
 * as bad credentials (rendered once, above the button).
 */
export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const next = params.get("next") || "/projects";

  // Already signed in — don't show a login form behind their back.
  if (user) return <Navigate to={next} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Sign in failed"));
    } finally {
      setLoading(false);
    }
  }

  // A 401 is about the pair, not one field, so it shows as a form-level message.
  const formMessage = error && !error.isValidation ? error.message : null;

  return (
    <AuthLayout
      headline="Where the whole team can see the work."
      sub="Boards, bugs, comments and a permanent activity trail — scoped to the projects you belong to, with roles that actually mean something."
      quote="Every status change, priority edit and reassignment is written to an append-only log in the same transaction as the change itself."
      quoteSource="ACTIVITY MODEL · FR-6.2"
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <span className={styles.eyebrow}>Welcome back</span>
        <h1>Sign in</h1>
        <p className={styles.hint}>Use the account your team added to the project.</p>

        <div className={styles.fields}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@team.dev"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={error?.fieldError("email")}
            required
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error?.fieldError("password")}
            required
          />
        </div>

        {formMessage && (
          <p className={styles.formError} role="alert">
            <AlertCircle size={15} aria-hidden="true" />
            {formMessage}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          block
          loading={loading}
          className={styles.submit}
        >
          Sign in
        </Button>

        <p className={styles.alt}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
