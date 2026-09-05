import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout, authStyles as styles } from "../components/layout/AuthLayout";
import { Button } from "../components/primitives/Button";
import { Input } from "../components/primitives/Input";

/**
 * Create account.
 *
 * signup() posts to /auth/signup then immediately logs in — the API returns a
 * user, not tokens, so the login call is what establishes the session. That
 * sequence is preserved from the prototype.
 *
 * The 8-character rule is enforced by the backend (422 with a field-level
 * detail). We surface that inline rather than duplicating the rule here, so
 * the two can never disagree.
 */
export function SignupPage() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/projects" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(name, email, password);
      navigate("/projects", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Sign up failed"));
    } finally {
      setLoading(false);
    }
  }

  const formMessage = error && !error.isValidation ? error.message : null;

  return (
    <AuthLayout
      headline="Start tracking in about a minute."
      sub="Create a project, add your team with the roles they need, and file the first issue. There is nothing to configure first."
      quote="Issue keys are sequential per project and generated atomically, so DEV-42 means the same thing to everyone, forever."
      quoteSource="ISSUE KEYS · FR-3"
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <span className={styles.eyebrow}>Get started</span>
        <h1>Create your account</h1>
        <p className={styles.hint}>Free while DevTrack is in development.</p>

        <div className={styles.fields}>
          <Input
            label="Name"
            type="text"
            autoComplete="name"
            placeholder="Asha Shah"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={error?.fieldError("name")}
            required
            autoFocus
          />

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@team.dev"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={error?.fieldError("email")}
            required
          />

          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error?.fieldError("password")}
            hint="At least 8 characters."
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
          Create account
        </Button>

        <p className={styles.alt}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
