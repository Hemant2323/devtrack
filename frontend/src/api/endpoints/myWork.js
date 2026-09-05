import { api } from "../client";

/**
 * My Work.
 *
 * One read, aggregated server-side from issues, test cases, sprints, meetings
 * and the existing dependency graph. Nothing is stored, and nothing is edited
 * here — a work item links back to the record's own page.
 *
 * The endpoint takes no user parameter: the subject is always the
 * authenticated caller, so there is no way to ask for someone else's work.
 */
export const myWorkApi = {
  get: (pid, options) => api.get(`/projects/${pid}/my-work`, options),
};
