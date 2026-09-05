import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dependenciesApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { invalidateMyWork } from "../myWork/useMyWork";
import { STATUS } from "../../lib/enums";

/**
 * Issue dependencies.
 *
 * Two shapes, for two jobs: one issue's own links for the detail panel, and
 * every edge in the project for the board's blocked indicator. The second is
 * why the board needs exactly one extra request rather than one per card.
 */

export function useIssueDependencies(iid) {
  return useQuery({
    queryKey: keys.dependencies(iid),
    queryFn: ({ signal }) => dependenciesApi.list(iid, { signal }),
    enabled: Boolean(iid),
    staleTime: 15_000,
  });
}

export function useProjectDependencies(pid) {
  return useQuery({
    queryKey: keys.projectDependencies(pid),
    queryFn: ({ signal }) => dependenciesApi.listForProject(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 15_000,
  });
}

/**
 * The ids of issues with at least one blocker that is not yet done.
 *
 * "Unresolved" is the blocker's own status, which the edge already carries —
 * so a card stops being marked as soon as the thing blocking it is closed,
 * without the board loading anything else. A Set keeps the board's lookup O(1)
 * per card.
 */
export function useBlockedIssueIds(pid) {
  const { data: edges } = useProjectDependencies(pid);
  return useMemo(() => {
    const blocked = new Set();
    for (const edge of edges ?? []) {
      if (edge.blocking_status !== STATUS.DONE.value) {
        blocked.add(edge.blocked_issue_id);
      }
    }
    return blocked;
  }, [edges]);
}

/**
 * A link touches three caches: this issue's panel, the other issue's panel
 * (it gained the mirror-image entry), and the project feed the board reads.
 * Each is named exactly — no broad sweep of the project's issue subtree, since
 * the issues themselves are untouched by a dependency.
 */
function invalidateDependencies(queryClient, pid, iid, otherIssueId) {
  queryClient.invalidateQueries({ queryKey: keys.dependencies(iid) });
  if (otherIssueId != null) {
    queryClient.invalidateQueries({ queryKey: keys.dependencies(otherIssueId) });
  }
  queryClient.invalidateQueries({ queryKey: keys.projectDependencies(pid) });
  // My Work reports whether an assigned issue is blocked, which is exactly
  // what just changed.
  invalidateMyWork(queryClient, pid);
}

/**
 * `direction` is "BLOCKS" or "BLOCKED_BY", relative to `iid`. The backend
 * rejects a self-link, a cross-project link, a duplicate, and one that would
 * close a cycle — the panel surfaces those messages rather than pre-guessing
 * them.
 */
export function useAddDependency(pid, iid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, direction }) =>
      dependenciesApi.create(iid, { issueId, direction }),
    onSuccess: (_link, variables) =>
      invalidateDependencies(queryClient, pid, iid, variables.issueId),
  });
}

export function useRemoveDependency(pid, iid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dependencyId }) => dependenciesApi.remove(dependencyId),
    onSuccess: (_data, variables) =>
      invalidateDependencies(queryClient, pid, iid, variables.otherIssueId),
  });
}
