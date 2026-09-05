import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input, Textarea } from "../../components/primitives/Input";
import { Select } from "../../components/primitives/Select";
import { useCreateTestCase, useUpdateTestCase } from "./useTesting";
import styles from "./Testing.module.css";

const EMPTY = {
  title: "",
  preconditions: "",
  steps: "",
  expected_result: "",
  issue_id: "",
};

/**
 * Create or edit a test case.
 *
 * The fields are exactly the ones FR-9.1 names — title, preconditions, steps,
 * expected result — plus the optional link to an issue this case verifies.
 * Nothing else is offered, because nothing else exists on the schema.
 */
export function TestCaseDialog({ pid, testCase = null, issues = [], open, onOpenChange }) {
  const isEdit = Boolean(testCase);
  const createCase = useCreateTestCase(pid);
  const updateCase = useUpdateTestCase(pid, testCase?.id);
  const mutation = isEdit ? updateCase : createCase;

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      testCase
        ? {
            title: testCase.title ?? "",
            preconditions: testCase.preconditions ?? "",
            steps: testCase.steps ?? "",
            expected_result: testCase.expected_result ?? "",
            issue_id: testCase.issue_id ? String(testCase.issue_id) : "",
          }
        : EMPTY,
    );
  }, [open, testCase]);

  const set = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const payload = {
      title: form.title.trim(),
      preconditions: form.preconditions.trim(),
      steps: form.steps.trim(),
      expected_result: form.expected_result.trim(),
      // "" means no link; the API expects null to clear it.
      issue_id: form.issue_id ? Number(form.issue_id) : null,
    };
    try {
      await mutation.mutateAsync(payload);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not save the test case"));
    }
  }

  const formMessage = error && !error.isValidation ? error.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Project"
        title={isEdit ? "Edit test case" : "New test case"}
        description="A repeatable check. Link it to an issue if it verifies one."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              form="test-case-form"
              variant="primary"
              loading={mutation.isPending}
              disabled={!form.title.trim()}
            >
              {isEdit ? "Save changes" : "Create test case"}
            </Button>
          </>
        }
      >
        <form id="test-case-form" className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Title"
            value={form.title}
            onChange={set("title")}
            placeholder="Checkout applies a valid coupon"
            maxLength={200}
            error={error?.fieldError("title")}
            autoFocus
            required
          />

          <Textarea
            label="Preconditions"
            optional
            value={form.preconditions}
            onChange={set("preconditions")}
            placeholder="What must be true before the steps begin?"
            rows={2}
            error={error?.fieldError("preconditions")}
          />

          <Textarea
            label="Steps"
            optional
            value={form.steps}
            onChange={set("steps")}
            placeholder={"1. Add an item to the basket\n2. Apply the coupon\n3. Select UPI"}
            rows={4}
            error={error?.fieldError("steps")}
            hint="These carry over to a bug raised from a failed run."
          />

          <Textarea
            label="Expected result"
            optional
            value={form.expected_result}
            onChange={set("expected_result")}
            placeholder="What should happen if the software is correct?"
            rows={2}
            error={error?.fieldError("expected_result")}
          />

          <Select
            label="Verifies issue"
            optional
            value={form.issue_id}
            onChange={set("issue_id")}
            placeholder="Not linked to an issue"
            options={issues.map((issue) => ({
              value: String(issue.id),
              label: `${issue.key} — ${issue.title}`,
            }))}
            error={error?.fieldError("issue_id")}
          />

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
