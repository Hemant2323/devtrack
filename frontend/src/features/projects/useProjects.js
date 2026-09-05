import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, projectsApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";

/** The project list itself. */
export function useProjects() {
  return useQuery({
    queryKey: keys.projects(),
    queryFn: ({ signal }) => projectsApi.list({ signal }),
    staleTime: 60_000,
  });
}

/**
 * Members for each listed project, keyed per project.
 *
 * There is no bulk members endpoint, so this is one request per project. That
 * is a deliberate trade: the same cache entries are what the project workspace
 * needs the moment you click through (issue responses carry assignee_id with
 * no name), so nothing here is wasted — it is prefetching, not overfetching.
 * A single `GET /projects?include=members` would be better, but that is a
 * backend change.
 */
export function useProjectMembers(projects) {
  const results = useQueries({
    queries: (projects ?? []).map((project) => ({
      queryKey: keys.members(project.id),
      queryFn: ({ signal }) => membersApi.list(project.id, { signal }),
      staleTime: 5 * 60_000,
    })),
  });

  const byProjectId = {};
  (projects ?? []).forEach((project, index) => {
    byProjectId[project.id] = {
      members: results[index]?.data,
      loading: results[index]?.isPending ?? false,
    };
  });
  return byProjectId;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => projectsApi.create(data),
    onSuccess: (project) => {
      // Seed the new project's cache entry, then refresh the list.
      queryClient.setQueryData(keys.project(project.id), project);
      queryClient.invalidateQueries({ queryKey: keys.projects() });
    },
  });
}

/**
 * Archive / restore.
 *
 * Optimistic: the badge and tint flip immediately, and roll back with the
 * previous list if the request fails.
 */
export function useToggleArchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project) =>
      project.archived
        ? projectsApi.unarchive(project.id)
        : projectsApi.archive(project.id),
    onMutate: async (project) => {
      await queryClient.cancelQueries({ queryKey: keys.projects() });
      const previous = queryClient.getQueryData(keys.projects());
      queryClient.setQueryData(keys.projects(), (old) =>
        (old ?? []).map((item) =>
          item.id === project.id ? { ...item, archived: !item.archived } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _project, context) => {
      if (context?.previous) queryClient.setQueryData(keys.projects(), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.projects() });
    },
  });
}
