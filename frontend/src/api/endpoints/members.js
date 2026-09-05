import { api } from "../client";

/**
 * Members are also the app's only user directory: issue responses expose
 * assignee_id / reporter_id with no embedded names, so every view that shows
 * a person resolves the id against this list.
 */
export const membersApi = {
  list: (pid, options) => api.get(`/projects/${pid}/members`, options),
  add: (pid, { email, role }) => api.post(`/projects/${pid}/members`, { email, role }),
  updateRole: (pid, userId, role) =>
    api.patch(`/projects/${pid}/members/${userId}`, { role }),
  remove: (pid, userId) => api.delete(`/projects/${pid}/members/${userId}`),
};
