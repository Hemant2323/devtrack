import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { componentsApi, membersApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";

/**
 * Members and components for a project, plus id -> record lookups.
 *
 * Issue responses expose assignee_id / reporter_id / component_id and no
 * names, so every issue view has to join against these two lists. They are
 * cached for five minutes because they change rarely and are needed by the
 * list, the detail page and the create dialog alike.
 */
export function useProjectDirectory(pid) {
  const members = useQuery({
    queryKey: keys.members(pid),
    queryFn: ({ signal }) => membersApi.list(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 5 * 60_000,
  });

  const components = useQuery({
    queryKey: keys.components(pid),
    queryFn: ({ signal }) => componentsApi.list(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 5 * 60_000,
  });

  const memberById = useMemo(() => {
    const map = new Map();
    (members.data ?? []).forEach((member) => map.set(member.user_id, member));
    return map;
  }, [members.data]);

  const componentById = useMemo(() => {
    const map = new Map();
    (components.data ?? []).forEach((component) => map.set(component.id, component));
    return map;
  }, [components.data]);

  return {
    members: members.data ?? [],
    components: components.data ?? [],
    memberById,
    componentById,
    isPending: members.isPending || components.isPending,
  };
}
