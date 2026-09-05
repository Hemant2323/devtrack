import { useState } from "react";
import { AlertCircle, Archive, ChevronDown, Columns3, Inbox, Plus, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../components/primitives/Menu";
import { Skeleton } from "../components/primitives/Skeleton";
import { BoardCard } from "../features/board/BoardCard";
import { useBoard, useMoveIssue } from "../features/board/useBoard";
import { useBlockedIssueIds } from "../features/issues/useDependencies";
import { CreateIssueDialog } from "../features/issues/CreateIssueDialog";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useSprints } from "../features/sprints/useSprints";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { BOARD_COLUMNS, statusOf } from "../lib/enums";
import styles from "./BoardPage.module.css";

function SkeletonBoard() {
  return (
    <div className={styles.board}>
      {BOARD_COLUMNS.map((column, columnIndex) => (
        <div className={styles.column} key={column.key}>
          <div className={styles.columnHead}>
            <span className={styles.dot} style={{ "--col-color": statusOf(column.status).fg }} />
            <span className={styles.columnName}>{statusOf(column.status).label}</span>
          </div>
          <div className={styles.cards}>
            {Array.from({ length: 3 - (columnIndex % 2) }, (_, i) => (
              <div className={styles.skelCard} key={i}>
                <Skeleton width="45%" height={11} />
                <Skeleton width="100%" height={12} />
                <Skeleton width="70%" height={12} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Kanban board.
 *
 * Columns come from BOARD_COLUMNS, which mirrors the four keys the backend's
 * board endpoint actually returns (todo, in_progress, testing, done). Moving a
 * card issues the existing PATCH /issues/{id} with a new status — there is no
 * board-specific move endpoint and none was invented.
 */
export function BoardPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  /* The sprint filter lives in the URL so a filtered board can be shared and
     Back/Forward moves between views. It maps straight onto the board API's
     existing ?sprint_id parameter. */
  const sprintParam = params.get("sprint_id") ?? "";
  const sprintId = sprintParam ? Number(sprintParam) : null;

  const { data: board, isPending, isError, error, refetch, isFetching } = useBoard(pid, sprintId);
  const { members, memberById, componentById } = useProjectDirectory(pid);
  // One request for the whole board, not one per card.
  const blockedIssueIds = useBlockedIssueIds(pid);
  const { data: sprints } = useSprints(pid);
  const { move, pending, error: moveError, clearError } = useMoveIssue(pid, sprintId);

  /* Fresh URLSearchParams, replace semantics — switching filter must not
     stack history entries. */
  function setSprintFilter(value) {
    const next = new URLSearchParams(params);
    if (value) next.set("sprint_id", value);
    else next.delete("sprint_id");
    setParams(next, { replace: true });
  }

  const selectedSprint = (sprints ?? []).find((s) => String(s.id) === sprintParam);

  const [createOpen, setCreateOpen] = useState(false);
  const [overColumn, setOverColumn] = useState(null);
  const [announcement, setAnnouncement] = useState("");

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);
  // Any project member may edit an issue; the backend rejects writes on an
  // archived project with 403, so the board is read-only there.
  const isMember = members.some((member) => member.user_id === user?.id);
  const canEdit = isMember && !archived;

  const total = BOARD_COLUMNS.reduce(
    (sum, column) => sum + (board?.[column.key]?.length ?? 0),
    0,
  );

  function handleMove(issueId, status, issueKey) {
    move(issueId, status);
    setAnnouncement(`${issueKey ?? "Issue"} moved to ${statusOf(status).label}`);
  }

  function handleDrop(event, column) {
    event.preventDefault();
    setOverColumn(null);
    const issueId = Number(event.dataTransfer.getData("text/plain"));
    if (!issueId) return;
    const source = BOARD_COLUMNS.find((c) =>
      (board?.[c.key] ?? []).some((issue) => issue.id === issueId),
    );
    if (!source || source.status === column.status) return;
    const issue = board[source.key].find((i) => i.id === issueId);
    handleMove(issueId, column.status, issue?.key);
  }

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Board`}
        title="Board"
        description="Drag a card to another column, or use its move menu, to change status."
        actions={
          <>
            <Menu>
              <MenuTrigger
                className={cn(styles.sprintFilter, sprintParam && styles.sprintFilterActive)}
                aria-label="Filter the board by sprint"
              >
                {selectedSprint ? selectedSprint.name : "All issues"}
                <ChevronDown size={13} aria-hidden="true" />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuLabel>Sprint</MenuLabel>
                <MenuRadioGroup value={sprintParam} onValueChange={setSprintFilter}>
                  <MenuRadioItem value="">All issues</MenuRadioItem>
                  {(sprints ?? []).map((sprint) => (
                    <MenuRadioItem key={sprint.id} value={String(sprint.id)}>
                      {sprint.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuContent>
            </Menu>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => refetch()}
              loading={isFetching && !isPending}
            >
              Refresh
            </Button>
            {canEdit && (
              <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                Create issue
              </Button>
            )}
          </>
        }
      />

      {archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. The board is read-only.
        </p>
      )}

      {moveError && (
        <p className={styles.errorBar} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>
            Couldn&rsquo;t move that issue: {moveError.message} The card has been put
            back where it was.
          </span>
          <button type="button" className={styles.errorDismiss} onClick={clearError}>
            Dismiss
          </button>
        </p>
      )}

      {/* Drag and menu moves are both announced for screen-reader users. */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      {isError ? (
        <div className={styles.emptyWrap}>
          <ErrorState title="Couldn't load the board" error={error} onRetry={() => refetch()} />
        </div>
      ) : isPending ? (
        <SkeletonBoard />
      ) : total === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            icon={Inbox}
            title={selectedSprint ? `No issues in ${selectedSprint.name}` : "Nothing on the board yet"}
            description={
              selectedSprint
                ? "Assign issues to this sprint from the backlog to see them here."
                : "Issues appear here as soon as they are created, grouped by workflow state."
            }
            action={
              canEdit ? (
                <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                  Create the first issue
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className={styles.board}>
          {BOARD_COLUMNS.map((column) => {
            const meta = statusOf(column.status);
            const issues = board[column.key] ?? [];
            return (
              <section
                key={column.key}
                className={cn(styles.column, overColumn === column.key && styles.columnOver)}
                aria-label={`${meta.label}, ${issues.length} ${issues.length === 1 ? "issue" : "issues"}`}
                onDragOver={(event) => {
                  if (!canEdit) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setOverColumn(column.key);
                }}
                onDragLeave={(event) => {
                  // Ignore bubbling from children leaving.
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOverColumn((current) => (current === column.key ? null : current));
                  }
                }}
                onDrop={(event) => handleDrop(event, column)}
              >
                <div className={styles.columnHead}>
                  <span className={styles.dot} style={{ "--col-color": meta.fg }} aria-hidden="true" />
                  <span className={styles.columnName}>{meta.label}</span>
                  <span className={styles.columnCount}>{issues.length}</span>
                  {canEdit && (
                    <button
                      type="button"
                      className={styles.columnAdd}
                      aria-label={`Create an issue in ${meta.label}`}
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>

                {issues.length === 0 ? (
                  <p className={styles.columnEmpty}>No issues</p>
                ) : (
                  <div className={styles.cards}>
                    {issues.map((issue) => (
                      <BoardCard
                        key={issue.id}
                        pid={pid}
                        issue={issue}
                        assignee={issue.assignee_id ? memberById.get(issue.assignee_id) : null}
                        component={issue.component_id ? componentById.get(issue.component_id) : null}
                        blocked={blockedIssueIds.has(issue.id)}
                        pending={pending.has(issue.id)}
                        canEdit={canEdit}
                        onMove={(issueId, status) => handleMove(issueId, status, issue.key)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!isPending && !isError && total > 0 && (
        <p className={styles.hint}>
          <Columns3 size={12} aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
          Cards are ordered by creation date. The API has no manual ordering, so
          position within a column is not saved.
        </p>
      )}

      <CreateIssueDialog pid={pid} open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
