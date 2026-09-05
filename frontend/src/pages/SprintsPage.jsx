import { useState } from "react";
import {
  AlertCircle,
  Archive,
  CalendarRange,
  CheckCircle2,
  Layers,
  Play,
  Plus,
  Rocket,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { issuesApi, projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/primitives/Badge";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Skeleton } from "../components/primitives/Skeleton";
import { CreateSprintDialog } from "../features/sprints/CreateSprintDialog";
import { SprintReportDialog } from "../features/sprints/SprintReportDialog";
import {
  useCompleteSprint,
  useSprints,
  useStartSprint,
} from "../features/sprints/useSprints";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { ROLE, SPRINT_STATE, sprintStateOf } from "../lib/enums";
import { formatDate } from "../lib/format";
import styles from "./SprintsPage.module.css";

function SkeletonList() {
  return (
    <div className={styles.body}>
      {Array.from({ length: 3 }, (_, i) => (
        <div className={styles.skelCard} key={i}>
          <Skeleton width="30%" height={15} />
          <Skeleton width="60%" height={12} />
          <Skeleton width="100%" height={10} />
        </div>
      ))}
    </div>
  );
}

/**
 * Sprint management (FR-5).
 *
 * Only the two legal transitions are offered — start a PLANNED sprint, complete
 * an ACTIVE one. A completed sprint has no controls at all, because the backend
 * rejects every write to it. Mutations are admin-only server-side, so the
 * buttons are hidden rather than shown and refused.
 */
export function SprintsPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const { data: sprints, isPending, isError, error, refetch } = useSprints(pid);
  const { members } = useProjectDirectory(pid);
  const startSprint = useStartSprint(pid);
  const completeSprint = useCompleteSprint(pid);

  const [createOpen, setCreateOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  /* Per-sprint issue counts. There is no aggregate endpoint, so this is one
     request per sprint against the same ?sprint_id filter the Issues page
     uses — the cache entries are shared with it rather than duplicated. */
  const issueQueries = useQueries({
    queries: (sprints ?? []).map((sprint) => ({
      queryKey: keys.issues(pid, { sprint_id: sprint.id }),
      queryFn: ({ signal }) =>
        issuesApi.list(pid, { sprint_id: sprint.id }, { signal }),
      enabled: Boolean(pid),
      staleTime: 30_000,
    })),
  });

  const archived = Boolean(project?.archived);
  const isAdmin = members.find((m) => m.user_id === user?.id)?.role === ROLE.ADMIN.value;
  const canManage = isAdmin && !archived;
  const hasActive = (sprints ?? []).some((s) => s.state === SPRINT_STATE.ACTIVE.value);

  async function run(action, sprintId) {
    setActionError(null);
    try {
      const result = await action.mutateAsync(sprintId);
      if (result?.planned !== undefined) setReport(result);
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Sprints`}
        title="Sprints"
        description="Plan work into sprints. One sprint can be active at a time."
        actions={
          canManage ? (
            <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
              New sprint
            </Button>
          ) : null
        }
      />

      {archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. Sprints are read-only.
        </p>
      )}

      {actionError && (
        <p className={styles.errorBar} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{actionError.message}</span>
          <button
            type="button"
            className={styles.errorDismiss}
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      {isError ? (
        <div className={styles.body}>
          <ErrorState title="Couldn't load sprints" error={error} onRetry={() => refetch()} />
        </div>
      ) : isPending ? (
        <SkeletonList />
      ) : sprints.length === 0 ? (
        <div className={styles.body}>
          <EmptyState
            icon={Rocket}
            title="No sprints yet"
            description="Create a sprint to plan issues out of the backlog into a fixed block of work."
            action={
              canManage ? (
                <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                  New sprint
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className={styles.body}>
          {sprints.map((sprint, index) => {
            const state = sprintStateOf(sprint.state);
            const isActive = sprint.state === SPRINT_STATE.ACTIVE.value;
            const isPlanned = sprint.state === SPRINT_STATE.PLANNED.value;
            const isCompleted = sprint.state === SPRINT_STATE.COMPLETED.value;

            const issues = issueQueries[index]?.data;
            const total = issues?.length ?? 0;
            const done = issues?.filter((i) => i.status === "DONE").length ?? 0;

            return (
              <article
                key={sprint.id}
                className={cn(
                  styles.card,
                  isActive && styles.cardActive,
                  isCompleted && styles.cardCompleted,
                )}
                style={{ "--i": Math.min(index, 8) }}
              >
                <div className={styles.head}>
                  <div className={styles.headText}>
                    <h2 className={styles.name}>{sprint.name}</h2>
                    <p className={cn(styles.goal, !sprint.goal && styles.goalEmpty)}>
                      {sprint.goal || "No goal set."}
                    </p>
                  </div>

                  <div className={styles.actions}>
                    <Badge variant={state.variant} dot={isActive}>
                      {state.label}
                    </Badge>

                    {canManage && isPlanned && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Play}
                        loading={startSprint.isPending && startSprint.variables === sprint.id}
                        // The backend allows only one active sprint; disabling
                        // here explains why instead of surfacing a 409.
                        disabled={hasActive}
                        title={hasActive ? "Another sprint is already active" : undefined}
                        onClick={() => run(startSprint, sprint.id)}
                      >
                        Start
                      </Button>
                    )}

                    {canManage && isActive && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={CheckCircle2}
                        loading={
                          completeSprint.isPending && completeSprint.variables === sprint.id
                        }
                        onClick={() => run(completeSprint, sprint.id)}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                </div>

                <div className={styles.meta}>
                  <span className={styles.metaItem}>
                    <CalendarRange size={14} aria-hidden="true" />
                    {sprint.start_date || sprint.end_date ? (
                      <span className={styles.metaValue}>
                        {sprint.start_date ? formatDate(sprint.start_date) : "—"}
                        {" → "}
                        {sprint.end_date ? formatDate(sprint.end_date) : "—"}
                      </span>
                    ) : (
                      <span className={styles.metaValue}>No dates</span>
                    )}
                  </span>

                  <span className={styles.metaItem}>
                    <Layers size={14} aria-hidden="true" />
                    <span className={styles.metaValue}>
                      {done}/{total}
                    </span>
                    done
                  </span>

                  {total > 0 && (
                    <span
                      className={styles.progress}
                      role="img"
                      aria-label={`${done} of ${total} issues done`}
                    >
                      <span
                        className={styles.progressDone}
                        style={{ width: `${Math.round((done / total) * 100)}%` }}
                      />
                    </span>
                  )}

                  <span className={styles.metaLink}>
                    <Link to={`/projects/${pid}/issues?sprint_id=${sprint.id}`}>
                      View issues
                    </Link>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CreateSprintDialog pid={pid} open={createOpen} onOpenChange={setCreateOpen} />
      <SprintReportDialog
        report={report}
        open={Boolean(report)}
        onOpenChange={(open) => !open && setReport(null)}
      />
    </>
  );
}
