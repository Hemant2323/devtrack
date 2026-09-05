import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input } from "../../components/primitives/Input";
import { cn } from "../../lib/cn";
import { NOTE_TEMPLATES, templateById } from "./templates";
import { useCreateNote } from "./useNotes";
import styles from "./CreateNoteDialog.module.css";

/**
 * Start a note.
 *
 * The template is a starting point and nothing more: it fills the title and
 * body, the note is created, and the editor opens with every character
 * editable. There is no template record, no locked structure and no
 * management screen — which is what keeps this a documentation feature
 * rather than a document system.
 */
export function CreateNoteDialog({ pid, open, onOpenChange }) {
  const navigate = useNavigate();
  const createNote = useCreateNote(pid);
  const [templateId, setTemplateId] = useState("blank");
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const titleRef = useRef(null);

  // Each opening starts clean rather than resuming the last attempt.
  useEffect(() => {
    if (open) {
      setTemplateId("blank");
      setTitle("");
      setError(null);
    }
  }, [open]);

  function pickTemplate(id) {
    setTemplateId(id);
    const template = templateById(id);
    // Only overwrite a title the user has not made their own.
    setTitle((current) =>
      current === "" || NOTE_TEMPLATES.some((t) => t.title === current)
        ? template.title
        : current,
    );
  }

  async function handleCreate() {
    const template = templateById(templateId);
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const note = await createNote.mutateAsync({
        title: trimmed,
        content: template.content,
        note_type: template.noteType,
      });
      onOpenChange(false);
      navigate(`/projects/${pid}/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not create the note"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Notes"
        title="New note"
        description="Pick a starting point. Everything it fills in is editable."
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              loading={createNote.isPending}
              disabled={!title.trim()}
              onClick={handleCreate}
            >
              Create note
            </Button>
          </>
        }
      >
        <Input
          ref={titleRef}
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="What is this note about?"
          error={error?.fieldError("title")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleCreate();
            }
          }}
        />

        <fieldset className={styles.templates}>
          <legend className={styles.legend}>Template</legend>
          <div className={styles.grid}>
            {NOTE_TEMPLATES.map((template) => (
              <label
                key={template.id}
                className={cn(
                  styles.template,
                  templateId === template.id && styles.templateActive,
                )}
              >
                <input
                  type="radio"
                  name="note-template"
                  value={template.id}
                  checked={templateId === template.id}
                  onChange={() => pickTemplate(template.id)}
                  className={styles.radio}
                />
                <span className={styles.templateText}>
                  <span className={styles.templateLabel}>{template.label}</span>
                  <span className={styles.templateHint}>{template.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && !error.fieldError("title") && (
          <p className={styles.error} role="alert">
            {error.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
