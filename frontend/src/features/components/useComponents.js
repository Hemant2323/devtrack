import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { componentsApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";

/**
 * Project components.
 *
 * Read and create only — those are the only operations the API exposes. There
 * is no PATCH or DELETE for a component, so no rename or removal hook exists
 * here rather than a hook that would 405.
 *
 * keys.components(pid) is the same key useProjectDirectory and
 * useProjectOverview already read, so invalidating it after a create refreshes
 * the issue dialogs, board cards and the Overview panel with no duplicate
 * state.
 */
export function useComponents(pid) {
  return useQuery({
    queryKey: keys.components(pid),
    queryFn: ({ signal }) => componentsApi.list(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 5 * 60_000,
  });
}

export function useCreateComponent(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => componentsApi.create(pid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.components(pid) });
    },
  });
}
