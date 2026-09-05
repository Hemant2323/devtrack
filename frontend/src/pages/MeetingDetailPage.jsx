import { useState } from "react";
import {
  AlertCircle,
  Archive,
  CalendarClock,
  ChevronRight,
  FileText,
  Pencil,
  Rocket,
  Trash2,
  Video,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { ApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/primitives/Avatar";
import { Badge } from "../components/primitives/Badge";
import { Button } from "../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../components/primitives/Dialog";
import { ErrorState } from "../components/primitives/ErrorState";
import { Skeleton } from "../components/primitives/Skeleton";
import { MeetingDialog } from "../features/meetings/MeetingDialog";
import { formatDuration, formatWhen, isPast } from "../features/meetings/schedule";
import {
  useDeleteMeeting,
  useMeeting,
  useMeetingNotes,
  useUpdateMeeting,
} from "../features/meetings/useMeetings";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useSprints } from "../features/sprints/useSprints";
import { useProjectId } from "../hooks/useProjectId";
import { ROLE } from "../lib/enums";
import { formatDate, formatRelative } from "../lib/format";
import styles from "./MeetingDetailPage.module.css";

/**
 * One meeting.
 *
 * Everything the row could not fit: the full agenda, everyone attending, the
 * sprint it belongs to, and the notes written for it. Whether it has already
 * happened is stated in words, not implied by position in a list.
 *
 * The join button is an ordinary link to whatever URL the organiser pasted.
 * Nothing here reaches a meeting provider.
 */
export function MeetingDetailPage() {
  const pid = useProjectId();
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: meeting, isPending, isError, error, refetch } = useMeeting(meetingId);
  const updateMeeting = useUpdateMeeting(pid, meetingId);
  const deleteMeeting = useDeleteMeeting(pid, meetingId);
  const { data: notes } = useMeetingNotes(pid, meetingId);
  const { members } = useProjectDirectory(pid);
  const { data: sprints } = useSprints(pid);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (isPending) {
    return (
      <div className={styles.page}>
        <div className={styles.skel}>
          <Skeleton width={220} height={11} />
          <Skeleton width="50%" height={26} />
          <Skeleton width="35%" height={13} />
          <Skeleton width="100%" height={13} />
          <Skeleton width="88%" height={13} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <ErrorState
          title={error?.isNotFound ? "Meeting not found" : "Couldn't load this meeting"}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const archived = Boolean(project?.archived);
  const myRole = members.find((member) => member.user_id === user?.id)?.role;
  const isAdmin = myRole === ROLE.ADMIN.value;
  const isOrganizer = meeting.organizer_id === user?.id;
  // Mirrors the backend exactly: organizer edits, organizer or admin deletes.
  const canEdit = isOrganizer && !archived;
  const canDelete = (isOrganizer || isAdmin) && !archived;
  const past = isPast(meeting.scheduled_at);
  const duration = formatDuration(meeting.duration_minutes);

  async function handleDelete() {
    setActionError(null);
    try {
      await deleteMeeting.mutateAsync();
      navigate(`/projects/${pid}/meetings`);
    } catch (err) {
      setConfirmDelete(false);
      setActionError(
        err instanceof ApiError ? err : new ApiError(0, "Could not delete the meeting"),
      );
    }
  }

  return (
    <div className={styles.page}>
      <nav className={styles.crumb}>
        <Link to={`/projects/${pid}`} className={styles.crumbLink}>
          {project?.key ?? "Project"}
        </Link>
        <ChevronRight size={11} aria-hidden="true" />
        <Link to={`/projects/${pid}/meetings`} className={styles.crumbLink}>
          Meetings
        </Link>
        <ChevronRight size={11} aria-hidden="true" />
        <span className={styles.crumbCurrent}>{meeting.title}</span>
      </nav>

      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{meeting.title}</h1>
            <Badge variant={past ? "neutral" : "success"} dot>
              {past ? "Past" : "Upcoming"}
            </Badge>
          </div>
          <p className={styles.when}>
            <CalendarClock size={14} aria-hidden="true" />
            {formatWhen(meeting.scheduled_at, meeting.duration_minutes)}
            {duration && <span className={styles.duration}>· {duration}</span>}
          </p>
        </div>

        <div className={styles.actions}>
          {meeting.meet_url && (
            <a
              className={styles.join}
              href={meeting.meet_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Video size={15} aria-hidden="true" />
              Join Google Meet
            </a>
          )}
          {canEdit && (
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              icon={Trash2}
              iconOnly
              aria-label="Delete meeting"
              onClick={() => setConfirmDelete(true)}
            />
          )}
        </div>
      </header>

      {archived && (
        <p className={styles.notice}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. This meeting is read-only.
        </p>
      )}

      {!archived && !isOrganizer && (
        <p className={styles.notice}>
          <AlertCircle size={15} aria-hidden="true" />
          Only {meeting.organizer_name} can edit this meeting.
          {isAdmin && " As an admin you can still delete it."}
        </p>
      )}

      {actionError && (
        <p className={styles.error} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          {actionError.message}
        </p>
      )}

      <div className={styles.grid}>
        <div className={styles.main}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Agenda</h2>
            <p className={meeting.description ? styles.agenda : styles.agendaEmpty}>
              {meeting.description || "No agenda was written for this meeting."}
            </p>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Notes</h2>
            {(notes ?? []).length === 0 ? (
              <p className={styles.agendaEmpty}>
                No notes are linked to this meeting yet. Write one on the Notes page
                and set this meeting as its context.
              </p>
            ) : (
              <ul className={styles.noteList}>
                {(notes ?? []).map((note) => (
                  <li key={note.id}>
                    <Link to={`/projects/${pid}/notes/${note.id}`} className={styles.noteRow}>
                      <FileText size={13} aria-hidden="true" />
                      <span className={styles.noteTitle}>{note.title}</span>
                      <span className={styles.noteMeta}>{note.author_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className={styles.side}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Participants</h2>
            {meeting.participants.length === 0 ? (
              <p className={styles.agendaEmpty}>Nobody has been listed yet.</p>
            ) : (
              <ul className={styles.people}>
                {meeting.participants.map((participant) => (
                  <li key={participant.user_id} className={styles.person}>
                    <Avatar name={participant.name} size="xs" />
                    <span className={styles.personName}>{participant.name}</span>
                    {participant.user_id === meeting.organizer_id && (
                      <span className={styles.organizerTag}>Organizer</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Details</h2>
            <div className={styles.details}>
              <span className={styles.detailRow}>
                <Avatar name={meeting.organizer_name} size="xs" />
                <span>Organized by {meeting.organizer_name}</span>
              </span>
              {meeting.sprint && (
                <Link to={`/projects/${pid}/sprints`} className={styles.detailLink}>
                  <Rocket size={13} aria-hidden="true" />
                  <span>{meeting.sprint.name}</span>
                </Link>
              )}
              <span className={styles.detailRow} title={formatDate(meeting.created_at)}>
                Created {formatRelative(meeting.created_at)}
              </span>
              <span className={styles.detailRow} title={formatDate(meeting.updated_at)}>
                Updated {formatRelative(meeting.updated_at)}
              </span>
            </div>
          </section>
        </aside>
      </div>

      <MeetingDialog
        open={editing}
        onOpenChange={setEditing}
        meeting={meeting}
        members={members}
        sprints={sprints ?? []}
        currentUserId={user?.id}
        onSubmit={(data) => updateMeeting.mutateAsync(data)}
        isSubmitting={updateMeeting.isPending}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          eyebrow="Meetings"
          title="Delete this meeting?"
          description="It will be removed for everyone on the project. Notes written for it are kept, but lose the link."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="danger" loading={deleteMeeting.isPending} onClick={handleDelete}>
                Delete meeting
              </Button>
            </>
          }
        >
          <p className={styles.confirmTitle}>{meeting.title}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
