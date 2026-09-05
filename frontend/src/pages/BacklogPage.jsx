import { useState } from "react";
import { AlertCircle, Archive, ChevronDown, Inbox, Plus, Search, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { Avatar } from "../components/primitives/Avatar";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Input } from "../components/primitives/Input";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
} from "../components/primitives/Menu";
import { Skeleton } from "../components/primitives/Skeleton";
import { Tooltip } from "../components/primitives/Tooltip";
import {
  IssueKey,
  PriorityBars,
  SeverityChip,
  StatusChip,
  TypeIcon,
} from "../components/domain/IssueAtoms";
import { CreateIssueDialog } from "../features/issues/CreateIssueDialog";
import { useIssueList } from "../features/issues/useIssues";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import {
  assignableSprints,
  useAssignIssueToSprint,
  useSprints,
} from "../features/sprints/useSprints";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { sprintStateOf } from "../lib/enums";
import styles from "./BacklogPage.module.css";

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={14} height={14} radius="3px" />
      <Skeleton width={54} height={11} />
      <Skeleton width={`${45 + ((i * 9) % 30)}%`} height={13} />
      <Skeleton width={64} height={19} radius="3px" />
      <Skeleton width={12} height={10} />
      <Skeleton width={92} height={26} radius="4px" />
    </div>
  ));
}

/**
 * Backlog — issues not assigned to any sprint.
 *
 * There is no backlog model or endpoint: the backend defines backlog as
 * "sprint_id IS NULL" and exposes it as `?in_backlog=true` on the existing
 * issues endpoint, which is exactly what this page requests. Search stays
 * server-side through the same `q` parameter the Issues page uses.
 */
export function BacklogPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { memberById } = useProjectDirectory(pid);
  const { data: sprints } = useSprints(pid);
  const assign = useAssignIssueToSprint(pid);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const q = params.get("q") ?? "";

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  // in_backlog is a real server-side filter — no client-side sieving here.
  const { data: issues, isPending, isError, error, refetch } = useIssueList(pid, {
    in_backlog: true,
    q,
  });

  const archived = Boolean(project?.archived);
  const isMember = Boolean(memberById.get(user?.id));
  const canEdit = isMember && !archived;
  const targets = assignableSprints(sprints);

  /* Fresh URLSearchParams, replace semantics — searching must not stack a
     history entry per keystroke. */
  function setSearch(value) {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

  async function moveToSprint(issueId, sprintId) {
    setAssignError(null);
    setPendingId(issueId);
    try {
      await assign.mutateAsync({ issueId, sprintId });
    } catch (err) {
      setAssignError(err);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Backlog`}
        title="Backlog"
        description="Issues that aren't in a sprint yet. Assign them to plan work."
        actions={
          canEdit ? (
            <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
              Create issue
            </Button>
          ) : null
        }
      />

      {archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. The backlog is read-only.
        </p>
      )}

      {assignError && (
        <p className={styles.errorBar} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>Couldn&rsquo;t move that issue: {assignError.message}</span>
          <button
            type="button"
            className={styles.errorDismiss}
            onClick={() => setAssignError(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            icon={Search}
            type="search"
            placeholder="Search the backlog…"
            value={q}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search backlog issues"
          />
        </div>
        <span className={styles.spacer} />
        {!isPending && !isError && (
          <span className={styles.count}>
            {issues?.length ?? 0} in backlog
          </span>
        )}
      </div>

      <div className={styles.body}>
        {isError ? (
          <ErrorState title="Couldn't load the backlog" error={error} onRetry={() => refetch()} />
        ) : (
          <div className={styles.panel}>
            {isPending && <SkeletonRows />}

            {!isPending && issues?.length === 0 && (
              q ? (
                <EmptyState
                  icon={SearchX}
                  title="No backlog issues match"
                  description={`Nothing in the backlog matches “${q}”.`}
                  action={
                    <Button variant="secondary" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="Backlog is empty"
                  description="Every issue in this project is assigned to a sprint. New issues start here."
                  action={
                    canEdit ? (
                      <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                        Create issue
                      </Button>
                    ) : null
                  }
                />
              )
            )}

            {!isPending &&
              issues?.map((issue) => {
                const assignee = issue.assignee_id ? memberById.get(issue.assignee_id) : null;
                return (
                  <div
                    key={issue.id}
                    className={cn(styles.row, pendingId === issue.id && styles.rowPending)}
                  >
                    <span className={styles.typeCell}>
                      <TypeIcon type={issue.type} />
                    </span>
                    <span className={styles.keyCell}>
                      <IssueKey>{issue.key}</IssueKey>
                    </span>
                    <Link
                      to={`/projects/${pid}/issues/${issue.id}`}
                      className={cn(styles.link, styles.titleCell)}
                    >
                      <span className={styles.title}>{issue.title}</span>
                    </Link>
                    <span className={styles.metaCell}>
                      <StatusChip status={issue.status} />
                      {issue.severity && <SeverityChip severity={issue.severity} />}
                      <span className={styles.priorityCell}>
                        <PriorityBars priority={issue.priority} />
                      </span>
                    </span>
                    <span className={styles.assigneeCell}>
                      {assignee ? (
                        <Tooltip content={assignee.name}>
                          <span>
                            <Avatar name={assignee.name} size="xs" />
                          </span>
                        </Tooltip>
                      ) : (
                        <span className={styles.unassigned} aria-label="Unassigned">
                          —
                        </span>
                      )}
                    </span>

                    {canEdit && (
                      <Menu>
                        <MenuTrigger
                          className={styles.assign}
                          aria-label={`Move ${issue.key} to a sprint`}
                          disabled={targets.length === 0}
                          title={
                            targets.length === 0
                              ? "No open sprint to move this into"
                              : undefined
                          }
                        >
                          Add to sprint
                          <ChevronDown size={12} aria-hidden="true" />
                        </MenuTrigger>
                        <MenuContent align="end">
                          <MenuLabel>Move to sprint</MenuLabel>
                          {/* Completed sprints are excluded: the backend
                              rejects them with 409. */}
                          {targets.map((sprint) => (
                            <MenuItem
                              key={sprint.id}
                              onSelect={() => moveToSprint(issue.id, sprint.id)}
                            >
                              {sprint.name}
                              <span style={{ marginLeft: "auto", opacity: 0.6 }}>
                                {sprintStateOf(sprint.state).label}
                              </span>
                            </MenuItem>
                          ))}
                        </MenuContent>
                      </Menu>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <CreateIssueDialog pid={pid} open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
