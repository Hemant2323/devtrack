import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input, Textarea } from "../../components/primitives/Input";
import { useCreateSprint } from "./useSprints";
import styles from "./Sprints.module.css";

const EMPTY = { name: "", goal: "", start_date: "", end_date: "" };

/**
 * Create a sprint.
 *
 * Mirrors SprintCreate exactly: name (required, 1–100), goal, start_date and
 * end_date. New sprints always begin PLANNED — the backend sets that and the
 * form does not offer a state.
 *
 * The end-before-start rule is the server's; it is surfaced from
 * ApiError rather than duplicated here, so the two can never disagree.
 */
export function CreateSprintDialog({ pid, open, onOpenChange }) {
  const createSprint = useCreateSprint(pid);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
    }
  }, [open]);

  const set = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const payload = { name: form.name.trim(), goal: form.goal.trim() };
    // Empty strings are not valid dates; omit rather than send "".
    if (form.start_date) payload.start_date = form.start_date;
    if (form.end_date) payload.end_date = form.end_date;

    try {
      await createSprint.mutateAsync(payload);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not create the sprint"));
    }
  }

  // The date-order rule is a model validator, so it arrives under `_form`.
  const dateError = error?.fieldError("_form");
  const formMessage = error && !error.isValidation ? error.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Project"
        title="New sprint"
        description="Sprints start as planned. Start one when the team begins work on it."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              form="create-sprint-form"
              variant="primary"
              loading={createSprint.isPending}
              disabled={!form.name.trim()}
            >
              Create sprint
            </Button>
          </>
        }
      >
        <form id="create-sprint-form" className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Name"
            value={form.name}
            onChange={set("name")}
            placeholder="Sprint 12"
            maxLength={100}
            error={error?.fieldError("name")}
            autoFocus
            required
          />

          <Textarea
            label="Goal"
            optional
            value={form.goal}
            onChange={set("goal")}
            placeholder="What should be true when this sprint ends?"
            rows={2}
            error={error?.fieldError("goal")}
          />

          <div className={styles.dateRow}>
            <Input
              label="Start date"
              optional
              type="date"
              value={form.start_date}
              onChange={set("start_date")}
              error={error?.fieldError("start_date")}
            />
            <Input
              label="End date"
              optional
              type="date"
              value={form.end_date}
              onChange={set("end_date")}
              error={error?.fieldError("end_date") ?? dateError}
            />
          </div>

          {formMessage && (
            <p className={styles.formError} role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              {formMessage}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
