import { api } from "../client";

export const componentsApi = {
  list: (pid, options) => api.get(`/projects/${pid}/components`, options),
  create: (pid, data) => api.post(`/projects/${pid}/components`, data),
};
