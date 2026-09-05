import { AlertCircle } from "lucide-react";
import styles from "./FieldError.module.css";

/**
 * Inline field-level error. Rendered only when there is a message, so the
 * layout doesn't reserve space for errors that never appear.
 *
 * role="alert" makes the message announced the moment it appears.
 */
export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <span className={styles.error} id={id} role="alert">
      <AlertCircle size={13} className={styles.icon} aria-hidden="true" />
      {children}
    </span>
  );
}
