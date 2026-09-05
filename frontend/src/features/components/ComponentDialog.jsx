import { useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input } from "../../components/primitives/Input";
import { Select } from "../../components/primitives/Select";
import { useProjectDirectory } from "../projects/useProjectDirectory";
import { useCreateComponent } from "./useComponents";
import styles from "../../pages/ComponentsPage.module.css";

/**
 * Create a component.
 *
 * Mirrors ComponentCreate exactly: a name and an optional default assignee.
 * There is deliberately no edit mode — the API has no PATCH for components, so
 * a dialog that could "save changes" would be a lie.
 *
 * Component names are unique per project, so a duplicate comes back as a 409
 * with a string detail. That is about the name, so it is shown on that field
 * rather than in a banner.
 */
export function ComponentDialog({ pid, open, onOpenChange }) {
  const createComponent = useCreateComponent(pid);
  const { members } = useProjectDirectory(pid);

  const [name, setName] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName("");
      setAssigneeId("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    try {
      await createComponent.mutateAsync({
        name: name.trim(),
        // "" is not a valid id; the schema expects null for "no assignee".
        default_assignee_id: assigneeId ? Number(assigneeId) : null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not create the component"));
    }
  }

  // 409 "Component name already exists in this project" is a string detail, so
  // it arrives form-level — but it belongs on the name input.
  const duplicate = error?.status === 409 ? error.message : null;
  const nameError = error?.fieldError("name") ?? duplicate;
  const bannerError = error && !error.isValidation && !duplicate ? error.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Project"
        title="New component"
        description="Components group issues by area of the product, like Payments or Auth."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              form="component-form"
              variant="primary"
              loading={createComponent.isPending}
              disabled={!name.trim()}
            >
              Create component
            </Button>
          </>
        }
      >
        <form id="component-form" className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Payments"
            maxLength={50}
            error={nameError}
            hint="Must be unique within this project."
            autoFocus
            required
          />

          <Select
            label="Default assignee"
            optional
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            placeholder="None"
            options={members.map((member) => ({
              value: String(member.user_id),
              label: member.name,
            }))}
            error={error?.fieldError("default_assignee_id")}
          />

          <p className={styles.note}>
            <Info size={14} aria-hidden="true" />
            The default assignee is stored for future use — it is recorded against
            the component but nothing assigns issues from it yet. Issues you create
            still take whatever assignee you pick on the issue itself.
          </p>

          {bannerError && (
            <p className={styles.formError} role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              {bannerError}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
