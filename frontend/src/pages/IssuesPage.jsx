import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Inbox, Plus, Search, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Avatar } from "../components/primitives/Avatar";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Input } from "../components/primitives/Input";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
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
import { useSprints } from "../features/sprints/useSprints";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { ISSUE_TYPE, PRIORITY, STATUS } from "../lib/enums";
import { formatRelative } from "../lib/format";
import { useProjectOverview } from "../features/projects/useProjectOverview";
import styles from "./IssuesPage.module.css";

/* Every filter here is a query parameter the backend already accepts on
   GET /projects/{pid}/issues, so filtering is server-side. `q` matches title
   or description (ILIKE). No client-side filtering is needed. */
const FILTERS = [
  {
    param: "status",
    label: "Status",
    options: Object.values(STATUS).map((s) => ({ value: s.value, label: s.label })),
  },
  {
    param: "type",
    label: "Type",
    options: Object.values(ISSUE_TYPE).map((t) => ({ value: t.value, label: t.label })),
  },
  {
    param: "priority",
    label: "Priority",
    options: Object.values(PRIORITY).map((p) => ({ value: p.value, label: p.label })),
  },
];

function SkeletonRows() {
  return Array.from({ length: 8 }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={14} height={14} radius="3px" />
      <Skeleton width={54} height={11} />
      <Skeleton width={`${45 + ((i * 7) % 35)}%`} height={13} />
      <Skeleton width={64} height={19} radius="3px" />
      <Skeleton width={12} height={10} />
      <Skeleton width={20} height={20} radius="999px" />
      <span />
    </div>
  ));
}

/**
 * Project issues.
 *
 * Filters live in the URL so Back/Forward moves between filtered views and a
 * filtered list can be shared. The search params are the single source of
 * truth — there is no mirrored component state to drift out of sync.
 */
export function IssuesPage() {
  const pid = useProjectId();
  const [params, setParams] = useSearchParams();
  const { memberById, componentById } = useProjectDirectory(pid);
  const [createOpen, setCreateOpen] = useState(false);

  const filters = useMemo(
    () => ({
      q: params.get("q") ?? "",
      status: params.get("status") ?? "",
      type: params.get("type") ?? "",
      priority: params.get("priority") ?? "",
      // Both are real server-side parameters on GET /projects/{pid}/issues.
      sprint_id: params.get("sprint_id") ?? "",
      in_backlog: params.get("in_backlog") ?? "",
    }),
    [params],
  );

  const activeCount = Object.values(filters).filter(Boolean).length;

  /* Always build a fresh URLSearchParams — the instance the hook returns is
     shared for this render and must not be mutated. Filter changes replace
     rather than push, so tweaking a filter five times does not cost five
     Back presses to escape. */
  const setFilter = useCallback(
    (param, value) => {
      const next = new URLSearchParams(params);
      if (value) next.set(param, value);
      else next.delete(param);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const clearFilters = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  const { data: sprints } = useSprints(pid);

  const { data: issues, isPending, isError, error, refetch, isPlaceholderData } =
    useIssueList(pid, filters);

  /* One control, two API parameters: "Backlog" sends ?in_backlog=true and a
     named sprint sends ?sprint_id=N. They are mutually exclusive, so selecting
     one always clears the other. */
  const sprintValue = filters.in_backlog === "true" ? "backlog" : filters.sprint_id;
  const sprintLabel =
    sprintValue === "backlog"
      ? "Backlog"
      : (sprints ?? []).find((s) => String(s.id) === sprintValue)?.name;

  function setSprintFilter(value) {
    const next = new URLSearchParams(params);
    next.delete("sprint_id");
    next.delete("in_backlog");
    if (value === "backlog") next.set("in_backlog", "true");
    else if (value) next.set("sprint_id", value);
    setParams(next, { replace: true });
  }

  // The Overview already loads the unfiltered list; reuse its total so the
  // "n of m" reading stays honest while a filter is applied.
  const { stats } = useProjectOverview(pid);

  const hasFilters = activeCount > 0;

  return (
    <>
      <PageHeader
        eyebrow="Project / Issues"
        title="Issues"
        description="Every task and bug in this project, newest first."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            Create issue
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            icon={Search}
            type="search"
            placeholder="Search title and description…"
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
            aria-label="Search issues"
          />
        </div>

        {FILTERS.map((filter) => {
          const value = filters[filter.param];
          const selected = filter.options.find((option) => option.value === value);
          return (
            <Menu key={filter.param}>
              <MenuTrigger className={cn(styles.filter, value && styles.filterActive)}>
                {selected ? `${filter.label}: ${selected.label}` : filter.label}
                <ChevronDown size={13} aria-hidden="true" />
              </MenuTrigger>
              <MenuContent align="start">
                <MenuLabel>{filter.label}</MenuLabel>
                <MenuRadioGroup
                  value={value}
                  onValueChange={(next) => setFilter(filter.param, next)}
                >
                  <MenuRadioItem value="">Any</MenuRadioItem>
                  {filter.options.map((option) => (
                    <MenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuContent>
            </Menu>
          );
        })}

        <Menu>
          <MenuTrigger className={cn(styles.filter, sprintValue && styles.filterActive)}>
            {sprintLabel ? `Sprint: ${sprintLabel}` : "Sprint"}
            <ChevronDown size={13} aria-hidden="true" />
          </MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>Sprint</MenuLabel>
            <MenuRadioGroup value={sprintValue} onValueChange={setSprintFilter}>
              <MenuRadioItem value="">Any</MenuRadioItem>
              <MenuRadioItem value="backlog">Backlog (no sprint)</MenuRadioItem>
              {(sprints ?? []).map((sprint) => (
                <MenuRadioItem key={sprint.id} value={String(sprint.id)}>
                  {sprint.name}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>

        {hasFilters && (
          <button type="button" className={styles.clear} onClick={clearFilters}>
            Clear
          </button>
        )}

        <span className={styles.spacer} />

        {!isPending && !isError && (
          <span className={styles.count}>
            {hasFilters
              ? `${issues?.length ?? 0} of ${stats.total}`
              : `${issues?.length ?? 0} ${issues?.length === 1 ? "issue" : "issues"}`}
          </span>
        )}
      </div>

      <div className={styles.body}>
        {isError ? (
          <ErrorState
            title="Couldn't load issues"
            error={error}
            onRetry={() => refetch()}
          />
        ) : (
          <div className={styles.panel}>
            {!isPending && issues?.length > 0 && (
              <div className={styles.head}>
                <span />
                <span>Key</span>
                <span>Summary</span>
                <span>Status</span>
                <span>Pri</span>
                <span className={styles.updated}>Updated</span>
                <span />
              </div>
            )}

            {isPending && <SkeletonRows />}

            {!isPending && issues?.length === 0 && (
              hasFilters ? (
                <EmptyState
                  icon={SearchX}
                  title="No issues match these filters"
                  description="Try a different status, type or priority — or clear the filters to see everything."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="No issues yet"
                  description="Tasks and bugs filed in this project will appear here, newest first."
                  action={
                    <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                      Create the first issue
                    </Button>
                  }
                />
              )
            )}

            {!isPending && issues?.length > 0 && (
              <div className={cn(isPlaceholderData && styles.refreshing)}>
                {issues.map((issue) => {
                  const assignee = issue.assignee_id
                    ? memberById.get(issue.assignee_id)
                    : null;
                  const component = issue.component_id
                    ? componentById.get(issue.component_id)
                    : null;
                  return (
                    <Link
                      key={issue.id}
                      to={`/projects/${pid}/issues/${issue.id}`}
                      className={styles.row}
                    >
                      <span className={styles.typeCell}>
                        <TypeIcon type={issue.type} />
                      </span>
                      <span className={styles.keyCell}>
                        <IssueKey>{issue.key}</IssueKey>
                      </span>
                      <span className={styles.titleCell}>
                        <span className={styles.title}>{issue.title}</span>
                        {(component || issue.severity) && (
                          <span className={styles.sub}>
                            {issue.severity && <SeverityChip severity={issue.severity} />}
                            {component && (
                              <span className={styles.subItem}>{component.name}</span>
                            )}
                          </span>
                        )}
                      </span>
                      <span className={styles.statusCell}>
                        <StatusChip status={issue.status} />
                      </span>
                      <span className={styles.priorityCell}>
                        <PriorityBars priority={issue.priority} />
                      </span>
                      <span className={styles.updated}>
                        {formatRelative(issue.updated_at)}
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
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <CreateIssueDialog pid={pid} open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
