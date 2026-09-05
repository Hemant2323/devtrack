import { History } from "lucide-react";
import { EmptyState } from "../../components/primitives/EmptyState";
import { ErrorState } from "../../components/primitives/ErrorState";
import { Skeleton } from "../../components/primitives/Skeleton";
import { cn } from "../../lib/cn";
import { formatDate, formatRelative } from "../../lib/format";
import { useIssueActivities } from "./useIssues";
import styles from "./ActivityFeed.module.css";

/** Turn a snake_case column name into something a person reads. */
const FIELD_LABELS = {
  status: "Status",
  priority: "Priority",
  severity: "Severity",
  title: "Title",
  description: "Description",
  assignee_id: "Assignee",
  component_id: "Component",
  deadline: "Due date",
  steps_to_reproduce: "Steps to reproduce",
  sprint_id: "Sprint",
};

function fieldLabel(field) {
  if (!field) return "a field";
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

/**
 * Render one ActivityResponse row as a sentence.
 *
 * The backend stores raw values — action, field, old_value, new_value — and
 * writes ids for assignee/component. Those are resolved to names via the
 * project directory where possible; when a value cannot be resolved (a removed
 * member, say) the raw value is shown rather than a guess.
 */
function describe(activity, resolve) {
  const { action, field, old_value: oldValue, new_value: newValue } = activity;

  if (action === "created") return <>created this issue</>;
  if (action === "deleted") return <>deleted this issue</>;
  if (action === "commented") {
    return (
      <>
        commented
        {newValue && <span className={styles.quote}>{newValue}</span>}
      </>
    );
  }

  const from = resolve(field, oldValue);
  const to = resolve(field, newValue);

  if (action === "status_changed") {
    return (
      <>
        changed <strong>Status</strong> from <span className={styles.value}>{from}</span> to{" "}
        <span className={styles.value}>{to}</span>
      </>
    );
  }

  // field_changed, and anything the backend adds later.
  if (!oldValue && newValue) {
    return (
      <>
        set <strong>{fieldLabel(field)}</strong> to <span className={styles.value}>{to}</span>
      </>
    );
  }
  if (oldValue && !newValue) {
    return (
      <>
        cleared <strong>{fieldLabel(field)}</strong>
      </>
    );
  }
  return (
    <>
      changed <strong>{fieldLabel(field)}</strong> from{" "}
      <span className={styles.value}>{from}</span> to <span className={styles.value}>{to}</span>
    </>
  );
}

export function ActivityFeed({ iid, memberById, componentById }) {
  const { data: activities, isPending, isError, error, refetch } = useIssueActivities(iid);

  if (isError) {
    return <ErrorState compact title="Couldn't load activity" error={error} onRetry={refetch} />;
  }

  if (isPending) {
    return (
      <div className={styles.feed}>
        {Array.from({ length: 3 }, (_, i) => (
          <div className={styles.item} key={i}>
            <Skeleton width={`${60 + i * 10}%`} height={12} />
          </div>
        ))}
      </div>
    );
  }

  if (!activities?.length) {
    return (
      <EmptyState
        compact
        icon={History}
        title="No activity recorded"
        description="Every change to this issue is logged here as it happens."
      />
    );
  }

  /** Values for id-bearing fields are stored as raw ids; resolve to names. */
  const resolve = (field, value) => {
    if (value == null || value === "") return "none";
    if (field === "assignee_id") return memberById.get(Number(value))?.name ?? value;
    if (field === "component_id") return componentById.get(Number(value))?.name ?? value;
    return value;
  };

  return (
    <div className={styles.feed}>
      {activities.map((activity) => {
        const actor = memberById.get(activity.actor_id);
        return (
          <div
            className={cn(
              styles.item,
              activity.action === "created" && styles.created,
              activity.action === "status_changed" && styles.statusChanged,
              activity.action === "commented" && styles.commented,
              activity.action === "deleted" && styles.deleted,
            )}
            key={activity.id}
          >
            <p className={styles.line}>
              <span className={styles.actor}>{actor?.name ?? "Someone"}</span>{" "}
              {describe(activity, resolve)}
            </p>
            <time className={styles.time} title={formatDate(activity.created_at)}>
              {formatRelative(activity.created_at)}
            </time>
          </div>
        );
      })}
    </div>
  );
}
