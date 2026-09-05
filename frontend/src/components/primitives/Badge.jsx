import { cn } from "../../lib/cn";
import styles from "./Badge.module.css";

/**
 * Small state/metadata label.
 *
 * `dot` adds a filled marker so the badge never relies on colour alone —
 * the text inside it always carries the same meaning (WCAG 1.4.1).
 */
export function Badge({
  variant = "neutral",
  dot = false,
  count = false,
  className,
  children,
  ...props
}) {
  return (
    <span
      className={cn(styles.badge, styles[variant], count && styles.count, className)}
      {...props}
    >
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
