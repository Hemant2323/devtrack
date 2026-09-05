import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { PAGE_SIZE, useLoadEarlierWindow } from "./useChat";

/**
 * Direct messages.
 *
 * Same transport as team chat — 10s polling over a bounded window, for the
 * same reason (see useChat) — but on separate cache keys, so a team-chat
 * refetch never touches a private thread and vice versa.
 */

/**
 * Every other member of the project, conversations first, each carrying the
 * last message of the caller's own thread with them.
 *
 * Polled alongside the open thread so the rail's previews and ordering keep up
 * with incoming messages. The server scopes this to the caller, so it can only
 * ever describe conversations they are part of.
 */
export function useDmPartners(pid) {
  return useQuery({
    queryKey: keys.dmPartners(pid),
    queryFn: ({ signal }) => chatApi.listDmPartners(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
}

/** One 1-to-1 thread. The caller is always one of the two participants. */
export function useDmMessages(pid, userId) {
  return useQuery({
    queryKey: keys.dm(pid, userId),
    queryFn: ({ signal }) => chatApi.listDm(pid, userId, { limit: PAGE_SIZE }, { signal }),
    enabled: Boolean(pid) && Boolean(userId),
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useLoadEarlierDm(pid, userId) {
  return useLoadEarlierWindow(keys.dm(pid, userId), (beforeId) =>
    chatApi.listDm(pid, userId, { limit: PAGE_SIZE, beforeId }),
  );
}

/**
 * A write changes two things: the thread itself, and the preview and ordering
 * of that thread in the rail — so both are invalidated, and nothing else.
 *
 * The three key families (team chat, partner list, thread) are deliberately
 * disjoint rather than nested, so neither invalidation can reach team chat or
 * another pair's conversation. `exact` keeps the partner list refetching on
 * its own even if keys are ever added beneath it.
 */
function invalidateDm(queryClient, pid, userId) {
  queryClient.invalidateQueries({ queryKey: keys.dm(pid, userId) });
  queryClient.invalidateQueries({ queryKey: keys.dmPartners(pid), exact: true });
}

export function useSendDm(pid, userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => chatApi.sendDm(pid, userId, body),
    onSuccess: () => invalidateDm(queryClient, pid, userId),
  });
}

/** Author-only on the backend; the recipient receives 403. */
export function useEditDm(pid, userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }) => chatApi.edit(messageId, body),
    onSuccess: () => invalidateDm(queryClient, pid, userId),
  });
}

/**
 * Author-only — deliberately narrower than team chat, where a project admin
 * may also delete. An admin cannot read a DM, so they cannot moderate one.
 */
export function useDeleteDm(pid, userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId) => chatApi.remove(messageId),
    onSuccess: () => invalidateDm(queryClient, pid, userId),
  });
}
