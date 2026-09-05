import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input, Textarea } from "../../components/primitives/Input";
import { useCreateProject } from "./useProjects";
import styles from "./CreateProjectDialog.module.css";

/** "Payments Platform" -> "PAYM". The user can always override. */
function suggestKey(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const raw =
    words.length === 1
      ? words[0].slice(0, 4)
      : words.map((word) => word[0]).join("").slice(0, 4);
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Create a project.
 *
 * The key is permanent and prefixes every issue in the project, so the dialog
 * previews the resulting issue key live rather than explaining the rule in
 * prose. Server validation (409 on a duplicate key, 422 on a malformed one)
 * is surfaced on the field it belongs to via ApiError.fieldErrors.
 */
export function CreateProjectDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);

  // Reset whenever the dialog opens so a previous attempt never leaks in.
  useEffect(() => {
    if (open) {
      setName("");
      setKey("");
      setKeyTouched(false);
      setDescription("");
      setError(null);
    }
  }, [open]);

  const effectiveKey = keyTouched ? key : suggestKey(name);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        key: effectiveKey.toUpperCase(),
        description: description.trim(),
      });
      onOpenChange(false);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not create project"));
    }
  }

  const formMessage = error && !error.isValidation ? error.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Workspace"
        title="New project"
        description="Projects hold issues, members and components. The key is permanent."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              form="create-project-form"
              variant="primary"
              loading={createProject.isPending}
              disabled={!name.trim() || effectiveKey.length < 2}
            >
              Create project
            </Button>
          </>
        }
      >
        <form id="create-project-form" className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.split}>
            <Input
              label="Project name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Payments Platform"
              error={error?.fieldError("name")}
              autoFocus
              required
            />
            <Input
              label="Key"
              value={effectiveKey}
              onChange={(event) => {
                setKeyTouched(true);
                setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              }}
              placeholder="PAY"
              maxLength={10}
              error={error?.fieldError("key")}
              required
            />
          </div>

          <div className={styles.preview}>
            <span className={styles.previewLabel}>Issues will look like</span>
            <span
              className={`${styles.previewKey} ${!effectiveKey ? styles.previewKeyEmpty : ""}`}
            >
              {effectiveKey || "KEY"}-1
            </span>
            <span className={styles.previewHint}>2–10 letters or digits</span>
          </div>

          <Textarea
            label="Description"
            optional
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does this project cover?"
            rows={3}
            error={error?.fieldError("description")}
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
