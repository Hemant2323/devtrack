import { api } from "../client";

/** Drop empty values so they never reach the query string. */
function toQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const issuesApi = {
  // Supported filters: status, type, priority, assignee_id, sprint_id, q
  list: (pid, filters, options) =>
    api.get(`/projects/${pid}/issues${toQuery(filters)}`, options),
  create: (pid, data) => api.post(`/projects/${pid}/issues`, data),
  get: (iid, options) => api.get(`/issues/${iid}`, options),
  update: (iid, patch) => api.patch(`/issues/${iid}`, patch),
  remove: (iid) => api.delete(`/issues/${iid}`),
  activities: (iid, options) => api.get(`/issues/${iid}/activities`, options),
};
