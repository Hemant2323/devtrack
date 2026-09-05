import { cn } from "../../lib/cn";
import styles from "./Skeleton.module.css";

/**
 * Loading placeholder. Skeletons are used where the shape of the result is
 * known (a table row, a card) — a spinner is used where it isn't.
 */
export function Skeleton({ width, height, radius, className, ...props }) {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, width = "100%" }) {
  return (
    <span className={styles.stack} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={styles.text}
          width={i === lines - 1 ? "60%" : width}
        />
      ))}
    </span>
  );
}
