import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { issuesApi, sprintsApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { SPRINT_STATE } from "../../lib/enums";

/**
 * Sprint queries and mutations, on the Prompt 1 API.
 *
 * Every lifecycle change also changes what the issue views show — completing a
 * sprint returns unfinished issues to the backlog — so the mutations
 * invalidate the project's issue subtree as well as the sprint list.
 */
export function useSprints(pid) {
  return useQuery({
    queryKey: keys.sprints(pid),
    queryFn: ({ signal }) => sprintsApi.list(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });
}

/** Sprints an issue may actually be moved into — the backend rejects COMPLETED. */
export function assignableSprints(sprints) {
  return (sprints ?? []).filter(
    (sprint) => sprint.state !== SPRINT_STATE.COMPLETED.value,
  );
}

export function activeSprint(sprints) {
  return (sprints ?? []).find((sprint) => sprint.state === SPRINT_STATE.ACTIVE.value);
}

/**
 * Board, every filtered issue list and the Overview counts all derive from the
 * same issues. Invalidating the project's issue subtree covers them in one go,
 * and the board prefix covers every sprint-filtered board variant.
 */
function invalidateIssueViews(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "issues"] });
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "board"] });
  queryClient.invalidateQueries({ queryKey: keys.project(pid) });
}

export function useCreateSprint(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => sprintsApi.create(pid, data),
    onSuccess: (sprint) => {
      queryClient.setQueryData(keys.sprint(sprint.id), sprint);
      queryClient.invalidateQueries({ queryKey: keys.sprints(pid) });
    },
  });
}

export function useStartSprint(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sid) => sprintsApi.start(sid),
    onSuccess: (sprint) => {
      queryClient.setQueryData(keys.sprint(sprint.id), sprint);
      queryClient.invalidateQueries({ queryKey: keys.sprints(pid) });
    },
  });
}

/**
 * Completing a sprint moves unfinished issues back to the backlog server-side,
 * so issue lists, boards and the detail pages of the returned issues are all
 * stale afterwards. The report the backend returns is the mutation result —
 * it is not persisted anywhere, so the caller must display it immediately.
 */
export function useCompleteSprint(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sid) => sprintsApi.complete(sid),
    onSuccess: (report) => {
      queryClient.setQueryData(keys.sprint(report.sprint.id), report.sprint);
      queryClient.invalidateQueries({ queryKey: keys.sprints(pid) });
      invalidateIssueViews(queryClient, pid);
      // Each returned issue changed sprint_id and gained an activity row.
      for (const issueId of report.returned_issue_ids) {
        queryClient.invalidateQueries({ queryKey: keys.issue(issueId) });
        queryClient.invalidateQueries({ queryKey: keys.activities(issueId) });
      }
    },
  });
}

/**
 * Move an issue between the backlog and a sprint.
 *
 * Uses the existing PATCH /issues/{id} with `sprint_id` — there is no bulk or
 * board-style move endpoint, and none was invented. `null` returns the issue
 * to the backlog.
 */
export function useAssignIssueToSprint(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, sprintId }) =>
      issuesApi.update(issueId, { sprint_id: sprintId }),
    onSuccess: (issue) => {
      queryClient.setQueryData(keys.issue(issue.id), issue);
      queryClient.invalidateQueries({ queryKey: keys.activities(issue.id) });
      invalidateIssueViews(queryClient, pid);
      queryClient.invalidateQueries({ queryKey: keys.sprints(pid) });
    },
  });
}
