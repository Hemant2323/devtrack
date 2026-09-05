import { useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input, Textarea } from "../../components/primitives/Input";
import { Select } from "../../components/primitives/Select";
import { ISSUE_TYPE, PRIORITY, SEVERITY } from "../../lib/enums";
import { useProjectDirectory } from "../projects/useProjectDirectory";
import { useCreateIssue } from "./useIssues";
import styles from "./CreateIssueDialog.module.css";

const TYPE_OPTIONS = Object.values(ISSUE_TYPE).map((t) => ({ value: t.value, label: t.label }));
const PRIORITY_OPTIONS = Object.values(PRIORITY).map((p) => ({ value: p.value, label: p.label }));
const SEVERITY_OPTIONS = Object.values(SEVERITY).map((s) => ({ value: s.value, label: s.label }));

const EMPTY = {
  type: ISSUE_TYPE.TASK.value,
  title: "",
  description: "",
  priority: PRIORITY.MEDIUM.value,
  severity: "",
  steps_to_reproduce: "",
  assignee_id: "",
  component_id: "",
  deadline: "",
};

/**
 * Create an issue.
 *
 * The form mirrors IssueCreate exactly — every field it sends is one the
 * schema accepts. The bug/task rule is the backend's, not ours: a BUG must
 * carry a severity and a TASK must not, so the severity control appears only
 * for bugs and severity is omitted entirely from a task payload. The server
 * still validates; this just avoids a guaranteed 422.
 *
 * `sprint_id` is intentionally not offered here: new issues start in the
 * backlog, and they are planned into a sprint afterwards from the Backlog
 * page or the issue's own sprint picker.
 */
export function CreateIssueDialog({ pid, open, onOpenChange }) {
  const navigate = useNavigate();
  const createIssue = useCreateIssue(pid);
  const { members, components } = useProjectDirectory(pid);

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
    }
  }, [open]);

  const isBug = form.type === ISSUE_TYPE.BUG.value;
  const set = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const payload = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
    };
    // Only send optional fields when they carry a value — the schema treats
    // null and absent alike, but an empty string is not a valid id or date.
    if (form.assignee_id) payload.assignee_id = Number(form.assignee_id);
    if (form.component_id) payload.component_id = Number(form.component_id);
    if (form.deadline) payload.deadline = form.deadline;
    if (isBug) {
      payload.severity = form.severity || null;
      if (form.steps_to_reproduce.trim()) {
        payload.steps_to_reproduce = form.steps_to_reproduce.trim();
      }
    }

    try {
      const issue = await createIssue.mutateAsync(payload);
      onOpenChange(false);
      navigate(`/projects/${pid}/issues/${issue.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not create the issue"));
    }
  }

  // A model-level validator failure ("severity is required for bugs") arrives
  // under `_form`; show it with the field group it belongs to.
  const modelError = error?.fieldError("_form");
  const formMessage = error && !error.isValidation ? error.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Project"
        title="New issue"
        description="Tasks and bugs share one workflow. Bugs additionally carry a severity."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              form="create-issue-form"
              variant="primary"
              loading={createIssue.isPending}
              disabled={!form.title.trim()}
            >
              Create issue
            </Button>
          </>
        }
      >
        <form id="create-issue-form" className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.typeRow}>
            <Select
              label="Type"
              value={form.type}
              onChange={(event) => {
                const type = event.target.value;
                // Leaving bug clears severity so a task never carries one.
                setForm((prev) => ({
                  ...prev,
                  type,
                  severity: type === ISSUE_TYPE.BUG.value ? prev.severity : "",
                }));
              }}
              options={TYPE_OPTIONS}
              error={error?.fieldError("type")}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={set("priority")}
              options={PRIORITY_OPTIONS}
              error={error?.fieldError("priority")}
            />
          </div>

          <Input
            label="Title"
            value={form.title}
            onChange={set("title")}
            placeholder="Coupon code rejected on UPI checkout"
            maxLength={200}
            error={error?.fieldError("title")}
            autoFocus
            required
          />

          <Textarea
            label="Description"
            optional
            value={form.description}
            onChange={set("description")}
            placeholder="What is happening, and what should happen instead?"
            rows={3}
            error={error?.fieldError("description")}
          />

          {isBug && (
            <>
              <Select
                label="Severity"
                value={form.severity}
                onChange={set("severity")}
                options={SEVERITY_OPTIONS}
                placeholder="Select a severity…"
                error={error?.fieldError("severity") ?? modelError}
                hint="Required for bugs."
              />
              <Textarea
                label="Steps to reproduce"
                optional
                value={form.steps_to_reproduce}
                onChange={set("steps_to_reproduce")}
                placeholder={"1. Add an item to the basket\n2. Apply the coupon\n3. Select UPI"}
                rows={3}
                error={error?.fieldError("steps_to_reproduce")}
              />
            </>
          )}

          <div className={styles.grid}>
            <Select
              label="Assignee"
              optional
              value={form.assignee_id}
              onChange={set("assignee_id")}
              placeholder="Unassigned"
              options={members.map((m) => ({ value: String(m.user_id), label: m.name }))}
              error={error?.fieldError("assignee_id")}
            />
            <Select
              label="Component"
              optional
              value={form.component_id}
              onChange={set("component_id")}
              placeholder="None"
              options={components.map((c) => ({ value: String(c.id), label: c.name }))}
              error={error?.fieldError("component_id")}
            />
          </div>

          <Input
            label="Due date"
            optional
            type="date"
            value={form.deadline}
            onChange={set("deadline")}
            error={error?.fieldError("deadline")}
          />

          {components.length === 0 && (
            <p className={styles.note}>
              <Info size={14} aria-hidden="true" />
              This project has no components yet, so issues can&rsquo;t be grouped by
              area. Components are managed from the project&rsquo;s Components page.
            </p>
          )}

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
