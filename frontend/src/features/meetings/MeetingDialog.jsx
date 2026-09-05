import { useEffect, useMemo, useRef, useState } from "react";
import { Video } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Avatar } from "../../components/primitives/Avatar";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input, Textarea } from "../../components/primitives/Input";
import { Select } from "../../components/primitives/Select";
import { cn } from "../../lib/cn";
import { defaultSlot, fromLocalParts, toLocalParts } from "./schedule";
import styles from "./MeetingDialog.module.css";

const EMPTY = {
  title: "",
  description: "",
  date: "",
  time: "",
  duration_minutes: "",
  meet_url: "",
  sprint_id: "",
  participant_ids: [],
};

/**
 * Schedule or edit a meeting.
 *
 * One dialog for both, because the fields are identical and two nearly-equal
 * forms drift apart. Date and time are separate native inputs — they give
 * keyboard entry and the platform picker for free, and the pair is converted
 * to a single UTC instant in one place (see schedule.js).
 *
 * The video link is pasted by hand. This app never creates, joins or reads a
 * call; it stores a string and later offers to open it.
 */
export function MeetingDialog({
  open,
  onOpenChange,
  meeting = null,
  members = [],
  sprints = [],
  currentUserId,
  onSubmit,
  isSubmitting = false,
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);
  const editing = Boolean(meeting);

  /* Each opening loads the meeting being edited, or a sensible blank: an hour
     from now, with the organiser already listed as attending. */
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (meeting) {
      const { date, time } = toLocalParts(meeting.scheduled_at);
      setForm({
        title: meeting.title,
        description: meeting.description ?? "",
        date,
        time,
        duration_minutes: meeting.duration_minutes ?? "",
        meet_url: meeting.meet_url ?? "",
        sprint_id: meeting.sprint?.id ?? "",
        participant_ids: meeting.participants.map((p) => p.user_id),
      });
    } else {
      const slot = defaultSlot();
      setForm({
        ...EMPTY,
        ...slot,
        participant_ids: currentUserId ? [currentUserId] : [],
      });
    }
  }, [open, meeting, currentUserId]);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  function toggleParticipant(userId) {
    setForm((current) => ({
      ...current,
      participant_ids: current.participant_ids.includes(userId)
        ? current.participant_ids.filter((id) => id !== userId)
        : [...current.participant_ids, userId],
    }));
  }

  const scheduledAt = useMemo(
    () => fromLocalParts(form.date, form.time),
    [form.date, form.time],
  );
  const canSubmit = Boolean(form.title.trim()) && Boolean(scheduledAt);

  /* Whatever the error does not already say under a field: a model-level
     rejection (a cross-project sprint, a participant who is not a member), or
     a plain failure like 403 on an archived project. */
  const formError =
    error?.fieldError("_form") ??
    (error && Object.keys(error.fieldErrors).length === 0 ? error.message : null);

  async function handleSubmit(event) {
    event?.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description,
        scheduled_at: scheduledAt,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        meet_url: form.meet_url.trim() ? form.meet_url.trim() : null,
        sprint_id: form.sprint_id === "" ? null : Number(form.sprint_id),
        participant_ids: form.participant_ids,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not save the meeting"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Meetings"
        title={editing ? "Edit meeting" : "New meeting"}
        description={
          editing
            ? "Change the details everyone on this project can see."
            : "Schedule a conversation and list who should be there."
        }
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
              loading={isSubmitting}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {editing ? "Save changes" : "Schedule meeting"}
            </Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            ref={titleRef}
            label="Title"
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            maxLength={200}
            placeholder="Sprint planning"
            error={error?.fieldError("title")}
          />

          <div className={styles.row}>
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(event) => set("date", event.target.value)}
              error={error?.fieldError("scheduled_at")}
            />
            <Input
              label="Time"
              type="time"
              value={form.time}
              onChange={(event) => set("time", event.target.value)}
            />
            <Input
              label="Duration"
              type="number"
              optional
              min={1}
              max={1440}
              step={5}
              value={form.duration_minutes}
              onChange={(event) => set("duration_minutes", event.target.value)}
              placeholder="30"
              hint="Minutes"
              error={error?.fieldError("duration_minutes")}
            />
          </div>

          <Textarea
            label="Agenda"
            optional
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            rows={5}
            maxLength={20000}
            placeholder={"What will be covered?\n- …"}
            error={error?.fieldError("description")}
          />

          <fieldset className={styles.participants}>
            <legend className={styles.legend}>Participants</legend>
            {members.length === 0 ? (
              <p className={styles.note}>This project has no members to invite yet.</p>
            ) : (
              <div className={styles.people}>
                {members.map((member) => {
                  const selected = form.participant_ids.includes(member.user_id);
                  return (
                    <label
                      key={member.user_id}
                      className={cn(styles.person, selected && styles.personSelected)}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleParticipant(member.user_id)}
                        className={styles.checkbox}
                      />
                      <Avatar name={member.name} size="xs" />
                      <span className={styles.personName}>{member.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className={styles.row}>
            <Select
              label="Related sprint"
              optional
              value={String(form.sprint_id)}
              onChange={(event) => set("sprint_id", event.target.value)}
              placeholder="None"
              options={sprints.map((sprint) => ({
                value: String(sprint.id),
                label: sprint.name,
              }))}
            />
          </div>

          <Input
            label="Video call link"
            optional
            type="url"
            icon={Video}
            value={form.meet_url}
            onChange={(event) => set("meet_url", event.target.value)}
            maxLength={500}
            placeholder="https://meet.google.com/…"
            hint="Paste a link you created in Google Meet, Zoom or anywhere else."
            error={error?.fieldError("meet_url")}
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
