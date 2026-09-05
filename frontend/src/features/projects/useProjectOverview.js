import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  componentsApi,
  issuesApi,
  membersApi,
  projectsApi,
} from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { BOARD_COLUMNS, ISSUE_TYPE, SEVERITY } from "../../lib/enums";

/**
 * Everything the Overview page needs, from four real endpoints:
 *
 *   GET /projects/{pid}            ProjectResponse
 *   GET /projects/{pid}/members    MemberResponse[]  — also the user directory
 *   GET /projects/{pid}/components ComponentResponse[]
 *   GET /projects/{pid}/issues     IssueResponse[]   — all live issues,
 *                                                     ordered created_at DESC
 *
 * Every figure on the page is derived from those payloads. Nothing is
 * fabricated: the backend has no project-level activity feed (activities are
 * per-issue only) and no aggregate stats endpoint, so neither is shown.
 */
export function useProjectOverview(pid) {
  const project = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const members = useQuery({
    queryKey: keys.members(pid),
    queryFn: ({ signal }) => membersApi.list(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 5 * 60_000,
  });

  const components = useQuery({
    queryKey: keys.components(pid),
    queryFn: ({ signal }) => componentsApi.list(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 5 * 60_000,
  });

  const issues = useQuery({
    queryKey: keys.issues(pid),
    queryFn: ({ signal }) => issuesApi.list(pid, undefined, { signal }),
    enabled: Boolean(pid),
    staleTime: 30_000,
  });

  /** id -> member, so assignee_id can be rendered as a person. */
  const memberById = useMemo(() => {
    const map = new Map();
    (members.data ?? []).forEach((member) => map.set(member.user_id, member));
    return map;
  }, [members.data]);

  const componentById = useMemo(() => {
    const map = new Map();
    (components.data ?? []).forEach((component) => map.set(component.id, component));
    return map;
  }, [components.data]);

  const stats = useMemo(() => {
    const list = issues.data ?? [];
    const total = list.length;

    const byStatus = Object.fromEntries(
      BOARD_COLUMNS.map((column) => [column.status, 0]),
    );
    const bySeverity = Object.fromEntries(Object.keys(SEVERITY).map((k) => [k, 0]));
    let tasks = 0;
    let bugs = 0;
    let unassigned = 0;

    for (const issue of list) {
      if (byStatus[issue.status] !== undefined) byStatus[issue.status] += 1;
      if (issue.type === ISSUE_TYPE.BUG.value) {
        bugs += 1;
        if (issue.severity && bySeverity[issue.severity] !== undefined) {
          bySeverity[issue.severity] += 1;
        }
      } else {
        tasks += 1;
      }
      if (issue.assignee_id == null) unassigned += 1;
    }

    const done = byStatus.DONE ?? 0;
    const open = total - done;
    // Guard the empty project: 0/0 must read as 0%, not NaN.
    const completion = total === 0 ? 0 : Math.round((done / total) * 100);

    return { total, open, done, completion, byStatus, tasks, bugs, bySeverity, unassigned };
  }, [issues.data]);

  // The list already arrives newest-first from the API, so no client sort.
  const recent = useMemo(() => (issues.data ?? []).slice(0, 6), [issues.data]);

  return {
    project,
    members,
    components,
    issues,
    memberById,
    componentById,
    stats,
    recent,
    isPending: project.isPending || issues.isPending,
    isError: project.isError || issues.isError,
    error: project.error ?? issues.error,
    refetch: () => {
      project.refetch();
      members.refetch();
      components.refetch();
      issues.refetch();
    },
  };
}
