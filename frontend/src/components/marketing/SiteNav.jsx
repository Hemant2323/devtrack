import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { LogoMark } from "../domain/Logo";
import styles from "./Marketing.module.css";

/**
 * Public site navigation.
 *
 * Adapts to the session: a signed-in visitor is offered their workspace
 * rather than a sign-in link they don't need.
 */
export function SiteNav() {
  const { user } = useAuth();

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.navBrand}>
        <LogoMark size={22} style={{ color: "var(--accent-on-ink)" }} />
        <span className={styles.navWord}>DevTrack</span>
      </Link>

      <div className={styles.navLinks}>
        <a href="#workflow">Workflow</a>
        <a href="#issues">Issues</a>
        <a href="#built">Built with</a>
      </div>

      <div className={styles.navCta}>
        {user ? (
          <Link to="/projects" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
            Open workspace
          </Link>
        ) : (
          <>
            <Link to="/login" className={styles.navSignIn}>
              Sign in
            </Link>
            <Link to="/signup" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
