import { cn } from "../../lib/cn";
import { ISSUE_TYPE, priorityOf, severityOf, statusOf } from "../../lib/enums";
import styles from "./IssueAtoms.module.css";

/** Status label. Always renders its text, so colour is never the only channel. */
export function StatusChip({ status, className }) {
  const meta = statusOf(status);
  return (
    <span
      className={cn(styles.chip, className)}
      style={{ "--chip-fg": meta.fg, "--chip-bg": meta.bg }}
    >
      {meta.label}
    </span>
  );
}

/** Severity label — bugs only. */
export function SeverityChip({ severity, className }) {
  const meta = severityOf(severity);
  if (!meta) return null;
  return (
    <span
      className={cn(styles.chip, className)}
      style={{ "--chip-fg": meta.color, "--chip-bg": "var(--surface-active)" }}
    >
      {meta.label}
    </span>
  );
}

/**
 * Priority indicator. Three bars filled to the level, with the label exposed
 * to assistive tech and on hover via title.
 */
export function PriorityBars({ priority, className }) {
  const meta = priorityOf(priority);
  return (
    <span
      className={cn(styles.pri, styles[`lvl${meta.level}`], className)}
      style={{ "--pri-color": meta.color }}
      title={`${meta.label} priority`}
      role="img"
      aria-label={`${meta.label} priority`}
    >
      <span /> <span /> <span />
    </span>
  );
}

/** The "DEV-42" identifier. Mono because it is an identifier people copy. */
export function IssueKey({ projectKey, number, children, className }) {
  const label = children ?? `${projectKey}-${number}`;
  return <span className={cn(styles.key, className)}>{label}</span>;
}

/** Task vs bug, distinguished by shape as well as colour. */
export function TypeIcon({ type }) {
  const isBug = type === ISSUE_TYPE.BUG.value;
  return (
    <span
      className={cn(styles.type, isBug ? styles.typeBug : styles.typeTask)}
      role="img"
      aria-label={isBug ? "Bug" : "Task"}
      title={isBug ? "Bug" : "Task"}
    >
      <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true">
        {isBug ? (
          <circle cx="6" cy="6" r="3.4" fill="var(--danger-fg)" />
        ) : (
          <rect x="2.5" y="2.5" width="7" height="7" rx="1.6" fill="var(--info-fg)" />
        )}
      </svg>
    </span>
  );
}
