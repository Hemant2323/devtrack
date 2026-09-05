import { useState } from "react";
import { Archive, ChevronRight, Link2, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/primitives/Avatar";
import { Button } from "../components/primitives/Button";
import { ErrorState } from "../components/primitives/ErrorState";
import { Skeleton } from "../components/primitives/Skeleton";
import { IssueKey } from "../components/domain/IssueAtoms";
import { RunHistory } from "../features/testing/RunHistory";
import { TestCaseDialog } from "../features/testing/TestCaseDialog";
import { useDeleteTestCase, useTestCase } from "../features/testing/useTesting";
import { useIssue, useIssueList } from "../features/issues/useIssues";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { ROLE } from "../lib/enums";
import { formatDate, formatRelative } from "../lib/format";
import styles from "./TestCaseDetailPage.module.css";

function LoadingLayout() {
  return (
    <div className={styles.body}>
      <div className={styles.col}>
        <div className={styles.skelPanel}>
          <Skeleton width="25%" height={13} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="80%" height={12} />
        </div>
        <div className={styles.skelPanel}>
          <Skeleton width="25%" height={13} />
          <Skeleton width="100%" height={40} />
        </div>
      </div>
      <div className={styles.col}>
        <div className={styles.skelPanel}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width="100%" height={14} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A single test case and its run history (FR-9.1, FR-9.2).
 *
 * Editing is any member's; deleting is admin-only and removes the case's runs
 * with it, which is why the button says so. An archived project makes the whole
 * page read-only, matching the backend's 403 on every write.
 */
export function TestCaseDetailPage() {
  const pid = useProjectId();
  const { tcid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: testCase, isPending, isError, error, refetch } = useTestCase(tcid);
  const { members, memberById } = useProjectDirectory(pid);
  const deleteCase = useDeleteTestCase(pid, tcid);
  const { data: issues } = useIssueList(pid, {});
  const { data: linkedIssue } = useIssue(testCase?.issue_id);

  const [editOpen, setEditOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);
  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canEdit = Boolean(myRole) && !archived;
  const canDelete = myRole === ROLE.ADMIN.value && !archived;

  if (isPending) {
    return (
      <>
        <div className={styles.header}>
          <Skeleton width={200} height={11} />
          <div style={{ height: 12 }} />
          <Skeleton width="45%" height={26} />
        </div>
        <LoadingLayout />
      </>
    );
  }

  if (isError) {
    return (
      <div className={styles.body}>
        <ErrorState
          title={error?.isNotFound ? "Test case not found" : "Couldn't load this test case"}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const author = memberById.get(testCase.created_by);

  return (
    <>
      <div className={styles.header}>
        <nav className={styles.crumb}>
          <Link to={`/projects/${pid}`} className={styles.crumbLink}>
            {project?.key ?? "Project"}
          </Link>
          <ChevronRight size={11} aria-hidden="true" />
          <Link to={`/projects/${pid}/test-cases`} className={styles.crumbLink}>
            Test cases
          </Link>
          <ChevronRight size={11} aria-hidden="true" />
          <span>#{testCase.id}</span>
        </nav>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>{testCase.title}</h1>
          <div className={styles.actions}>
            {canEdit && (
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="secondary"
                size="sm"
                icon={Trash2}
                loading={deleteCase.isPending}
                title="Deletes this test case and its run history"
                onClick={async () => {
                  await deleteCase.mutateAsync();
                  navigate(`/projects/${pid}/test-cases`);
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. This test case is read-only.
        </p>
      )}

      <div className={styles.body}>
        <div className={styles.col}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Preconditions</h2>
            </div>
            <div className={styles.panelBody}>
              <p className={cn(styles.prose, !testCase.preconditions && styles.prosePlaceholder)}>
                {testCase.preconditions || "None recorded."}
              </p>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Steps</h2>
            </div>
            <div className={styles.panelBody}>
              <p className={cn(styles.prose, !testCase.steps && styles.prosePlaceholder)}>
                {testCase.steps || "No steps recorded."}
              </p>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Expected result</h2>
            </div>
            <div className={styles.panelBody}>
              <p
                className={cn(
                  styles.prose,
                  !testCase.expected_result && styles.prosePlaceholder,
                )}
              >
                {testCase.expected_result || "No expected result recorded."}
              </p>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Runs</h2>
              <span className={styles.panelMeta}>Append-only</span>
            </div>
            <RunHistory
              pid={pid}
              caseId={tcid}
              memberById={memberById}
              archived={archived}
              canEdit={canEdit}
            />
          </section>
        </div>

        <div className={styles.col}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Details</h2>
            </div>
            <div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Verifies</span>
                <span className={styles.fieldValue}>
                  {linkedIssue ? (
                    <Link to={`/projects/${pid}/issues/${linkedIssue.id}`}>
                      <Link2 size={12} aria-hidden="true" style={{ display: "inline" }} />{" "}
                      <IssueKey>{linkedIssue.key}</IssueKey>
                    </Link>
                  ) : (
                    <span style={{ color: "var(--text-disabled)" }}>No linked issue</span>
                  )}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Author</span>
                <span className={styles.fieldValue}>
                  {author && <Avatar name={author.name} size="xs" />}
                  {author?.name ?? "Unknown"}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Created</span>
                <span className={styles.fieldValue} title={formatDate(testCase.created_at)}>
                  {formatRelative(testCase.created_at)}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Updated</span>
                <span className={styles.fieldValue} title={formatDate(testCase.updated_at)}>
                  {formatRelative(testCase.updated_at)}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>ID</span>
                <span className={cn(styles.fieldValue, styles.mono)}>#{testCase.id}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <TestCaseDialog
        pid={pid}
        testCase={testCase}
        issues={issues ?? []}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
