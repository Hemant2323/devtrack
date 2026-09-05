import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import styles from "./Logo.module.css";

/**
 * DevTrack mark.
 *
 * Three stacked tracks of decreasing length with a filled leading node — a
 * work-in-flight motif that reads as both a task list and a branching commit
 * graph. Drawn as geometry rather than an illustration so it stays crisp at
 * 16px and takes its colour from whatever surface it sits on.
 *
 * `tone` overrides the accent — used on ink surfaces, where the light-theme
 * accent would not have enough contrast.
 */
export function LogoMark({ size = 18, tone, className, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={cn(styles.mark, className)}
      style={tone ? { color: tone } : undefined}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect x="1.5" y="1.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.75" cy="6.5" r="1.75" fill="currentColor" />
      <path d="M10.25 6.5H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6.75" cy="13.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.25 13.5H12.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.75 8.75V11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ to = "/projects", showWordmark = true, size = 18, tone }) {
  return (
    <Link to={to} className={styles.brand}>
      <LogoMark size={size} tone={tone} />
      {showWordmark && <span className={styles.wordmark}>DevTrack</span>}
    </Link>
  );
}
