import { useQuery, useQueryClient } from "@tanstack/react-query";
import { myWorkApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { useAuth } from "../../auth/AuthContext";

/**
 * My Work.
 *
 * One request for the whole page. The server aggregates issues, test cases,
 * the active sprint, upcoming meetings and blocker state, so the page never
 * fans out into a request per item — and never a dependency lookup per issue.
 *
 * A short stale time rather than polling: this is a work list someone checks,
 * not a conversation. It refetches on focus, which is when a person comes back
 * to it after doing something elsewhere.
 */
export function useMyWork(pid) {
  const { user } = useAuth();
  return useQuery({
    // The user id scopes the cache only; it is never sent.
    queryKey: keys.myWork(pid, user?.id),
    queryFn: ({ signal }) => myWorkApi.get(pid, { signal }),
    enabled: Boolean(pid) && Boolean(user?.id),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Refresh My Work after something it summarises has changed.
 *
 * Exported so the mutations that own those sources can call it without
 * importing the page. The prefix stops at this project's My Work — no other
 * cache is touched, and nothing here invalidates the project subtree.
 */
export function invalidateMyWork(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "my-work"] });
}

/** The same, as a hook, for components that already hold a client. */
export function useInvalidateMyWork(pid) {
  const queryClient = useQueryClient();
  return () => invalidateMyWork(queryClient, pid);
}
