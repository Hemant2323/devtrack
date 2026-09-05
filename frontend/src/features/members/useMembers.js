import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { ROLE } from "../../lib/enums";

/**
 * Project membership.
 *
 * The whole feature runs on endpoints that already existed — membersApi and
 * keys.members(pid) are untouched. Because that same key is the app's user
 * directory (useProjectDirectory, useProjectOverview, AppShell all read it),
 * invalidating it after a mutation refreshes every consumer at once. No
 * second directory state is introduced.
 */
export function useMembers(pid) {
  return useQuery({
    queryKey: keys.members(pid),
    queryFn: ({ signal }) => membersApi.list(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 5 * 60_000,
  });
}

/** How many admins the project has — the guard for the last-admin rule. */
export function adminCount(members) {
  return (members ?? []).filter((member) => member.role === ROLE.ADMIN.value).length;
}

function invalidateMembers(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: keys.members(pid) });
}

export function useAddMember(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }) => membersApi.add(pid, { email, role }),
    onSuccess: () => invalidateMembers(queryClient, pid),
  });
}

/** Admin-only server-side; a non-admin receives 403. */
export function useUpdateMemberRole(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }) => membersApi.updateRole(pid, userId, role),
    onSuccess: () => invalidateMembers(queryClient, pid),
  });
}

export function useRemoveMember(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => membersApi.remove(pid, userId),
    onSuccess: () => invalidateMembers(queryClient, pid),
  });
}
