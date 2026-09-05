import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calendarApi, issuesApi, meetingsApi, testingApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";

/**
 * The project calendar.
 *
 * One query per visible window. The response is assembled server-side from the
 * sources themselves, so nothing here merges lists or reconciles dates.
 */
export function useCalendar(pid, range, types) {
  // Sorted so two equivalent filter selections share one cache entry rather
  // than two, and stringified so the key is a stable primitive.
  const typeKey = types?.length ? [...types].sort().join(",") : null;
  const rangeKey = range ? `${range.start}..${range.end}` : null;

  return useQuery({
    queryKey: keys.calendar(pid, rangeKey, typeKey),
    queryFn: ({ signal }) => calendarApi.get(pid, { ...range, types }, { signal }),
    enabled: Boolean(pid) && Boolean(range),
    staleTime: 30_000,
    // Keeps the previous month on screen while the next one loads, so paging
    // does not flash an empty grid.
    placeholderData: (previous) => previous,
  });
}

/**
 * Every window and filter combination is stale after any date changes, so the
 * calendar prefix is invalidated as a whole. That prefix stops at this
 * project's calendar.
 */
function invalidateCalendar(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "calendar"] });
}

/**
 * Move a date from the calendar.
 *
 * This is the two-way half of the feature, and the important thing about it is
 * what it does *not* do: there is no calendar write endpoint. Each type is
 * routed to the API that already owns that field, so the calendar can never
 * hold a date the source disagrees with, and each source keeps its own
 * validation, authorization and activity logging.
 *
 * Sprints are absent on purpose — the server marks them `editable: false`, and
 * the Sprints page stays the place their dates change.
 */
export function useRescheduleEntry(pid) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entry, dayKey, instant }) => {
      switch (entry.type) {
        case "ISSUE":
          return issuesApi.update(entry.source_id, { deadline: dayKey });
        case "TEST_CASE":
          return testingApi.updateCase(entry.source_id, { deadline: dayKey });
        case "MEETING":
          return meetingsApi.update(entry.source_id, { scheduled_at: instant });
        case "CUSTOM":
          return calendarApi.updateEvent(entry.source_id, { starts_at: instant });
        default:
          // SPRINT, or anything added later without a decision about editing.
          return Promise.reject(
            new Error(`${entry.type} dates cannot be changed from the calendar`),
          );
      }
    },

    onSuccess: (_result, { entry }) => {
      invalidateCalendar(queryClient, pid);
      // The source's own views are stale too — the calendar is not the only
      // place this date is shown.
      switch (entry.type) {
        case "ISSUE":
          queryClient.invalidateQueries({ queryKey: keys.issue(entry.source_id) });
          queryClient.invalidateQueries({ queryKey: keys.activities(entry.source_id) });
          queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "issues"] });
          queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "board"] });
          break;
        case "TEST_CASE":
          queryClient.invalidateQueries({ queryKey: keys.testCase(entry.source_id) });
          queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "test-cases"] });
          break;
        case "MEETING":
          queryClient.invalidateQueries({ queryKey: keys.meeting(entry.source_id) });
          queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "meetings"] });
          break;
        case "CUSTOM":
          queryClient.invalidateQueries({ queryKey: keys.calendarEvent(entry.source_id) });
          break;
        default:
          break;
      }
    },
  });
}

// ---------- custom events ----------

export function useCalendarEvent(eventId) {
  return useQuery({
    queryKey: keys.calendarEvent(eventId),
    queryFn: ({ signal }) => calendarApi.getEvent(eventId, { signal }),
    enabled: Boolean(eventId),
    staleTime: 30_000,
  });
}

export function useCreateCalendarEvent(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => calendarApi.createEvent(pid, data),
    onSuccess: (event) => {
      queryClient.setQueryData(keys.calendarEvent(event.id), event);
      invalidateCalendar(queryClient, pid);
    },
  });
}

/** Creator-only on the backend; anyone else receives 403. */
export function useUpdateCalendarEvent(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, patch }) => calendarApi.updateEvent(eventId, patch),
    onSuccess: (event) => {
      queryClient.setQueryData(keys.calendarEvent(event.id), event);
      invalidateCalendar(queryClient, pid);
    },
  });
}

/** Creator or project admin on the backend; anyone else receives 403. */
export function useDeleteCalendarEvent(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId) => calendarApi.removeEvent(eventId),
    onSuccess: (_data, eventId) => {
      queryClient.removeQueries({ queryKey: keys.calendarEvent(eventId) });
      invalidateCalendar(queryClient, pid);
    },
  });
}
