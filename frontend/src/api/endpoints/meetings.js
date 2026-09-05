import { api } from "../client";

/**
 * Project meetings.
 *
 * `scope` splits the timeline server-side so each half arrives in the order it
 * should be read: upcoming counts forward, past counts back.
 *
 * `meet_url` is a link someone pasted. Nothing here — and nothing on the
 * server — calls Google, creates a call, or joins one.
 */
export const meetingsApi = {
  list: (pid, { scope } = {}, options) =>
    api.get(`/projects/${pid}/meetings${scope ? `?scope=${scope}` : ""}`, options),
  create: (pid, data) => api.post(`/projects/${pid}/meetings`, data),
  get: (meetingId, options) => api.get(`/meetings/${meetingId}`, options),
  update: (meetingId, patch) => api.patch(`/meetings/${meetingId}`, patch),
  remove: (meetingId) => api.delete(`/meetings/${meetingId}`),
};
