import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";

/** One poll's window, and how many older messages "Load earlier" fetches. */
export const PAGE_SIZE = 50;

/**
 * Project chat.
 *
 * Near-realtime by polling, not sockets: the backend is deliberately stateless
 * (NFR-9) and auth is bearer-token over HTTP, so a socket would need new
 * infrastructure and a second data path alongside TanStack Query. A 10s
 * interval over a bounded window is the honest fit for this architecture.
 *
 * TanStack Query pauses background refetches while the tab is hidden, so an
 * idle tab costs nothing — no extra visibility handling is needed here.
 */
export function useChatMessages(pid) {
  return useQuery({
    queryKey: keys.chat(pid),
    queryFn: ({ signal }) => chatApi.list(pid, { limit: PAGE_SIZE }, { signal }),
    enabled: Boolean(pid),
    // A conversation must never look stale.
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Older history, prepended into the same cache entry.
 *
 * The server window is anchored to the newest messages, so older pages are
 * fetched separately and merged in rather than by growing the poll's limit —
 * that keeps each poll bounded no matter how far back someone has scrolled.
 *
 * Merging is by id, so a message already held is never duplicated, and the
 * result is re-sorted to preserve chronological display order.
 */
export function useLoadEarlier(pid) {
  return useLoadEarlierWindow(keys.chat(pid), (beforeId) =>
    chatApi.list(pid, { limit: PAGE_SIZE, beforeId }),
  );
}

/**
 * The mechanism behind "Load earlier", shared by team chat and DM threads
 * because both windows are anchored the same way. `fetchOlder` receives the
 * id to page back from and is responsible for staying inside its own
 * conversation.
 */
export function useLoadEarlierWindow(queryKey, fetchOlder) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [reachedStart, setReachedStart] = useState(false);
  const [error, setError] = useState(null);

  // A serialised key keeps the callback stable while still resetting the
  // "reached the start" flag when the caller switches conversation. The
  // fetcher is held in a ref for the same reason: callers pass an inline
  // closure, and re-creating loadEarlier on every render would serve nothing.
  const keyId = JSON.stringify(queryKey);
  const fetcher = useRef(fetchOlder);
  fetcher.current = fetchOlder;

  useEffect(() => {
    setReachedStart(false);
    setError(null);
  }, [keyId]);

  const loadEarlier = useCallback(async () => {
    const key = JSON.parse(keyId);
    const current = queryClient.getQueryData(key) ?? [];
    if (!current.length) return;

    setIsLoading(true);
    setError(null);
    try {
      const older = await fetcher.current(current[0].id);

      if (older.length === 0) {
        setReachedStart(true);
        return;
      }
      if (older.length < PAGE_SIZE) setReachedStart(true);

      queryClient.setQueryData(key, (existing) => {
        const byId = new Map();
        for (const message of [...older, ...(existing ?? [])]) {
          byId.set(message.id, message);
        }
        return [...byId.values()].sort((a, b) => a.id - b.id);
      });
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [keyId, queryClient]);

  return { loadEarlier, isLoading, reachedStart, error };
}

/**
 * A poll replaces the cache with the newest window, which would drop any older
 * history the user has loaded. Re-merging on every mutation would fight the
 * poll; instead the page refetches and older pages are simply re-loadable.
 * Invalidating is enough because the server is the source of truth.
 */
function invalidateChat(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: keys.chat(pid) });
}

export function useSendMessage(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => chatApi.send(pid, body),
    onSuccess: () => invalidateChat(queryClient, pid),
  });
}

/** Author-only on the backend; anyone else receives 403. */
export function useEditMessage(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }) => chatApi.edit(messageId, body),
    onSuccess: () => invalidateChat(queryClient, pid),
  });
}

/** Author or project admin on the backend; anyone else receives 403. */
export function useDeleteMessage(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId) => chatApi.remove(messageId),
    onSuccess: () => invalidateChat(queryClient, pid),
  });
}
