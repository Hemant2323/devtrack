import { api } from "../client";

/**
 * Test case and test run endpoints (FR-9).
 *
 * Runs are append-only: there is no update or delete for them, because a
 * re-test is a new run rather than an edit of the old one.
 */
export const testingApi = {
  listCases: (pid, filters, options) => {
    const qs = filters?.issue_id ? `?issue_id=${filters.issue_id}` : "";
    return api.get(`/projects/${pid}/test-cases${qs}`, options);
  },
  createCase: (pid, data) => api.post(`/projects/${pid}/test-cases`, data),
  getCase: (caseId, options) => api.get(`/test-cases/${caseId}`, options),
  updateCase: (caseId, patch) => api.patch(`/test-cases/${caseId}`, patch),
  deleteCase: (caseId) => api.delete(`/test-cases/${caseId}`),

  listRuns: (caseId, options) => api.get(`/test-cases/${caseId}/runs`, options),
  recordRun: (caseId, data) => api.post(`/test-cases/${caseId}/runs`, data),

  /** One-click bug from a failed run. Returns { run, issue }. */
  createBugFromRun: (runId, data = {}) => api.post(`/test-runs/${runId}/bug`, data),
};
