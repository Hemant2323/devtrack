import { useMemo, useState } from "react";
import { Archive, ClipboardCheck, Link2, Plus, Search, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Input } from "../components/primitives/Input";
import { Skeleton } from "../components/primitives/Skeleton";
import { TestCaseDialog } from "../features/testing/TestCaseDialog";
import { useTestCases } from "../features/testing/useTesting";
import { useIssueList } from "../features/issues/useIssues";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useProjectId } from "../hooks/useProjectId";
import { matches } from "../lib/format";
import styles from "./TestCasesPage.module.css";

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={`${45 + ((i * 9) % 30)}%`} height={13} />
      <Skeleton width={54} height={11} />
      <Skeleton width={24} height={11} />
      <span />
    </div>
  ));
}

/**
 * Test cases (FR-9.1).
 *
 * The list endpoint supports only an `issue_id` filter, so the text search
 * here is client-side over the already-loaded page — unlike Issues, where `q`
 * is a real server parameter. Filtering in the browser is honest at this
 * scale and avoids inventing a query parameter the API does not have.
 */
export function TestCasesPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { memberById } = useProjectDirectory(pid);
  const [createOpen, setCreateOpen] = useState(false);

  const q = params.get("q") ?? "";

  const { data: cases, isPending, isError, error, refetch } = useTestCases(pid);
  // Powers the "verifies issue" picker in the dialog.
  const { data: issues } = useIssueList(pid, {});

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);
  const canEdit = Boolean(memberById.get(user?.id)) && !archived;

  const issueById = useMemo(() => {
    const map = new Map();
    (issues ?? []).forEach((issue) => map.set(issue.id, issue));
    return map;
  }, [issues]);

  const visible = useMemo(
    () =>
      (cases ?? []).filter(
        (testCase) =>
          matches(testCase.title, q) ||
          matches(testCase.steps, q) ||
          matches(testCase.expected_result, q),
      ),
    [cases, q],
  );

  function setSearch(value) {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Test cases`}
        title="Test cases"
        description="Repeatable checks, and the record of every time they were run."
        actions={
          canEdit ? (
            <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
              New test case
            </Button>
          ) : null
        }
      />

      {archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. Test cases are read-only.
        </p>
      )}

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            icon={Search}
            type="search"
            placeholder="Search test cases…"
            value={q}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search test cases"
          />
        </div>
        <span className={styles.spacer} />
        {!isPending && !isError && (
          <span className={styles.count}>
            {q ? `${visible.length} of ${cases?.length ?? 0}` : `${cases?.length ?? 0} test cases`}
          </span>
        )}
      </div>

      <div className={styles.body}>
        {isError ? (
          <ErrorState title="Couldn't load test cases" error={error} onRetry={() => refetch()} />
        ) : (
          <div className={styles.panel}>
            {isPending && <SkeletonRows />}

            {!isPending && visible.length === 0 && (
              q ? (
                <EmptyState
                  icon={SearchX}
                  title="No test cases match"
                  description={`Nothing matches “${q}”.`}
                  action={
                    <Button variant="secondary" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No test cases yet"
                  description="Write a test case to capture what to check, then record a run each time you check it."
                  action={
                    canEdit ? (
                      <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                        New test case
                      </Button>
                    ) : null
                  }
                />
              )
            )}

            {!isPending &&
              visible.map((testCase) => {
                const linked = testCase.issue_id ? issueById.get(testCase.issue_id) : null;
                return (
                  <Link
                    key={testCase.id}
                    to={`/projects/${pid}/test-cases/${testCase.id}`}
                    className={styles.row}
                  >
                    <span>
                      <span className={styles.title}>{testCase.title}</span>
                      {testCase.expected_result && (
                        <span className={styles.sub}>
                          Expects: {testCase.expected_result}
                        </span>
                      )}
                    </span>
                    <span className={styles.linked}>
                      {linked && (
                        <>
                          <Link2 size={12} aria-hidden="true" />
                          {linked.key}
                        </>
                      )}
                    </span>
                    <span className={styles.runCount} />
                    <span />
                  </Link>
                );
              })}
          </div>
        )}
      </div>

      <TestCaseDialog
        pid={pid}
        issues={issues ?? []}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}
