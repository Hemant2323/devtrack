import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meetingsApi, notesApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { invalidateMyWork } from "../myWork/useMyWork";

/**
 * Project meetings.
 *
 * A schedule, not live data: no polling, and a comfortable stale time. The
 * upcoming/past split is a server-side scope so each section arrives already
 * ordered the way it is read, and caches independently.
 */

export function useMeetings(pid, scope = null) {
  return useQuery({
    queryKey: keys.meetings(pid, scope),
    queryFn: ({ signal }) => meetingsApi.list(pid, { scope }, { signal }),
    enabled: Boolean(pid),
    staleTime: 30_000,
  });
}

export function useMeeting(meetingId) {
  return useQuery({
    queryKey: keys.meeting(meetingId),
    queryFn: ({ signal }) => meetingsApi.get(meetingId, { signal }),
    enabled: Boolean(meetingId),
    staleTime: 30_000,
  });
}

/**
 * Notes written for one meeting.
 *
 * The existing notes endpoint with a `meeting_id` filter — one request for the
 * whole section, rather than reading each note to find out which meeting it
 * belongs to.
 */
export function useMeetingNotes(pid, meetingId) {
  return useQuery({
    queryKey: keys.meetingNotes(pid, meetingId),
    queryFn: ({ signal }) =>
      notesApi.list(pid, { meetingId }, { signal }),
    enabled: Boolean(pid) && Boolean(meetingId),
    staleTime: 30_000,
  });
}

/**
 * Both list scopes go stale after any write — a new or rescheduled meeting can
 * land in either — so the meetings prefix is invalidated. That prefix stops at
 * this project's meetings: issues, board, sprints, notes, chat and dependencies
 * are untouched, because a meeting changes none of them.
 */
function invalidateMeetingLists(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "meetings"] });
  // My Work carries a compact "upcoming meetings" list built from these.
  invalidateMyWork(queryClient, pid);
}

export function useCreateMeeting(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => meetingsApi.create(pid, data),
    onSuccess: (meeting) => {
      queryClient.setQueryData(keys.meeting(meeting.id), meeting);
      invalidateMeetingLists(queryClient, pid);
    },
  });
}

/** Organizer-only on the backend; anyone else receives 403. */
export function useUpdateMeeting(pid, meetingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => meetingsApi.update(meetingId, patch),
    onSuccess: (meeting) => {
      queryClient.setQueryData(keys.meeting(meetingId), meeting);
      invalidateMeetingLists(queryClient, pid);
    },
  });
}

/** Organizer or project admin on the backend; anyone else receives 403. */
export function useDeleteMeeting(pid, meetingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => meetingsApi.remove(meetingId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.meeting(meetingId) });
      invalidateMeetingLists(queryClient, pid);
      // Deleting a meeting detaches its notes server-side, so any note list
      // showing that link is now stale.
      queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "notes"] });
      queryClient.invalidateQueries({
        queryKey: keys.meetingNotes(pid, meetingId),
      });
    },
  });
}
