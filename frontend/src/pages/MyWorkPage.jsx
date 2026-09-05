import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Rocket,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/primitives/Badge";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { SegmentedControl } from "../components/primitives/SegmentedControl";
import { Skeleton } from "../components/primitives/Skeleton";
import {
  IssueKey,
  PriorityBars,
  StatusChip,
  TypeIcon,
} from "../components/domain/IssueAtoms";
import { formatWhen } from "../features/meetings/schedule";
import { useMyWork } from "../features/myWork/useMyWork";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { testResultOf } from "../lib/enums";
import { formatDate } from "../lib/format";
import styles from "./MyWorkPage.module.css";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "ISSUE", label: "Issues" },
  { value: "TEST_CASE", label: "Test cases" },
];

/** Where a work item's source lives. Test cases have their own detail page. */
function sourcePath(pid, item) {
  return item.type === "ISSUE"
    ? `/projects/${pid}/issues/${item.source_id}`
    : `/projects/${pid}/test-cases/${item.source_id}`;
}

function WorkRow({ pid, item }) {
  const isIssue = item.type === "ISSUE";
  const result = item.last_result ? testResultOf(item.last_result) : null;

  return (
    <li>
      <Link to={sourcePath(pid, item)} className={styles.row}>
        <span className={styles.rowIcon}>
          {isIssue ? (
            <TypeIcon type={item.issue_type} />
          ) : (
            <ClipboardCheck size={13} aria-hidden="true" />
          )}
        </span>

        <span className={styles.rowMain}>
          <span className={styles.rowTop}>
            {item.reference && <IssueKey>{item.reference}</IssueKey>}
            <span className={styles.title}>{item.title}</span>
          </span>

          <span className={styles.meta}>
            {/* Overdue and blocked lead, because they are why this row is
                near the top. Both say so in words, not colour alone. */}
            {item.overdue && (
              <span className={cn(styles.flag, styles.flagOverdue)}>
                <AlertTriangle size={11} aria-hidden="true" />
                Overdue
              </span>
            )}
            {item.blocked && (
              <span className={cn(styles.flag, styles.flagBlocked)}>
                <Ban size={11} aria-hidden="true" />
                Blocked by {item.blocked_by.map((b) => b.key).join(", ")}
              </span>
            )}
            {item.due_date && (
              <span className={styles.due}>Due {formatDate(item.due_date)}</span>
            )}
            {item.sprint_name && (
              <span className={styles.tag}>
                <Rocket size={11} aria-hidden="true" />
                {item.sprint_name}
              </span>
            )}
            {result && (
              <span className={styles.tag} style={{ color: result.fg }}>
                Last run: {result.label}
              </span>
            )}
            {!isIssue && !result && <span className={styles.tag}>Never run</span>}
          </span>
        </span>

        <span className={styles.rowEnd}>
          {isIssue && <PriorityBars priority={item.priority} />}
          {isIssue ? (
            <StatusChip status={item.status} />
          ) : (
            <Badge variant="neutral">Test case</Badge>
          )}
        </span>
      </Link>
    </li>
  );
}

function Section({ title, count, hint, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        {count > 0 && <span className={styles.count}>{count}</span>}
      </h2>
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </section>
  );
}

/**
 * My Work.
 *
 * One question, answered in one request: what in this project is waiting on
 * me? Everything shown is read from its own record server-side — nothing is
 * copied, nothing is editable here, and every row links to the page that owns
 * it.
 *
 * Rows arrive already ordered actionable-first (overdue, blocked, in progress,
 * other active, done), so the page renders the server's order rather than
 * re-deciding it.
 */
export function MyWorkPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const [filter, setFilter] = useState("ALL");

  const { data, isPending, isError, error, refetch } = useMyWork(pid);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const items = useMemo(
    () => (data?.items ?? []).filter((item) => filter === "ALL" || item.type === filter),
    [data, filter],
  );

  // The server's order already puts these first; splitting them out only
  // separates "needs a decision" from "in flight".
  const attention = items.filter((item) => item.overdue || item.blocked);
  const active = items.filter(
    (item) => !item.overdue && !item.blocked && item.status !== "DONE",
  );
  const done = items.filter(
    (item) => !item.overdue && !item.blocked && item.status === "DONE",
  );

  const sprint = data?.sprint;
  const meetings = data?.upcoming_meetings ?? [];
  const nothing = !isPending && !isError && (data?.items ?? []).length === 0;

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / My work`}
        title="My work"
        description={`What this project is waiting on from ${user?.name ?? "you"} — assigned issues, your test cases, and the sprint around them.`}
      />

      <div className={styles.body}>
        {isError && (
          <ErrorState
            title="Couldn't load your work"
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {isPending && (
          <div className={styles.list}>
            {Array.from({ length: 4 }, (_, i) => (
              <div className={styles.skelRow} key={i}>
                <Skeleton width={`${30 + ((i * 13) % 30)}%`} height={14} />
                <Skeleton width="45%" height={11} />
              </div>
            ))}
          </div>
        )}

        {!isPending && !isError && (
          <>
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              options={FILTERS}
              label="Filter work items"
              className={styles.filters}
            />

            {nothing ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing assigned to you"
                description="When an issue is assigned to you, or you write a test case, it shows up here."
              />
            ) : (
              <div className={styles.columns}>
                <div className={styles.main}>
                  <Section
                    title="Needs attention"
                    count={attention.length}
                    hint={
                      attention.length
                        ? "Past its date, or waiting on something else."
                        : undefined
                    }
                  >
                    {attention.length === 0 ? (
                      <p className={styles.sectionEmpty}>
                        Nothing overdue or blocked.
                      </p>
                    ) : (
                      <ul className={styles.list}>
                        {attention.map((item) => (
                          <WorkRow key={item.id} pid={pid} item={item} />
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title="Active" count={active.length}>
                    {active.length === 0 ? (
                      <p className={styles.sectionEmpty}>No active work.</p>
                    ) : (
                      <ul className={styles.list}>
                        {active.map((item) => (
                          <WorkRow key={item.id} pid={pid} item={item} />
                        ))}
                      </ul>
                    )}
                  </Section>

                  {done.length > 0 && (
                    <Section title="Done" count={done.length}>
                      <ul className={cn(styles.list, styles.listMuted)}>
                        {done.map((item) => (
                          <WorkRow key={item.id} pid={pid} item={item} />
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>

                <aside className={styles.side}>
                  <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Current sprint</h2>
                    {sprint ? (
                      <div className={styles.sprint}>
                        <Link to={`/projects/${pid}/sprints`} className={styles.sprintName}>
                          <Rocket size={13} aria-hidden="true" />
                          {sprint.name}
                        </Link>
                        {(sprint.start_date || sprint.end_date) && (
                          <span className={styles.sprintDates}>
                            {sprint.start_date ? formatDate(sprint.start_date) : "—"} →{" "}
                            {sprint.end_date ? formatDate(sprint.end_date) : "—"}
                          </span>
                        )}
                        <span className={styles.sprintCount}>
                          {sprint.assigned_done} of {sprint.assigned_count} of your issues
                          done
                        </span>
                      </div>
                    ) : (
                      <p className={styles.panelEmpty}>
                        No sprint is running. Start one on the Sprints page.
                      </p>
                    )}
                  </section>

                  <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Upcoming meetings</h2>
                    {meetings.length === 0 ? (
                      <p className={styles.panelEmpty}>Nothing scheduled for you.</p>
                    ) : (
                      <ul className={styles.meetings}>
                        {meetings.map((meeting) => (
                          <li key={meeting.id}>
                            <Link
                              to={`/projects/${pid}/meetings/${meeting.id}`}
                              className={styles.meeting}
                            >
                              <Video size={12} aria-hidden="true" />
                              <span className={styles.meetingTitle}>{meeting.title}</span>
                              <span className={styles.meetingWhen}>
                                {formatWhen(meeting.scheduled_at, meeting.duration_minutes)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
