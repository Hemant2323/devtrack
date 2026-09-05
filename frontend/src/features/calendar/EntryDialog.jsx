import { useEffect, useState } from "react";
import { ArrowUpRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/errors";
import { Badge } from "../../components/primitives/Badge";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input } from "../../components/primitives/Input";
import { ENTRY_TYPES, entryTypeOf, sourcePath } from "./entryTypes";
import { fromUtcInstant, toUtcInstant } from "./monthGrid";
import styles from "./EntryDialog.module.css";

/**
 * One calendar entry, and the one thing the calendar lets you change about it.
 *
 * The date picker is the whole two-way story: saving calls the source's own
 * update endpoint (see useRescheduleEntry), never a calendar-side write. An
 * entry the server marked `editable: false` — a sprint, someone else's
 * meeting, anything in an archived project — says so plainly instead of
 * offering a control that would be refused.
 *
 * Everything else about the entry lives on its own page, which is one click
 * away rather than duplicated here.
 */
export function EntryDialog({ pid, entry, open, onOpenChange, onReschedule, isSaving }) {
  const [dayKey, setDayKey] = useState("");
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !entry) return;
    setError(null);
    if (entry.all_day) {
      // An all-day entry is a date; read it as one rather than as an instant.
      setDayKey(String(entry.start).slice(0, 10));
      setTime("09:00");
    } else {
      const parts = fromUtcInstant(entry.start);
      setDayKey(parts.date);
      setTime(parts.time);
    }
  }, [open, entry]);

  if (!entry) return null;

  const meta = entryTypeOf(entry.type);
  const path = sourcePath(pid, entry);
  const changed = entry.all_day
    ? dayKey !== String(entry.start).slice(0, 10)
    : toUtcInstant(dayKey, time) !== new Date(entry.start).toISOString();

  async function handleSave() {
    setError(null);
    try {
      await onReschedule({
        entry,
        // All-day sources take a plain date; timed ones take an instant.
        dayKey,
        instant: toUtcInstant(dayKey, time),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not move this date"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow={meta.label}
        title={entry.title}
        description={
          entry.editable
            ? "Change the date here and the original record is updated."
            : "This date is read-only from the calendar."
        }
        footer={
          <>
            {path && (
              <Link to={path} className={styles.open}>
                Open {meta.label.toLowerCase()}
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            )}
            <DialogClose asChild>
              <Button variant="ghost">Close</Button>
            </DialogClose>
            {entry.editable && (
              <Button
                variant="primary"
                loading={isSaving}
                disabled={!dayKey || !changed}
                onClick={handleSave}
              >
                Save date
              </Button>
            )}
          </>
        }
      >
        <div className={styles.body}>
          <div className={styles.chips}>
            <Badge variant="neutral" dot>
              {meta.label}
            </Badge>
            {entry.reference && <span className={styles.reference}>{entry.reference}</span>}
            {entry.status && <Badge variant="neutral">{entry.status.replace("_", " ")}</Badge>}
          </div>

          {entry.editable ? (
            <div className={styles.row}>
              <Input
                label={entry.all_day ? "Date" : "Starts"}
                type="date"
                value={dayKey}
                onChange={(event) => setDayKey(event.target.value)}
              />
              {!entry.all_day && (
                <Input
                  label="Time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              )}
            </div>
          ) : (
            <p className={styles.readOnly}>
              <Lock size={14} aria-hidden="true" />
              {entry.type === ENTRY_TYPES.SPRINT.value
                ? "Sprint dates are changed on the Sprints page, where the whole sprint is in view."
                : "You do not have permission to change this date, or the project is archived."}
            </p>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error.message}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
