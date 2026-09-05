import { Inbox } from "lucide-react";
import { cn } from "../../lib/cn";
import styles from "./StateDisplay.module.css";

/**
 * Empty state.
 *
 * An empty list is a moment to tell the user what belongs here and give them
 * the action that fills it — not to show a shrug. Every usage passes an
 * action where one exists.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}) {
  return (
    <div className={cn(styles.state, compact && styles.compact)}>
      <span className={styles.iconWrap}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.actions}>{action}</div>}
    </div>
  );
}
