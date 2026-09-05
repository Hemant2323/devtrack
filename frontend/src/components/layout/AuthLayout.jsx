import { Link } from "react-router-dom";
import { LogoMark } from "../domain/Logo";
import { Lanes } from "../marketing/Lanes";
import styles from "./AuthLayout.module.css";

/**
 * Split-screen frame shared by sign in and sign up.
 *
 * The ink panel is the same surface tier as the marketing hero, so arriving
 * from the landing page feels continuous rather than like a different product.
 */
export function AuthLayout({ headline, sub, quote, quoteSource, children }) {
  return (
    <div className={styles.split}>
      <aside className={styles.panel}>
        <Lanes />

        <Link to="/" className={styles.brand}>
          <LogoMark size={22} tone="var(--accent-on-ink)" />
          <span className={styles.brandWord}>DevTrack</span>
        </Link>

        <div className={styles.panelBody}>
          <h2>{headline}</h2>
          <p className={styles.panelSub}>{sub}</p>
        </div>

        {quote && (
          <blockquote className={styles.quote}>
            <p>{quote}</p>
            <span>{quoteSource}</span>
          </blockquote>
        )}

        <span className={styles.panelFoot}>&copy; 2026 DevTrack</span>
      </aside>

      <main className={styles.formCol}>{children}</main>
    </div>
  );
}

export { styles as authStyles };
