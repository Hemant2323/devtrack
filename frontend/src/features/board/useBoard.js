import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { boardApi, issuesApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { invalidateMyWork } from "../myWork/useMyWork";
import { moveInBoard } from "./moveInBoard";

/**
 * Board data.
 *
 * GET /projects/{pid}/board returns the project's live issues already grouped:
 * { todo, in_progress, testing, done } — the same IssueResponse objects the
 * issue list returns. No client-side grouping is needed.
 *
 * `sprint_id` filters the board to one sprint. Sprint 5 added the endpoints
 * that make the sprint list selectable; passing null keeps the whole project.
 */
export function useBoard(pid, sprintId = null) {
  return useQuery({
    queryKey: keys.board(pid, sprintId),
    queryFn: ({ signal }) => boardApi.get(pid, sprintId, { signal }),
    enabled: Boolean(pid),
    staleTime: 15_000,
  });
}

/**
 * Status change from the board.
 *
 * Uses the existing PATCH /issues/{id} — there is no board-specific move
 * endpoint and none was invented. The update is optimistic: the card jumps
 * columns immediately, and the previous board is restored verbatim if the
 * request fails (a 403 on an archived project, for example).
 *
 * `pending` exposes the ids currently in flight so a card cannot be dragged
 * into a second, racing mutation before the first resolves.
 */
export function useMoveIssue(pid, sprintId = null) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(() => new Set());
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: ({ issueId, status }) => issuesApi.update(issueId, { status }),

    onMutate: async ({ issueId, status }) => {
      setError(null);
      setPending((prev) => new Set(prev).add(issueId));

      // Stop an in-flight refetch from overwriting the optimistic board.
      await queryClient.cancelQueries({ queryKey: keys.board(pid, sprintId) });
      const previousBoard = queryClient.getQueryData(keys.board(pid, sprintId));

      queryClient.setQueryData(keys.board(pid, sprintId), (board) =>
        moveInBoard(board, issueId, status),
      );

      return { previousBoard };
    },

    onError: (mutationError, _variables, context) => {
      // Restore exactly what was there before — never leave a stale card.
      if (context?.previousBoard !== undefined) {
        queryClient.setQueryData(keys.board(pid, sprintId), context.previousBoard);
      }
      setError(mutationError);
    },

    onSuccess: (issue) => {
      // The server response is authoritative for the detail cache.
      queryClient.setQueryData(keys.issue(issue.id), issue);
      // A status change always writes an activity row in the same transaction.
      queryClient.invalidateQueries({ queryKey: keys.activities(issue.id) });
    },

    onSettled: (_data, _err, variables) => {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(variables.issueId);
        return next;
      });
      // Board, every filtered issue list, and the Overview counts all derive
      // from the same issues; refresh the project's issue subtree.
      // Prefix, not the exact key: every sprint-filtered board variant is
      // stale after a status change, not just the one on screen.
      queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "board"] });
      queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "issues"] });
      // A status change from the board reorders My Work too.
      invalidateMyWork(queryClient, pid);
    },
  });

  const move = useCallback(
    (issueId, status) => {
      if (pending.has(issueId)) return;
      mutation.mutate({ issueId, status });
    },
    [mutation, pending],
  );

  return { move, pending, error, clearError: () => setError(null) };
}
