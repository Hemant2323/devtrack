import { api } from "../client";

/**
 * Sprint endpoints as implemented in Sprint 5 / Prompt 1.
 *
 * Lifecycle moves through dedicated start/complete calls rather than PATCH:
 * the backend deliberately excludes `state` from SprintUpdate so the
 * one-active-sprint rule and return-to-backlog cannot be bypassed.
 */
export const sprintsApi = {
  list: (pid, options) => api.get(`/projects/${pid}/sprints`, options),
  create: (pid, data) => api.post(`/projects/${pid}/sprints`, data),
  get: (sid, options) => api.get(`/sprints/${sid}`, options),
  update: (sid, patch) => api.patch(`/sprints/${sid}`, patch),
  /** PLANNED -> ACTIVE. 409 if another sprint in the project is already active. */
  start: (sid) => api.post(`/sprints/${sid}/start`),
  /** ACTIVE -> COMPLETED. Returns a SprintReport; unfinished issues go back to the backlog. */
  complete: (sid) => api.post(`/sprints/${sid}/complete`),
};
