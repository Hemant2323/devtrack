import { useState } from "react";
import { AlertCircle, Bug, ExternalLink, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/errors";
import { Avatar } from "../../components/primitives/Avatar";
import { Button } from "../../components/primitives/Button";
import { EmptyState } from "../../components/primitives/EmptyState";
import { ErrorState } from "../../components/primitives/ErrorState";
import { Skeleton } from "../../components/primitives/Skeleton";
import { Textarea } from "../../components/primitives/Input";
import { cn } from "../../lib/cn";
import { TEST_RESULT, testResultOf } from "../../lib/enums";
import { formatDate, formatRelative } from "../../lib/format";
import { useCreateBugFromRun, useRecordRun, useTestRuns } from "./useTesting";
import styles from "./Testing.module.css";

export function ResultChip({ result }) {
  const meta = testResultOf(result);
  return (
    <span className={styles.result} style={{ "--r-fg": meta.fg, "--r-bg": meta.bg }}>
      {meta.label}
    </span>
  );
}

/**
 * A test case's run history plus the form to record a new one (FR-9.2).
 *
 * Runs are append-only — there is no edit or delete on the API, because a
 * re-test is a new run. A failing run offers the one-click bug shortcut; the
 * button disappears once a bug has been raised, matching the backend's
 * one-bug-per-run rule.
 */
export function RunHistory({ pid, caseId, memberById, archived, canEdit }) {
  const { data: runs, isPending, isError, error, refetch } = useTestRuns(caseId);
  const recordRun = useRecordRun(caseId);
  const createBug = useCreateBugFromRun(pid, caseId);

  const [result, setResult] = useState(TEST_RESULT.PASS.value);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState(null);

  async function handleRecord(event) {
    event.preventDefault();
    setFormError(null);
    try {
      await recordRun.mutateAsync({ result, notes: notes.trim() });
      setNotes("");
      setResult(TEST_RESULT.PASS.value);
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new ApiError(0, "Could not record the run"));
    }
  }

  async function handleRaiseBug(runId) {
    setFormError(null);
    try {
      await createBug.mutateAsync({ runId, overrides: {} });
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new ApiError(0, "Could not raise the bug"));
    }
  }

  if (isError) {
    return <ErrorState compact title="Couldn't load runs" error={error} onRetry={refetch} />;
  }

  return (
    <>
      <div className={styles.runs}>
        {isPending && (
          <div className={styles.run}>
            <Skeleton width={24} height={24} radius="999px" />
            <div className={styles.runBody}>
              <Skeleton width="35%" height={12} />
              <div style={{ height: 8 }} />
              <Skeleton width="80%" height={12} />
            </div>
          </div>
        )}

        {!isPending && runs?.length === 0 && (
          <EmptyState
            compact
            icon={PlayCircle}
            title="No runs recorded"
            description="Record a run to capture whether this test passed, failed or was blocked."
          />
        )}

        {!isPending &&
          runs?.map((run) => {
            const who = memberById.get(run.executed_by);
            return (
              <article className={styles.run} key={run.id}>
                <Avatar name={who?.name ?? "Unknown"} size="sm" />
                <div className={styles.runBody}>
                  <div className={styles.runMeta}>
                    <ResultChip result={run.result} />
                    <span className={styles.runWho}>{who?.name ?? "Unknown"}</span>
                    <time className={styles.runTime} title={formatDate(run.executed_at)}>
                      {formatRelative(run.executed_at)}
                    </time>

                    {/* Only a failing run can raise a bug, and only once. */}
                    {canEdit &&
                      run.result === TEST_RESULT.FAIL.value &&
                      run.issue_id === null && (
                        <span className={styles.runActions}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Bug}
                            loading={
                              createBug.isPending && createBug.variables?.runId === run.id
                            }
                            onClick={() => handleRaiseBug(run.id)}
                          >
                            Raise bug
                          </Button>
                        </span>
                      )}
                  </div>

                  {run.notes && <p className={styles.runNotes}>{run.notes}</p>}

                  {run.issue_id && (
                    <Link
                      to={`/projects/${pid}/issues/${run.issue_id}`}
                      className={styles.runBug}
                    >
                      <Bug size={13} aria-hidden="true" />
                      Bug raised from this run
                      <ExternalLink size={12} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
      </div>

      {archived ? (
        <p className={styles.archivedNote}>
          This project is archived — the run history stays readable, but new runs
          can&rsquo;t be recorded.
        </p>
      ) : (
        canEdit && (
          <form className={styles.recordForm} onSubmit={handleRecord}>
            <div className={styles.resultChoices} role="radiogroup" aria-label="Run result">
              {Object.values(TEST_RESULT).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={result === option.value}
                  className={cn(styles.choice, result === option.value && styles.choiceSelected)}
                  style={{ "--c-fg": option.fg, "--c-bg": option.bg }}
                  onClick={() => setResult(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What happened during this run?"
              rows={2}
              maxLength={10000}
              aria-label="Run notes"
            />

            {formError && (
              <p className={styles.formError} role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {formError.message}
              </p>
            )}

            <div className={styles.recordActions}>
              <span className={styles.recordHint}>
                Runs are a permanent history — recording one never edits an earlier run.
              </span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={recordRun.isPending}
              >
                Record run
              </Button>
            </div>
          </form>
        )
      )}
    </>
  );
}
