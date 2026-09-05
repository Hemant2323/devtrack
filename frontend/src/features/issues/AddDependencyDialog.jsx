import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input } from "../../components/primitives/Input";
import { IssueKey, StatusChip, TypeIcon } from "../../components/domain/IssueAtoms";
import { cn } from "../../lib/cn";
import { matches } from "../../lib/format";
import { useIssueList } from "./useIssues";
import styles from "./AddDependencyDialog.module.css";

const DIRECTIONS = [
  {
    value: "BLOCKED_BY",
    label: "This issue is blocked by it",
    hint: "The other issue has to be resolved first.",
  },
  {
    value: "BLOCKS",
    label: "This issue blocks it",
    hint: "The other issue is waiting on this one.",
  },
];

/**
 * Pick one issue and say which way the link points.
 *
 * The list is the project's own issue list — the same query the Issues page
 * uses, so no second search mechanism exists and nothing outside the project
 * can be reached. This issue and anything already linked are filtered out, so
 * the obvious mistakes are simply not offerable; the rest (a cycle) is the
 * server's answer, shown here verbatim.
 */
export function AddDependencyDialog({
  pid,
  iid,
  open,
  onOpenChange,
  excludeIssueIds,
  onSubmit,
  isSubmitting = false,
}) {
  // Held back until the dialog opens, so viewing an issue does not fetch
  // the project's whole issue list on the chance someone adds a link.
  const { data: issues, isPending, isError } = useIssueList(pid, {}, { enabled: open });
  const [direction, setDirection] = useState("BLOCKED_BY");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  const searchRef = useRef(null);

  // Each opening starts clean rather than resuming the last attempt.
  useEffect(() => {
    if (open) {
      setDirection("BLOCKED_BY");
      setSelectedId(null);
      setQuery("");
      setError(null);
    }
  }, [open]);

  const candidates = useMemo(
    () =>
      (issues ?? []).filter(
        (issue) => String(issue.id) !== String(iid) && !excludeIssueIds?.has(issue.id),
      ),
    [issues, iid, excludeIssueIds],
  );

  const visible = useMemo(
    () =>
      candidates.filter(
        (issue) => matches(issue.title, query) || matches(issue.key, query),
      ),
    [candidates, query],
  );

  async function handleSubmit() {
    if (!selectedId) return;
    setError(null);
    try {
      await onSubmit({ issueId: selectedId, direction });
      onOpenChange(false);
    } catch (err) {
      // 409 duplicate, 422 self / cross-project / cycle — all carry a usable
      // message, so it is shown as-is instead of being second-guessed here.
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not add the dependency"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Dependencies"
        title="Add dependency"
        description="Link this issue to another one in the same project."
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              loading={isSubmitting}
              disabled={!selectedId}
              onClick={handleSubmit}
            >
              Add dependency
            </Button>
          </>
        }
      >
        <fieldset className={styles.directions}>
          <legend className={styles.legend}>Direction</legend>
          {DIRECTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                styles.direction,
                direction === option.value && styles.directionActive,
              )}
            >
              <input
                type="radio"
                name="dependency-direction"
                value={option.value}
                checked={direction === option.value}
                onChange={() => setDirection(option.value)}
                className={styles.radio}
              />
              <span className={styles.directionText}>
                <span className={styles.directionLabel}>{option.label}</span>
                <span className={styles.directionHint}>{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className={styles.picker}>
          <Input
            ref={searchRef}
            type="search"
            icon={Search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by key or title"
            aria-label="Search issues"
          />

          <div className={styles.list} role="radiogroup" aria-label="Issue to link">
            {isPending && <p className={styles.note}>Loading issues…</p>}

            {isError && (
              <p className={styles.note} role="alert">
                Couldn&apos;t load this project&apos;s issues. Close this and try again.
              </p>
            )}

            {!isPending && !isError && candidates.length === 0 && (
              <p className={styles.note}>
                There is no other issue to link to yet. Every other issue in this
                project is already linked to this one.
              </p>
            )}

            {!isPending && !isError && candidates.length > 0 && visible.length === 0 && (
              <p className={styles.note}>No issues match “{query}”.</p>
            )}

            {visible.map((issue) => {
              const selected = selectedId === issue.id;
              return (
                <button
                  key={issue.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(styles.option, selected && styles.optionSelected)}
                  onClick={() => setSelectedId(issue.id)}
                >
                  <TypeIcon type={issue.type} />
                  <IssueKey>{issue.key}</IssueKey>
                  <span className={styles.optionTitle}>{issue.title}</span>
                  <StatusChip status={issue.status} className={styles.optionStatus} />
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
