import { useState } from "react";
import { CalendarClock, Plus, Rocket, Users, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { AvatarStack } from "../components/domain/AvatarStack";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Skeleton } from "../components/primitives/Skeleton";
import { MeetingDialog } from "../features/meetings/MeetingDialog";
import { formatDuration, formatWhen } from "../features/meetings/schedule";
import { useCreateMeeting, useMeetings } from "../features/meetings/useMeetings";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useSprints } from "../features/sprints/useSprints";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import styles from "./MeetingsPage.module.css";

/** First non-empty line of the agenda, as the row's one-line preview. */
function agendaPreview(description) {
  return (description ?? "").split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

function SkeletonRows({ count = 2 }) {
  return Array.from({ length: count }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={`${30 + ((i * 17) % 25)}%`} height={14} />
      <Skeleton width="45%" height={12} />
      <Skeleton width={140} height={11} />
    </div>
  ));
}

function MeetingRow({ pid, meeting, past }) {
  const duration = formatDuration(meeting.duration_minutes);
  return (
    <li>
      <div className={cn(styles.row, past && styles.rowPast)}>
        <Link to={`/projects/${pid}/meetings/${meeting.id}`} className={styles.rowMain}>
          <div className={styles.rowTop}>
            <span className={styles.title}>{meeting.title}</span>
            <span className={styles.when}>{formatWhen(meeting.scheduled_at, meeting.duration_minutes)}</span>
          </div>

          {agendaPreview(meeting.description) && (
            <p className={styles.preview}>{agendaPreview(meeting.description)}</p>
          )}

          <div className={styles.meta}>
            <span className={styles.organizer}>{meeting.organizer_name}</span>
            {duration && (
              <>
                <span className={styles.dot} aria-hidden="true">·</span>
                <span>{duration}</span>
              </>
            )}
            {meeting.sprint && (
              <span className={styles.tag}>
                <Rocket size={11} aria-hidden="true" />
                {meeting.sprint.name}
              </span>
            )}
            {meeting.participants.length > 0 && (
              <span className={styles.people}>
                <Users size={11} aria-hidden="true" />
                <AvatarStack members={meeting.participants} size="xs" max={4} />
              </span>
            )}
          </div>
        </Link>

        {/* Opening the call is a link, not a fetch — this app never talks to
            the meeting provider. rel guards the new tab from the opener. */}
        {meeting.meet_url && (
          <a
            className={styles.join}
            href={meeting.meet_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Video size={14} aria-hidden="true" />
            Join
          </a>
        )}
      </div>
    </li>
  );
}

function Section({ title, count, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        {count > 0 && <span className={styles.count}>{count}</span>}
      </h2>
      {children}
    </section>
  );
}

/**
 * Project meetings.
 *
 * Two sections from two scoped requests, so each arrives already ordered the
 * way it is read: upcoming counts forward from the next one, past counts back
 * from the most recent.
 *
 * Deliberately not a calendar: no grid, no recurrence, no invitations. A
 * meeting is a row with a time, an agenda, some people, and — when someone
 * pasted one — a link to open.
 */
export function MeetingsPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  const upcoming = useMeetings(pid, "upcoming");
  const past = useMeetings(pid, "past");
  const createMeeting = useCreateMeeting(pid);
  const { members } = useProjectDirectory(pid);
  const { data: sprints } = useSprints(pid);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);
  const isPending = upcoming.isPending || past.isPending;
  const isError = upcoming.isError || past.isError;
  const error = upcoming.error ?? past.error;
  const upcomingList = upcoming.data ?? [];
  const pastList = past.data ?? [];
  const nothingAtAll = !isPending && !isError && !upcomingList.length && !pastList.length;

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Meetings`}
        title="Meetings"
        description="Scheduled conversations for this project, with agendas and a link to join."
        actions={
          !archived ? (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New meeting
            </Button>
          ) : null
        }
      />

      <div className={styles.body}>
        {isError && (
          <ErrorState
            title="Couldn't load meetings"
            error={error}
            onRetry={() => {
              upcoming.refetch();
              past.refetch();
            }}
          />
        )}

        {isPending && (
          <Section title="Upcoming">
            <div className={styles.list}>
              <SkeletonRows />
            </div>
          </Section>
        )}

        {nothingAtAll && (
          <EmptyState
            icon={CalendarClock}
            title="No meetings yet"
            description={
              archived
                ? "This project is archived, so no new meetings can be scheduled."
                : "Schedule a standup, a planning session or a retro — and paste the call link so everyone can join."
            }
            action={
              !archived ? (
                <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                  New meeting
                </Button>
              ) : null
            }
          />
        )}

        {!isPending && !isError && !nothingAtAll && (
          <>
            <Section title="Upcoming" count={upcomingList.length}>
              {upcomingList.length === 0 ? (
                <p className={styles.sectionEmpty}>Nothing scheduled.</p>
              ) : (
                <ul className={styles.list}>
                  {upcomingList.map((meeting) => (
                    <MeetingRow key={meeting.id} pid={pid} meeting={meeting} />
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Past" count={pastList.length}>
              {pastList.length === 0 ? (
                <p className={styles.sectionEmpty}>No meetings have happened yet.</p>
              ) : (
                <ul className={styles.list}>
                  {pastList.map((meeting) => (
                    <MeetingRow key={meeting.id} pid={pid} meeting={meeting} past />
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </div>

      <MeetingDialog
        open={creating}
        onOpenChange={setCreating}
        members={members}
        sprints={sprints ?? []}
        currentUserId={user?.id}
        onSubmit={(data) => createMeeting.mutateAsync(data)}
        isSubmitting={createMeeting.isPending}
      />
    </>
  );
}
