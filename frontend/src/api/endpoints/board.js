import { api } from "../client";

export const boardApi = {
  /** Returns { todo, in_progress, testing, done } — each an array of issues. */
  get: (pid, sprintId, options) =>
    api.get(
      `/projects/${pid}/board${sprintId ? `?sprint_id=${sprintId}` : ""}`,
      options,
    ),
};
