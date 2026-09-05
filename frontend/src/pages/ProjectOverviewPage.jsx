import {
  Archive,
  ArrowRight,
  Blocks,
  Columns3,
  Inbox,
  ListChecks,
  UserX,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Avatar } from "../components/primitives/Avatar";
import { Badge } from "../components/primitives/Badge";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Skeleton } from "../components/primitives/Skeleton";
import {
  IssueKey,
  PriorityBars,
  StatusChip,
  TypeIcon,
} from "../components/domain/IssueAtoms";
import { useProjectOverview } from "../features/projects/useProjectOverview";
import { useProjectId } from "../hooks/useProjectId";
import { BOARD_COLUMNS, ROLE, statusOf } from "../lib/enums";
import { formatDate, formatRelative } from "../lib/format";
import styles from "./ProjectOverviewPage.module.css";

function Panel({ title, meta, children, footer, flush = false, index = 0 }) {
  return (
    <section className={styles.panel} style={{ "--i": index }}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {meta && <span className={styles.panelMeta}>{meta}</span>}
      </div>
      <div className={flush ? styles.panelBodyFlush : styles.panelBody}>{children}</div>
      {footer && <div className={styles.panelFoot}>{footer}</div>}
    </section>
  );
}

function PanelLink({ to, children }) {
  return (
    <Link to={to} className={styles.panelLink}>
      {children}
      <ArrowRight size={13} aria-hidden="true" />
    </Link>
  );
}

function LoadingLayout() {
  return (
    <div className={styles.body}>
      <div className={styles.col}>
        <div className={styles.skelPanel}>
          <Skeleton width="30%" height={13} />
          <Skeleton width="45%" height={30} />
          <Skeleton width="100%" height={8} radius="999px" />
          <Skeleton width="100%" height={12} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="100%" height={12} />
        </div>
        <div className={styles.skelPanel}>
          <Skeleton width="30%" height={13} />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width="100%" height={16} />
          ))}
        </div>
      </div>
      <div className={styles.col}>
        <div className={styles.skelPanel}>
          <Skeleton width="40%" height={13} />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width="100%" height={12} />
          ))}
        </div>
        <div className={styles.skelPanel}>
          <Skeleton width="30%" height={13} />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} width="100%" height={20} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Project Overview.
 *
 * Composed entirely from data the API already returns — ProjectResponse,
 * members, components and the project's issue list. The workflow figures are
 * counted client-side from that list; there is no aggregate stats endpoint and
 * no project-level activity feed, so neither is implied here. "Recent" means
 * most recently created, which is the order the issues endpoint returns.
 */
export function ProjectOverviewPage() {
  const pid = useProjectId();
  const navigate = useNavigate();
  const {
    project,
    members,
    components,
    memberById,
    stats,
    recent,
    isPending,
    isError,
    error,
    refetch,
  } = useProjectOverview(pid);

  if (isPending) {
    return (
      <>
        <PageHeader eyebrow="Project / Overview" title="Loading project…" />
        <LoadingLayout />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader eyebrow="Project / Overview" title="Overview" />
        <div className={styles.body}>
          <ErrorState
            title="Couldn't load this project"
            error={error}
            onRetry={refetch}
          />
        </div>
      </>
    );
  }

  const data = project.data;
  const memberList = members.data ?? [];
  const componentList = components.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow={`${data.key} / Overview`}
        title={data.name}
        description={data.description || "No description yet."}
        actions={
          <>
            <Button
              variant="secondary"
              icon={ListChecks}
              onClick={() => navigate(`/projects/${pid}/issues`)}
            >
              Issues
            </Button>
            <Button
              variant="primary"
              icon={Columns3}
              onClick={() => navigate(`/projects/${pid}/board`)}
            >
              Open board
            </Button>
          </>
        }
      />

      {data.archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. Existing issues stay readable, but new issues
          and members can&rsquo;t be added.
        </p>
      )}

      <div className={styles.body}>
        {/* ---------------------------------------------------- main column */}
        <div className={styles.col}>
          <Panel
            title="Workflow"
            meta={`${stats.total} ${stats.total === 1 ? "issue" : "issues"}`}
            index={0}
            flush
            footer={<PanelLink to={`/projects/${pid}/board`}>Open the board</PanelLink>}
          >
            <div className={styles.panelBody}>
              <div className={styles.completion}>
                <span className={styles.completionValue}>{stats.completion}%</span>
                <span className={styles.completionLabel}>
                  complete · {stats.open} open, {stats.done} done
                </span>
              </div>

              {stats.total > 0 ? (
                <>
                  <div
                    className={styles.track}
                    role="img"
                    aria-label={BOARD_COLUMNS.map(
                      (c) => `${statusOf(c.status).label}: ${stats.byStatus[c.status]}`,
                    ).join(", ")}
                  >
                    {BOARD_COLUMNS.map((column) => {
                      const count = stats.byStatus[column.status];
                      if (!count) return null;
                      return (
                        <span
                          key={column.status}
                          className={styles.segment}
                          style={{
                            flexGrow: count,
                            "--seg-color": statusOf(column.status).fg,
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className={styles.statusList}>
                    {BOARD_COLUMNS.map((column) => {
                      const meta = statusOf(column.status);
                      const count = stats.byStatus[column.status];
                      const pct = Math.round((count / stats.total) * 100);
                      return (
                        <div className={styles.statusRow} key={column.status}>
                          <span
                            className={styles.dot}
                            style={{ "--seg-color": meta.fg }}
                            aria-hidden="true"
                          />
                          <span className={styles.statusName}>{meta.label}</span>
                          <span className={styles.statusCount}>{count}</span>
                          <span className={styles.statusPct}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <EmptyState
                  compact
                  icon={Inbox}
                  title="No issues yet"
                  description="Once issues are filed they'll be summarised here by workflow state."
                />
              )}
            </div>

            <div className={styles.strip}>
              <div className={styles.stripItem}>
                <span className={styles.stripValue}>{stats.tasks}</span>
                <span className={styles.stripLabel}>Tasks</span>
              </div>
              <div className={styles.stripItem}>
                <span className={styles.stripValue}>{stats.bugs}</span>
                <span className={styles.stripLabel}>Bugs</span>
              </div>
              <div className={styles.stripItem}>
                <span className={styles.stripValue}>{stats.unassigned}</span>
                <span className={styles.stripLabel}>Unassigned</span>
              </div>
            </div>
          </Panel>

          <Panel
            title="Recent issues"
            meta={recent.length ? "Newest first" : null}
            index={1}
            flush
            footer={
              recent.length ? (
                <PanelLink to={`/projects/${pid}/issues`}>View all issues</PanelLink>
              ) : null
            }
          >
            {recent.length === 0 ? (
              <div className={styles.panelBody}>
                <EmptyState
                  compact
                  icon={Inbox}
                  title="Nothing filed yet"
                  description="Issues created in this project will appear here, newest first."
                />
              </div>
            ) : (
              recent.map((issue) => {
                const assignee = issue.assignee_id
                  ? memberById.get(issue.assignee_id)
                  : null;
                return (
                  <div className={styles.issueRow} key={issue.id}>
                    <TypeIcon type={issue.type} />
                    <IssueKey>{issue.key}</IssueKey>
                    <span className={styles.issueTitle}>{issue.title}</span>
                    <StatusChip status={issue.status} />
                    <PriorityBars priority={issue.priority} />
                    {assignee ? (
                      <Avatar name={assignee.name} size="xs" />
                    ) : (
                      <UserX
                        size={16}
                        aria-label="Unassigned"
                        style={{ color: "var(--text-disabled)" }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        {/* ---------------------------------------------------- side column */}
        <div className={styles.col}>
          <Panel title="Project" index={2}>
            <dl className={styles.dl}>
              <div className={styles.dlRow}>
                <dt className={styles.dt}>Key</dt>
                <dd className={`${styles.dd} ${styles.ddMono}`}>{data.key}</dd>
              </div>
              <div className={styles.dlRow}>
                <dt className={styles.dt}>Status</dt>
                <dd className={styles.dd}>
                  <Badge variant={data.archived ? "neutral" : "success"} dot>
                    {data.archived ? "Archived" : "Active"}
                  </Badge>
                </dd>
              </div>
              <div className={styles.dlRow}>
                <dt className={styles.dt}>Created</dt>
                <dd className={styles.dd} title={formatDate(data.created_at)}>
                  {formatRelative(data.created_at)}
                </dd>
              </div>
              <div className={styles.dlRow}>
                <dt className={styles.dt} title="Never decreases — deleted issues are included.">
                  Issues created
                </dt>
                <dd className={`${styles.dd} ${styles.ddMono}`}>{data.issue_counter}</dd>
              </div>
              <div className={styles.dlRow}>
                <dt className={styles.dt}>Next key</dt>
                <dd className={`${styles.dd} ${styles.ddMono}`}>
                  {data.key}-{data.issue_counter + 1}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Team"
            meta={`${memberList.length}`}
            index={3}
            flush
            footer={<PanelLink to={`/projects/${pid}/members`}>Manage members</PanelLink>}
          >
            {memberList.length === 0 ? (
              <div className={styles.panelBody}>
                <EmptyState compact icon={Users} title="No members" />
              </div>
            ) : (
              memberList.slice(0, 6).map((member) => (
                <div className={styles.memberRow} key={member.user_id}>
                  <Avatar name={member.name} size="sm" />
                  <span className={styles.memberText}>
                    <span className={styles.memberName}>{member.name}</span>
                    <span className={styles.memberEmail}>{member.email}</span>
                  </span>
                  <Badge variant={member.role === ROLE.ADMIN.value ? "accent" : "outline"}>
                    {ROLE[member.role]?.label ?? member.role}
                  </Badge>
                </div>
              ))
            )}
          </Panel>

          <Panel
            title="Components"
            meta={`${componentList.length}`}
            index={4}
            footer={
              <PanelLink to={`/projects/${pid}/components`}>Manage components</PanelLink>
            }
          >
            {componentList.length === 0 ? (
              <EmptyState
                compact
                icon={Blocks}
                title="No components"
                description="Components group issues by area, like Payments or Auth."
              />
            ) : (
              <div className={styles.chips}>
                {componentList.map((component) => {
                  const owner = component.default_assignee_id
                    ? memberById.get(component.default_assignee_id)
                    : null;
                  return (
                    <span className={styles.chip} key={component.id}>
                      <span className={styles.chipName}>{component.name}</span>
                      {owner && <Avatar name={owner.name} size="xs" />}
                    </span>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
