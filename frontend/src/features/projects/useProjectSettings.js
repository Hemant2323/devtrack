import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";

/**
 * Project settings mutations.
 *
 * All three go through the existing PATCH /projects/{id}. `key` is absent from
 * ProjectUpdate on purpose — it prefixes every issue key ever minted, so it is
 * immutable and the UI shows it read-only.
 *
 * Every mutation invalidates two keys, not one:
 *   keys.project(pid)  — this project's record, read by the sidebar header,
 *                        every page's archived guard, and the page itself
 *   keys.projects()    — the workspace list and the top-bar project switcher,
 *                        both of which show the name and archived state
 * Without the second, a rename would leave the switcher showing the old name.
 */
function invalidateProject(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: keys.project(pid) });
  queryClient.invalidateQueries({ queryKey: keys.projects() });
}

export function useUpdateProject(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => projectsApi.update(pid, patch),
    onSuccess: (project) => {
      // The server response is authoritative for this project's cache entry.
      queryClient.setQueryData(keys.project(pid), project);
      invalidateProject(queryClient, pid);
    },
  });
}

/**
 * Archive / restore.
 *
 * Note that update_project deliberately has no archived guard on the backend —
 * that is what makes restoring possible at all, and why Settings stays
 * writable when every other page has gone read-only.
 */
export function useArchiveProject(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archived) =>
      archived ? projectsApi.archive(pid) : projectsApi.unarchive(pid),
    onSuccess: (project) => {
      queryClient.setQueryData(keys.project(pid), project);
      invalidateProject(queryClient, pid);
    },
  });
}
