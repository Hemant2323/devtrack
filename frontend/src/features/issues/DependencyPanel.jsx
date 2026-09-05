import { useMemo, useState } from "react";
import { AlertCircle, Ban, Link2, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Skeleton } from "../../components/primitives/Skeleton";
import { Tooltip } from "../../components/primitives/Tooltip";
import { IssueKey, StatusChip, TypeIcon } from "../../components/domain/IssueAtoms";
import { STATUS } from "../../lib/enums";
import { AddDependencyDialog } from "./AddDependencyDialog";
import {
  useAddDependency,
  useIssueDependencies,
  useRemoveDependency,
} from "./useDependencies";
import styles from "./DependencyPanel.module.css";

function DependencyRow({ pid, link, onRemove, removing, canEdit, showDot = false }) {
  // A blocker still counts until it is done — the same rule the board uses.
  const unresolved = link.issue.status !== STATUS.DONE.value;
  return (
    <li className={styles.row}>
      {/* Marks a blocker that is still open. Never the only channel: the
          status chip beside it says the same thing in words. */}
      {showDot && (
        <span
          className={unresolved ? styles.dotOpen : styles.dotDone}
          aria-hidden="true"
        />
      )}
      <TypeIcon type={link.issue.type} />
      <Link to={`/projects/${pid}/issues/${link.issue.id}`} className={styles.rowLink}>
        <IssueKey>{link.issue.key}</IssueKey>
        <span className={styles.rowTitle}>{link.issue.title}</span>
      </Link>
      <StatusChip status={link.issue.status} className={styles.rowStatus} />
      {canEdit && (
        <Tooltip content="Remove dependency">
          <button
            type="button"
            className={styles.remove}
            disabled={removing}
            onClick={() => onRemove(link)}
            aria-label={`Remove dependency on ${link.issue.key}`}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </Tooltip>
      )}
    </li>
  );
}

function Group({ title, hint, links, ...rowProps }) {
  if (!links.length) return null;
  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>
        {title}
        <span className={styles.groupCount}>{links.length}</span>
      </h3>
      {hint && <p className={styles.groupHint}>{hint}</p>}
      <ul className={styles.list}>
        {links.map((link) => (
          <DependencyRow key={link.id} link={link} {...rowProps} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Dependencies for one issue.
 *
 * Two lists from one directed edge: what has to happen first ("Blocked by")
 * and what is waiting on this ("Blocks"). Removal addresses the edge itself,
 * so it works identically from either side.
 *
 * These relationships are informational. Nothing here — and nothing on the
 * server — moves an issue, gates a transition, or reorders a sprint because
 * of a blocker; the team decides what to do about it.
 */
export function DependencyPanel({ pid, iid, archived = false }) {
  const { data, isPending, isError, error, refetch } = useIssueDependencies(iid);
  const addDependency = useAddDependency(pid, iid);
  const removeDependency = useRemoveDependency(pid, iid);

  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const canEdit = !archived;
  const blockedBy = data?.blocked_by ?? [];
  const blocks = data?.blocks ?? [];
  const isEmpty = !isPending && !isError && !blockedBy.length && !blocks.length;

  /* Both ends of every existing link, so the picker cannot offer a duplicate
     the server would only reject. Keyed on the query result rather than the
     two derived arrays, which are rebuilt on every render. */
  const linkedIssueIds = useMemo(() => {
    const ids = new Set();
    for (const link of [...(data?.blocked_by ?? []), ...(data?.blocks ?? [])]) {
      ids.add(link.issue.id);
    }
    return ids;
  }, [data]);

  async function handleAdd({ issueId, direction }) {
    setActionError(null);
    await addDependency.mutateAsync({ issueId, direction });
  }

  async function handleRemove(link) {
    setActionError(null);
    setRemovingId(link.id);
    try {
      await removeDependency.mutateAsync({
        dependencyId: link.id,
        otherIssueId: link.issue.id,
      });
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err : new ApiError(0, "Could not remove the dependency"),
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className={styles.panelBody}>
      {isPending && (
        <div className={styles.skel}>
          <Skeleton width="30%" height={11} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
        </div>
      )}

      {isError && (
        <div className={styles.error} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{error?.message ?? "Couldn't load dependencies."}</span>
          <button type="button" className={styles.retry} onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {isEmpty && (
        <p className={styles.empty}>
          <Link2 size={15} aria-hidden="true" />
          No dependencies.{" "}
          {canEdit
            ? "Link another issue to record what has to happen first."
            : "Links to other issues would appear here."}
        </p>
      )}

      <Group
        title="Blocked by"
        hint="These need to be resolved first."
        links={blockedBy}
        pid={pid}
        canEdit={canEdit}
        onRemove={handleRemove}
        removing={removingId !== null}
        showDot
      />
      <Group
        title="Blocks"
        hint="These are waiting on this issue."
        links={blocks}
        pid={pid}
        canEdit={canEdit}
        onRemove={handleRemove}
        removing={removingId !== null}
      />

      {actionError && (
        <p className={styles.error} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{actionError.message}</span>
        </p>
      )}

      {canEdit ? (
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
            Add dependency
          </Button>
        </div>
      ) : (
        <p className={styles.readOnly}>
          <Ban size={13} aria-hidden="true" />
          This project is archived — dependencies are read-only.
        </p>
      )}

      <AddDependencyDialog
        pid={pid}
        iid={iid}
        open={adding}
        onOpenChange={setAdding}
        excludeIssueIds={linkedIssueIds}
        onSubmit={handleAdd}
        isSubmitting={addDependency.isPending}
      />
    </div>
  );
}
