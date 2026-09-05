import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commentsApi, issuesApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { invalidateMyWork } from "../myWork/useMyWork";

/**
 * Issue queries and mutations.
 *
 * Filters map 1:1 onto the query parameters the backend already accepts on
 * GET /projects/{pid}/issues — status, type, priority, assignee_id, q. They
 * are part of the query key, so each filter combination caches separately and
 * switching back to a previous filter is instant.
 *
 * `sprint_id` and `in_backlog` are both real server-side parameters and are
 * used by the Issues page's sprint filter and the Backlog page.
 */

/** Strip empty values so a cleared filter does not become `?status=`. */
export function cleanFilters(filters = {}) {
  const out = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

/**
 * `enabled` lets a caller hold the request back until it is actually needed —
 * the dependency picker only wants the list once its dialog is open. It
 * defaults to on, so every existing call site is unchanged.
 */
export function useIssueList(pid, filters, { enabled = true } = {}) {
  const clean = cleanFilters(filters);
  return useQuery({
    queryKey: keys.issues(pid, clean),
    queryFn: ({ signal }) => issuesApi.list(pid, clean, { signal }),
    enabled: Boolean(pid) && enabled,
    staleTime: 15_000,
    // Keeps the previous rows on screen while a new filter loads, so the
    // table does not flash empty on every keystroke.
    placeholderData: (previous) => previous,
  });
}

export function useIssue(iid) {
  return useQuery({
    queryKey: keys.issue(iid),
    queryFn: ({ signal }) => issuesApi.get(iid, { signal }),
    enabled: Boolean(iid),
    staleTime: 15_000,
  });
}

export function useIssueActivities(iid) {
  return useQuery({
    queryKey: keys.activities(iid),
    queryFn: ({ signal }) => issuesApi.activities(iid, { signal }),
    enabled: Boolean(iid),
    // The audit trail is the one thing that must never look stale.
    staleTime: 0,
  });
}

export function useComments(iid) {
  return useQuery({
    queryKey: keys.comments(iid),
    queryFn: ({ signal }) => commentsApi.list(iid, { signal }),
    enabled: Boolean(iid),
    staleTime: 0,
  });
}

/**
 * Anything that changes an issue also changes the project's derived views:
 * every filtered issue list, the board projection, and the Overview's counts
 * (which are computed from the unfiltered issue list). Invalidating the
 * project's issue subtree covers all of them in one call.
 */
function invalidateProjectIssueViews(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "issues"] });
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "board"] });
  // issue_counter lives on the project record and moves on every create.
  queryClient.invalidateQueries({ queryKey: keys.project(pid) });
  // Assignee, status and deadline are My Work's primary inputs. Stated
  // explicitly rather than relying on the project key happening to cover it.
  invalidateMyWork(queryClient, pid);
}

export function useCreateIssue(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => issuesApi.create(pid, data),
    onSuccess: (issue) => {
      queryClient.setQueryData(keys.issue(issue.id), issue);
      invalidateProjectIssueViews(queryClient, pid);
    },
  });
}

export function useUpdateIssue(pid, iid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => issuesApi.update(iid, patch),
    onSuccess: (issue) => {
      queryClient.setQueryData(keys.issue(iid), issue);
      // A mutation always writes an activity row in the same transaction.
      queryClient.invalidateQueries({ queryKey: keys.activities(iid) });
      invalidateProjectIssueViews(queryClient, pid);
    },
  });
}

/** Soft delete. The backend restricts this to project admins (403 otherwise). */
export function useDeleteIssue(pid, iid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => issuesApi.remove(iid),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.issue(iid) });
      invalidateProjectIssueViews(queryClient, pid);
    },
  });
}

export function useCreateComment(iid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => commentsApi.create(iid, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.comments(iid) });
      // Commenting also logs an activity server-side.
      queryClient.invalidateQueries({ queryKey: keys.activities(iid) });
    },
  });
}

/** Author-only on the backend; a non-author receives 403. */
export function useUpdateComment(iid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }) => commentsApi.update(commentId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.comments(iid) }),
  });
}

/** Author or project admin on the backend; anyone else receives 403. */
export function useDeleteComment(iid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId) => commentsApi.remove(commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.comments(iid) }),
  });
}
