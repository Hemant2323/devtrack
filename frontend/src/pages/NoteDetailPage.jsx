import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  ChevronRight,
  ExternalLink,
  CalendarClock,
  Rocket,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { ApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/primitives/Avatar";
import { Button } from "../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../components/primitives/Dialog";
import { ErrorState } from "../components/primitives/ErrorState";
import { Input, Textarea } from "../components/primitives/Input";
import { Select } from "../components/primitives/Select";
import { Skeleton } from "../components/primitives/Skeleton";
import { IssueKey } from "../components/domain/IssueAtoms";
import { useIssueList } from "../features/issues/useIssues";
import { useMeetings } from "../features/meetings/useMeetings";
import { formatWhen } from "../features/meetings/schedule";
import { useDeleteNote, useNote, useUpdateNote } from "../features/notes/useNotes";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useSprints } from "../features/sprints/useSprints";
import { useProjectId } from "../hooks/useProjectId";
import { NOTE_TYPE, ROLE } from "../lib/enums";
import { formatDate, formatRelative } from "../lib/format";
import styles from "./NoteDetailPage.module.css";

/**
 * One note.
 *
 * A plain title, a plain type, and a plain multiline body — no blocks, no
 * slash commands, no rich text. The linked issue and sprint are references
 * resolved by the server, so a note never holds a stale copy of the work it
 * describes, and a link whose target is gone simply stops appearing.
 *
 * Saving is explicit rather than automatic: this is documentation someone is
 * composing, and an accidental keystroke should not be published for the team.
 */
export function NoteDetailPage() {
  const pid = useProjectId();
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: note, isPending, isError, error, refetch } = useNote(noteId);
  const updateNote = useUpdateNote(pid, noteId);
  const deleteNote = useDeleteNote(pid, noteId);
  const { members } = useProjectDirectory(pid);
  const { data: sprints } = useSprints(pid);
  const { data: issues } = useIssueList(pid, {});
  // Every meeting in the project, unscoped — a note can belong to a past
  // one as easily as an upcoming one.
  const { data: meetings } = useMeetings(pid);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const [draft, setDraft] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Load the note into the editor once it arrives, and again if a different
     note is opened. Not on every change of `note`, or a save's own response
     would overwrite whatever was typed while it was in flight. */
  useEffect(() => {
    if (!note) return;
    setDraft({
      title: note.title,
      content: note.content,
      note_type: note.note_type,
      issue_id: note.issue?.id ?? "",
      sprint_id: note.sprint?.id ?? "",
      meeting_id: note.meeting?.id ?? "",
    });
    setSaveError(null);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const archived = Boolean(project?.archived);
  const myRole = members.find((member) => member.user_id === user?.id)?.role;
  const isAdmin = myRole === ROLE.ADMIN.value;
  const isAuthor = note?.author_id === user?.id;
  // Matches the backend exactly: author edits, author or admin deletes.
  const canEdit = isAuthor && !archived;
  const canDelete = (isAuthor || isAdmin) && !archived;

  const dirty = useMemo(() => {
    if (!note || !draft) return false;
    return (
      draft.title !== note.title ||
      draft.content !== note.content ||
      draft.note_type !== note.note_type ||
      String(draft.issue_id) !== String(note.issue?.id ?? "") ||
      String(draft.sprint_id) !== String(note.sprint?.id ?? "") ||
      String(draft.meeting_id) !== String(note.meeting?.id ?? "")
    );
  }, [note, draft]);

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (!draft.title.trim() || !draft.content.trim()) return;
    setSaveError(null);
    try {
      await updateNote.mutateAsync({
        title: draft.title.trim(),
        content: draft.content,
        note_type: draft.note_type,
        issue_id: draft.issue_id === "" ? null : Number(draft.issue_id),
        sprint_id: draft.sprint_id === "" ? null : Number(draft.sprint_id),
        meeting_id: draft.meeting_id === "" ? null : Number(draft.meeting_id),
      });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new ApiError(0, "Could not save the note"));
    }
  }

  async function handleDelete() {
    setSaveError(null);
    try {
      await deleteNote.mutateAsync();
      navigate(`/projects/${pid}/notes`);
    } catch (err) {
      setConfirmDelete(false);
      setSaveError(err instanceof ApiError ? err : new ApiError(0, "Could not delete the note"));
    }
  }

  if (isPending || !draft) {
    return (
      <div className={styles.page}>
        <div className={styles.skel}>
          <Skeleton width={200} height={11} />
          <Skeleton width="55%" height={26} />
          <Skeleton width="100%" height={13} />
          <Skeleton width="90%" height={13} />
          <Skeleton width="95%" height={13} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <ErrorState
          title={error?.isNotFound ? "Note not found" : "Couldn't load this note"}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.crumb}>
        <Link to={`/projects/${pid}`} className={styles.crumbLink}>
          {project?.key ?? "Project"}
        </Link>
        <ChevronRight size={11} aria-hidden="true" />
        <Link to={`/projects/${pid}/notes`} className={styles.crumbLink}>
          Notes
        </Link>
        <ChevronRight size={11} aria-hidden="true" />
        <span className={styles.crumbCurrent}>{note.title}</span>
      </nav>

      {archived && (
        <p className={styles.notice}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. This note is read-only.
        </p>
      )}

      {!archived && !isAuthor && (
        <p className={styles.notice}>
          <AlertCircle size={15} aria-hidden="true" />
          Only {note.author_name} can edit this note.
          {isAdmin && " As an admin you can still delete it."}
        </p>
      )}

      {saveError && (
        <p className={styles.error} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          {saveError.message}
        </p>
      )}

      <div className={styles.grid}>
        <div className={styles.main}>
          <Input
            label="Title"
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
            maxLength={200}
            disabled={!canEdit}
            error={saveError?.fieldError("title")}
          />

          <Textarea
            label="Content"
            value={draft.content}
            onChange={(event) => set("content", event.target.value)}
            rows={20}
            maxLength={50000}
            disabled={!canEdit}
            className={styles.editor}
            error={saveError?.fieldError("content")}
            hint={canEdit ? "Plain text. Line breaks are kept exactly as typed." : undefined}
          />

          {canEdit && (
            <div className={styles.saveRow}>
              <span className={styles.saveState} aria-live="polite">
                {updateNote.isPending
                  ? "Saving…"
                  : dirty
                    ? "Unsaved changes"
                    : `Saved · updated ${formatRelative(note.updated_at)}`}
              </span>
              <Button
                variant="primary"
                loading={updateNote.isPending}
                disabled={!dirty || !draft.title.trim() || !draft.content.trim()}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>
          )}
        </div>

        <aside className={styles.side}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Details</h2>

            <Select
              label="Type"
              value={draft.note_type}
              onChange={(event) => set("note_type", event.target.value)}
              disabled={!canEdit}
              options={Object.values(NOTE_TYPE).map((type) => ({
                value: type.value,
                label: type.label,
              }))}
            />

            <Select
              label="Related issue"
              optional
              value={String(draft.issue_id)}
              onChange={(event) => set("issue_id", event.target.value)}
              disabled={!canEdit}
              placeholder="None"
              /* This project's issues only — the same list the Issues page
                 already caches, so opening a note costs no extra request. */
              options={(issues ?? []).map((issue) => ({
                value: String(issue.id),
                label: `${issue.key} — ${issue.title}`,
              }))}
            />

            <Select
              label="Related sprint"
              optional
              value={String(draft.sprint_id)}
              onChange={(event) => set("sprint_id", event.target.value)}
              disabled={!canEdit}
              placeholder="None"
              options={(sprints ?? []).map((sprint) => ({
                value: String(sprint.id),
                label: sprint.name,
              }))}
            />

            <Select
              label="Related meeting"
              optional
              value={String(draft.meeting_id)}
              onChange={(event) => set("meeting_id", event.target.value)}
              disabled={!canEdit}
              placeholder="None"
              options={(meetings ?? []).map((meeting) => ({
                value: String(meeting.id),
                label: `${meeting.title} — ${formatWhen(meeting.scheduled_at)}`,
              }))}
            />

            {/* Saved links, resolved by the server. A link whose target was
                deleted is simply absent rather than shown as a dead end. */}
            {(note.issue || note.sprint || note.meeting) && (
              <div className={styles.links}>
                {note.issue && (
                  <Link
                    to={`/projects/${pid}/issues/${note.issue.id}`}
                    className={styles.linkRow}
                  >
                    <IssueKey>{note.issue.key}</IssueKey>
                    <span className={styles.linkTitle}>{note.issue.title}</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </Link>
                )}
                {note.sprint && (
                  <Link to={`/projects/${pid}/sprints`} className={styles.linkRow}>
                    <Rocket size={12} aria-hidden="true" />
                    <span className={styles.linkTitle}>{note.sprint.name}</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </Link>
                )}
                {note.meeting && (
                  <Link
                    to={`/projects/${pid}/meetings/${note.meeting.id}`}
                    className={styles.linkRow}
                  >
                    <CalendarClock size={12} aria-hidden="true" />
                    <span className={styles.linkTitle}>{note.meeting.title}</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>About</h2>
            <div className={styles.about}>
              <span className={styles.aboutRow}>
                <Avatar name={note.author_name} size="xs" />
                <span>{note.author_name}</span>
              </span>
              <span className={styles.aboutRow} title={formatDate(note.created_at)}>
                Created {formatRelative(note.created_at)}
              </span>
              <span className={styles.aboutRow} title={formatDate(note.updated_at)}>
                Updated {formatRelative(note.updated_at)}
              </span>
            </div>

            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                block
                onClick={() => setConfirmDelete(true)}
              >
                Delete note
              </Button>
            )}
          </section>
        </aside>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          eyebrow="Notes"
          title="Delete this note?"
          description="It will be removed for everyone on the project. This can't be undone."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="danger" loading={deleteNote.isPending} onClick={handleDelete}>
                Delete note
              </Button>
            </>
          }
        >
          <p className={styles.confirmTitle}>{note.title}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
