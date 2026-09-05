import { cn } from "../../lib/cn";
import styles from "./Avatar.module.css";

/**
 * Initials avatar. There are no uploaded images in the API, so identity is
 * carried by initials plus a colour deterministically derived from the name —
 * the same person is always the same colour across board, table and comments.
 */
const PALETTE = [
  { bg: "var(--blue-100)",  fg: "var(--blue-600)" },
  { bg: "var(--green-100)", fg: "var(--green-600)" },
  { bg: "var(--amber-100)", fg: "var(--amber-600)" },
  { bg: "var(--red-100)",   fg: "var(--red-600)" },
  { bg: "var(--a-100)",     fg: "var(--a-700)" },
];

function hashIndex(value, buckets) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash % buckets;
}

export function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name = "", size = "md", className, ...props }) {
  const tone = PALETTE[hashIndex(name || "?", PALETTE.length)];
  return (
    <span
      className={cn(styles.avatar, styles[size], className)}
      style={{ "--avatar-bg": tone.bg, "--avatar-fg": tone.fg }}
      aria-hidden="true"
      {...props}
    >
      {initialsOf(name)}
    </span>
  );
}
