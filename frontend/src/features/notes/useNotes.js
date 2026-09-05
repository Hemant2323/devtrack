import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notesApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";

/**
 * Project notes.
 *
 * Notes are documentation, not live data: no polling, and a comfortable stale
 * time. A note references an issue or sprint rather than copying it, so
 * nothing here has to invalidate issue, board, sprint, chat or dependency
 * caches — writing a note changes no other resource.
 */

export function useNotes(pid, noteType = null) {
  return useQuery({
    queryKey: keys.notes(pid, noteType),
    queryFn: ({ signal }) => notesApi.list(pid, { noteType }, { signal }),
    enabled: Boolean(pid),
    staleTime: 30_000,
    // Keeps the list on screen while a type filter loads instead of flashing
    // empty, the same way the issue list behaves.
    placeholderData: (previous) => previous,
  });
}

export function useNote(noteId) {
  return useQuery({
    queryKey: keys.note(noteId),
    queryFn: ({ signal }) => notesApi.get(noteId, { signal }),
    enabled: Boolean(noteId),
    staleTime: 30_000,
  });
}

/**
 * Every type-filtered variant of the list is stale after a write — a new note
 * belongs in "All" and in its own type — so the list prefix is invalidated
 * rather than the one key currently on screen. That prefix stops at the
 * project's notes; nothing else in the project is touched.
 */
function invalidateNoteList(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "notes"] });
}

export function useCreateNote(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => notesApi.create(pid, data),
    onSuccess: (note) => {
      // The editor navigates straight here, so seed its cache from the
      // response instead of making it refetch what we already have.
      queryClient.setQueryData(keys.note(note.id), note);
      invalidateNoteList(queryClient, pid);
    },
  });
}

/** Author-only on the backend; anyone else receives 403. */
export function useUpdateNote(pid, noteId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => notesApi.update(noteId, patch),
    onSuccess: (note) => {
      queryClient.setQueryData(keys.note(noteId), note);
      invalidateNoteList(queryClient, pid);
    },
  });
}

/** Author or project admin on the backend; anyone else receives 403. */
export function useDeleteNote(pid, noteId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notesApi.remove(noteId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.note(noteId) });
      invalidateNoteList(queryClient, pid);
    },
  });
}
