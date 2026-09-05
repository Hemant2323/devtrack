import styles from "./Spinner.module.css";

export function Spinner({ size = 16, className }) {
  return (
    <span
      className={`${styles.spinner} ${className ?? ""}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Full-viewport loading state — used while the session is being restored. */
export function FullPageSpinner({ label = "Loading" }) {
  return (
    <div className={styles.fullPage}>
      <div className={styles.fullPageInner}>
        <Spinner size={22} />
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
