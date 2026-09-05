import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input, Textarea } from "../../components/primitives/Input";
import { fromUtcInstant, toUtcInstant } from "./monthGrid";
import styles from "./CalendarEventDialog.module.css";

const EMPTY = { title: "", description: "", date: "", time: "09:00", endDate: "", endTime: "" };

/**
 * Create or edit a custom calendar event.
 *
 * One dialog for both, because the fields are identical. These are the only
 * calendar records DevTrack owns — a release day, a holiday, a deadline that
 * belongs to no issue. Deliberately not a task: a title, some text, a start,
 * an optional end.
 */
export function CalendarEventDialog({
  open,
  onOpenChange,
  event = null,
  defaultDayKey = "",
  onSubmit,
  onDelete,
  canDelete = false,
  isSubmitting = false,
  isDeleting = false,
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);
  const editing = Boolean(event);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (event) {
      const start = fromUtcInstant(event.starts_at);
      const end = event.ends_at ? fromUtcInstant(event.ends_at) : { date: "", time: "" };
      setForm({
        title: event.title,
        description: event.description ?? "",
        date: start.date,
        time: start.time,
        endDate: end.date,
        endTime: end.time,
      });
    } else {
      setForm({ ...EMPTY, date: defaultDayKey });
    }
  }, [open, event, defaultDayKey]);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const startsAt = toUtcInstant(form.date, form.time);
  // An end needs both halves; supplying neither is the normal case.
  const endsAt = form.endDate && form.endTime ? toUtcInstant(form.endDate, form.endTime) : null;
  const canSubmit = Boolean(form.title.trim()) && Boolean(startsAt);

  async function handleSubmit(submitEvent) {
    submitEvent?.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description,
        starts_at: startsAt,
        ends_at: endsAt,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not save the event"));
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not delete the event"));
    }
  }

  const formError =
    error?.fieldError("_form") ??
    (error && Object.keys(error.fieldErrors).length === 0 ? error.message : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Calendar"
        title={editing ? "Edit event" : "New event"}
        description="A date that belongs to no issue, sprint or meeting."
        onOpenAutoFocus={(autoFocusEvent) => {
          autoFocusEvent.preventDefault();
          titleRef.current?.focus();
        }}
        footer={
          <>
            {editing && canDelete && (
              <Button
                variant="ghost"
                className={styles.delete}
                loading={isDeleting}
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              loading={isSubmitting}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {editing ? "Save changes" : "Add event"}
            </Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            ref={titleRef}
            label="Title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={200}
            placeholder="Release 2.0"
            error={error?.fieldError("title")}
          />

          <div className={styles.row}>
            <Input
              label="Starts"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              error={error?.fieldError("starts_at")}
            />
            <Input
              label="Time"
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <Input
              label="Ends"
              type="date"
              optional
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              error={error?.fieldError("ends_at")}
            />
            <Input
              label="Time"
              type="time"
              optional
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
            />
          </div>

          <Textarea
            label="Description"
            optional
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            maxLength={5000}
            error={error?.fieldError("description")}
          />

          {formError && (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
