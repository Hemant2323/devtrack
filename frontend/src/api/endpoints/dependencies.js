import { api } from "../client";

/**
 * Issue dependencies.
 *
 * One directed edge serves both lists: creating it from either issue with the
 * matching `direction` produces the same row, and `GET` returns it already
 * split into `blocked_by` and `blocks` for whichever issue was asked.
 *
 * `listForProject` is what keeps the board out of an N+1: one request returns
 * every edge with its blocker's status, so the board marks blocked cards
 * without asking per card.
 */
export const dependenciesApi = {
  list: (iid, options) => api.get(`/issues/${iid}/dependencies`, options),
  create: (iid, { issueId, direction }) =>
    api.post(`/issues/${iid}/dependencies`, {
      issue_id: issueId,
      direction,
    }),
  remove: (dependencyId) => api.delete(`/dependencies/${dependencyId}`),
  listForProject: (pid, options) => api.get(`/projects/${pid}/dependencies`, options),
};
