import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { testingApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { invalidateMyWork } from "../myWork/useMyWork";

/** Test cases for a project, optionally narrowed to one issue. */
export function useTestCases(pid, filters = {}) {
  const clean = filters.issue_id ? { issue_id: filters.issue_id } : {};
  return useQuery({
    queryKey: keys.testCases(pid, clean),
    queryFn: ({ signal }) => testingApi.listCases(pid, clean, { signal }),
    enabled: Boolean(pid),
    staleTime: 30_000,
  });
}

export function useTestCase(caseId) {
  return useQuery({
    queryKey: keys.testCase(caseId),
    queryFn: ({ signal }) => testingApi.getCase(caseId, { signal }),
    enabled: Boolean(caseId),
    staleTime: 30_000,
  });
}

export function useTestRuns(caseId) {
  return useQuery({
    queryKey: keys.testRuns(caseId),
    queryFn: ({ signal }) => testingApi.listRuns(caseId, { signal }),
    enabled: Boolean(caseId),
    // The run history is an audit trail; never show it stale.
    staleTime: 0,
  });
}

/** Every list variant of this project's test cases. */
function invalidateCaseLists(queryClient, pid) {
  queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "test-cases"] });
  // My Work lists the caller's test cases with their latest run.
  invalidateMyWork(queryClient, pid);
}

export function useCreateTestCase(pid) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => testingApi.createCase(pid, data),
    onSuccess: (testCase) => {
      queryClient.setQueryData(keys.testCase(testCase.id), testCase);
      invalidateCaseLists(queryClient, pid);
    },
  });
}

export function useUpdateTestCase(pid, caseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => testingApi.updateCase(caseId, patch),
    onSuccess: (testCase) => {
      queryClient.setQueryData(keys.testCase(caseId), testCase);
      invalidateCaseLists(queryClient, pid);
    },
  });
}

/** Admin-only on the backend; deleting a case also removes its runs there. */
export function useDeleteTestCase(pid, caseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => testingApi.deleteCase(caseId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.testCase(caseId) });
      queryClient.removeQueries({ queryKey: keys.testRuns(caseId) });
      invalidateCaseLists(queryClient, pid);
    },
  });
}

export function useRecordRun(caseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => testingApi.recordRun(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.testRuns(caseId) });
    },
  });
}

/**
 * Raise a bug from a failed run (FR-9.2).
 *
 * The backend creates the issue through the ordinary issue flow, so a real
 * issue now exists: the project's issue lists, board, counts and the new
 * issue's own caches all have to be refreshed, exactly as if it had been
 * filed by hand.
 */
export function useCreateBugFromRun(pid, caseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, overrides }) => testingApi.createBugFromRun(runId, overrides),
    onSuccess: ({ issue }) => {
      queryClient.setQueryData(keys.issue(issue.id), issue);
      queryClient.invalidateQueries({ queryKey: keys.activities(issue.id) });
      queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "issues"] });
      queryClient.invalidateQueries({ queryKey: ["projects", String(pid), "board"] });
      // issue_counter moved on the project record.
      queryClient.invalidateQueries({ queryKey: keys.project(pid) });
      // The run now carries the raised issue's id.
      queryClient.invalidateQueries({ queryKey: keys.testRuns(caseId) });
    },
  });
}
