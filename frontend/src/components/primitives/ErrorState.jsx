import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";
import styles from "./StateDisplay.module.css";

/**
 * Error state.
 *
 * Says what failed and offers the way out. ApiError already carries a human
 * message (normalised from either backend shape), so we surface it directly
 * instead of a generic "something went wrong".
 */
export function ErrorState({ error, title = "Something went wrong", onRetry, compact = false }) {
  const message =
    error?.message ?? "The request failed. Check your connection and try again.";

  return (
    <div className={cn(styles.state, compact && styles.compact)} role="alert">
      <span className={cn(styles.iconWrap, styles.errorIcon)}>
        <AlertTriangle size={20} aria-hidden="true" />
      </span>
      <div>
        <p className={styles.title}>{title}</p>
        <p className={styles.description}>{message}</p>
      </div>
      {onRetry && (
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
