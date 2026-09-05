import { Avatar } from "../primitives/Avatar";
import { Skeleton } from "../primitives/Skeleton";
import { Tooltip } from "../primitives/Tooltip";
import styles from "./AvatarStack.module.css";

/**
 * Overlapping member avatars with an overflow count.
 *
 * Avatars are aria-hidden by design, so the whole stack carries one accessible
 * name listing the members — a screen reader gets the roster, not nine
 * unlabelled circles.
 */
export function AvatarStack({ members, max = 4, loading = false, size = "sm" }) {
  if (loading) {
    return (
      <span className={styles.skeleton} aria-hidden="true">
        <Skeleton width={22} height={22} radius="999px" />
        <Skeleton width={22} height={22} radius="999px" />
        <Skeleton width={22} height={22} radius="999px" />
      </span>
    );
  }

  if (!members?.length) return null;

  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  const names = members.map((member) => member.name).join(", ");

  return (
    <Tooltip content={names}>
      <span
        className={styles.stack}
        role="img"
        aria-label={`${members.length} member${members.length === 1 ? "" : "s"}: ${names}`}
      >
        {shown.map((member) => (
          <Avatar key={member.user_id} name={member.name} size={size} />
        ))}
        {extra > 0 && <span className={styles.more}>+{extra}</span>}
      </span>
    </Tooltip>
  );
}
