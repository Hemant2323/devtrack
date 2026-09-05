import { api } from "../client";

/**
 * Project notes — lightweight team documentation.
 *
 * `note_type` and `meeting_id` are the server-side filters; search is
 * client-side over an already-loaded list, because a project's notes are few
 * and filtering them in the browser costs a request nobody needs.
 */
export const notesApi = {
  list: (pid, { noteType, meetingId } = {}, options) => {
    const params = new URLSearchParams();
    if (noteType) params.set("note_type", noteType);
    if (meetingId) params.set("meeting_id", String(meetingId));
    const qs = params.toString();
    return api.get(`/projects/${pid}/notes${qs ? `?${qs}` : ""}`, options);
  },
  create: (pid, data) => api.post(`/projects/${pid}/notes`, data),
  get: (noteId, options) => api.get(`/notes/${noteId}`, options),
  update: (noteId, patch) => api.patch(`/notes/${noteId}`, patch),
  remove: (noteId) => api.delete(`/notes/${noteId}`),
};
