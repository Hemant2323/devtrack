import { api } from "../client";

/**
 * Project calendar.
 *
 * `get` returns issues, test cases, sprints, meetings and custom events
 * normalised into one list — none of them stored as calendar rows, so a date
 * changed at the source is already changed here.
 *
 * There is no write counterpart: changing a date means calling the endpoint
 * that already owns the field (issues, test cases, meetings). Only custom
 * events belong to the calendar, and only those have CRUD below.
 */
export const calendarApi = {
  get: (pid, { start, end, types } = {}, options) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    for (const type of types ?? []) params.append("types", type);
    const qs = params.toString();
    return api.get(`/projects/${pid}/calendar${qs ? `?${qs}` : ""}`, options);
  },

  createEvent: (pid, data) => api.post(`/projects/${pid}/calendar/events`, data),
  getEvent: (eventId, options) => api.get(`/calendar/events/${eventId}`, options),
  updateEvent: (eventId, patch) => api.patch(`/calendar/events/${eventId}`, patch),
  removeEvent: (eventId) => api.delete(`/calendar/events/${eventId}`),
};
