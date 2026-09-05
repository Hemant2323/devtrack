import { api } from "../client";

export const projectsApi = {
  list: (options) => api.get("/projects", options),
  get: (pid, options) => api.get(`/projects/${pid}`, options),
  create: (data) => api.post("/projects", data),
  update: (pid, patch) => api.patch(`/projects/${pid}`, patch),
  // The API has no DELETE for projects — archiving is a PATCH.
  archive: (pid) => api.patch(`/projects/${pid}`, { archived: true }),
  unarchive: (pid) => api.patch(`/projects/${pid}`, { archived: false }),
};
