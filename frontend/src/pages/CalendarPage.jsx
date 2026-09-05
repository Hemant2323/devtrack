import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Skeleton } from "../components/primitives/Skeleton";
import { CalendarEventDialog } from "../features/calendar/CalendarEventDialog";
import { EntryDialog } from "../features/calendar/EntryDialog";
import { ENTRY_TYPE_LIST, entryTypeOf } from "../features/calendar/entryTypes";
import {
  addMonths,
  entryTime,
  gridRange,
  groupByDay,
  localDayKey,
  monthGrid,
  monthLabel,
  weekdayLabels,
} from "../features/calendar/monthGrid";
import {
  useCalendar,
  useCalendarEvent,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useRescheduleEntry,
  useUpdateCalendarEvent,
} from "../features/calendar/useCalendar";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useAuth } from "../auth/AuthContext";
import { useProjectId } from "../hooks/useProjectId";
import { ROLE } from "../lib/enums";
import { cn } from "../lib/cn";
import styles from "./CalendarPage.module.css";

/** How many chips fit in a day cell before the rest are summarised. */
const MAX_PER_DAY = 3;

function EntryChip({ entry, onOpen }) {
  const meta = entryTypeOf(entry.type);
  const time = entryTime(entry);
  return (
    <button
      type="button"
      className={styles.chip}
      style={{ "--chip-fg": meta.fg, "--chip-bg": meta.bg }}
      onClick={() => onOpen(entry)}
      title={`${meta.label}: ${entry.title}`}
    >
      <span className={styles.chipDot} aria-hidden="true" />
      {time && <span className={styles.chipTime}>{time}</span>}
      <span className={styles.chipTitle}>
        {entry.reference ? `${entry.reference} ` : ""}
        {entry.title}
      </span>
      {/* The type is colour-coded, so it is also named for anyone who cannot
          use the colour. */}
      <span className="sr-only">({meta.label})</span>
    </button>
  );
}

/**
 * Project calendar.
 *
 * A view over data that already exists: issues, test cases, sprints, meetings
 * and the calendar's own custom events, aggregated server-side per visible
 * window. Nothing is copied — a date changed anywhere else is already changed
 * here on the next read.
 *
 * A month grid built from plain CSS grid and date arithmetic (see
 * monthGrid.js). No calendar library was added: six rows of seven days is a
 * loop, and a dependency would have been the larger commitment.
 */
export function CalendarPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [hidden, setHidden] = useState(() => new Set());
  const [openEntry, setOpenEntry] = useState(null);
  const [eventDialog, setEventDialog] = useState(null); // { event? , dayKey? }

  const range = useMemo(() => gridRange(cursor.year, cursor.month), [cursor]);
  const activeTypes = useMemo(
    () => ENTRY_TYPE_LIST.map((t) => t.value).filter((value) => !hidden.has(value)),
    [hidden],
  );

  const { data: entries, isPending, isError, error, refetch, isFetching } = useCalendar(
    pid,
    range,
    // All types active is the same as no filter; sending none keeps the key
    // stable and lets the server skip the filter entirely.
    activeTypes.length === ENTRY_TYPE_LIST.length ? null : activeTypes,
  );

  const reschedule = useRescheduleEntry(pid);
  const createEvent = useCreateCalendarEvent(pid);
  const updateEvent = useUpdateCalendarEvent(pid);
  const deleteEvent = useDeleteCalendarEvent(pid);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const { members } = useProjectDirectory(pid);
  const archived = Boolean(project?.archived);
  const isAdmin =
    members.find((member) => member.user_id === user?.id)?.role === ROLE.ADMIN.value;
  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const byDay = useMemo(() => groupByDay(entries), [entries]);
  const todayKey = localDayKey(today);
  const weekdays = useMemo(() => weekdayLabels(), []);
  const nothing = !isPending && !isError && (entries ?? []).length === 0;

  function toggleType(value) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function openEntryDialog(entry) {
    // A custom event is edited in place; everything else opens the entry
    // dialog, which offers its date and a link to its own page.
    if (entry.type === "CUSTOM") {
      setEventDialog({ eventId: entry.source_id, editable: entry.editable });
    } else {
      setOpenEntry(entry);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Calendar`}
        title="Calendar"
        description="Everything in this project with a date on it — issues, test cases, sprints, meetings and your own events."
        actions={
          !archived ? (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setEventDialog({ dayKey: todayKey })}
            >
              New event
            </Button>
          ) : null
        }
      />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <div className={styles.nav}>
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              icon={ChevronLeft}
              aria-label="Previous month"
              onClick={() => setCursor((c) => addMonths(c.year, c.month, -1))}
            />
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              icon={ChevronRight}
              aria-label="Next month"
              onClick={() => setCursor((c) => addMonths(c.year, c.month, 1))}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setCursor({ year: today.getFullYear(), month: today.getMonth() })
              }
            >
              Today
            </Button>
            <h2 className={styles.month} aria-live="polite">
              {monthLabel(cursor.year, cursor.month)}
            </h2>
            {isFetching && !isPending && <span className={styles.loading}>Updating…</span>}
          </div>

          <div className={styles.filters} role="group" aria-label="Filter event types">
            {ENTRY_TYPE_LIST.map((type) => {
              const on = !hidden.has(type.value);
              return (
                <button
                  key={type.value}
                  type="button"
                  className={cn(styles.filter, !on && styles.filterOff)}
                  style={{ "--chip-fg": type.fg, "--chip-bg": type.bg }}
                  aria-pressed={on}
                  onClick={() => toggleType(type.value)}
                >
                  <span className={styles.filterDot} aria-hidden="true" />
                  {type.plural}
                </button>
              );
            })}
          </div>
        </div>

        {isError && (
          <ErrorState
            title="Couldn't load the calendar"
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {!isError && (
          <div className={styles.calendar}>
            <div className={styles.weekdays} aria-hidden="true">
              {weekdays.map((label) => (
                <span key={label} className={styles.weekday}>
                  {label}
                </span>
              ))}
            </div>

            <div className={styles.grid}>
              {days.map((day) => {
                const dayEntries = byDay.get(day.key) ?? [];
                const shown = dayEntries.slice(0, MAX_PER_DAY);
                const extra = dayEntries.length - shown.length;
                const isToday = day.key === todayKey;

                return (
                  <div
                    key={day.key}
                    className={cn(
                      styles.day,
                      !day.inMonth && styles.dayOutside,
                      isToday && styles.dayToday,
                    )}
                  >
                    <div className={styles.dayHead}>
                      <span className={cn(styles.dayNumber, isToday && styles.todayNumber)}>
                        {day.date.getDate()}
                      </span>
                      {isToday && <span className="sr-only">Today</span>}
                      {!archived && (
                        <button
                          type="button"
                          className={styles.addDay}
                          aria-label={`Add an event on ${day.key}`}
                          onClick={() => setEventDialog({ dayKey: day.key })}
                        >
                          <Plus size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div className={styles.dayBody}>
                      {isPending
                        ? day.inMonth && <Skeleton width="80%" height={14} />
                        : shown.map((entry) => (
                            <EntryChip
                              key={`${day.key}:${entry.id}`}
                              entry={entry}
                              onOpen={openEntryDialog}
                            />
                          ))}
                      {extra > 0 && <span className={styles.more}>+{extra} more</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {nothing && (
          <div className={styles.empty}>
            <EmptyState
              icon={CalendarDays}
              title="Nothing dated this month"
              description={
                hidden.size
                  ? "No entries of the types you have shown. Turn a filter back on to see more."
                  : "Give an issue a due date, schedule a meeting, or add an event of your own."
              }
            />
          </div>
        )}
      </div>

      <EntryDialog
        pid={pid}
        entry={openEntry}
        open={Boolean(openEntry)}
        onOpenChange={(next) => !next && setOpenEntry(null)}
        onReschedule={(vars) => reschedule.mutateAsync(vars)}
        isSaving={reschedule.isPending}
      />

      {eventDialog && (
        <CustomEventDialogHost
          state={eventDialog}
          onClose={() => setEventDialog(null)}
          canDeleteAny={isAdmin && !archived}
          createEvent={createEvent}
          updateEvent={updateEvent}
          deleteEvent={deleteEvent}
        />
      )}
    </>
  );
}

/**
 * Loads the event being edited, if any, before showing the dialog.
 *
 * Mounted only while the dialog is open so viewing the calendar never fetches
 * an event nobody asked for.
 */
function CustomEventDialogHost({
  state,
  onClose,
  canDeleteAny,
  createEvent,
  updateEvent,
  deleteEvent,
}) {
  const { data: event } = useCalendarEvent(state.eventId);
  const editing = Boolean(state.eventId);
  if (editing && !event) return null;

  return (
    <CalendarEventDialog
      open
      onOpenChange={(next) => !next && onClose()}
      event={editing ? event : null}
      defaultDayKey={state.dayKey ?? ""}
      /* Matches the backend: the creator, or a project admin. */
      canDelete={state.editable !== false || canDeleteAny}
      isSubmitting={createEvent.isPending || updateEvent.isPending}
      isDeleting={deleteEvent.isPending}
      onSubmit={(data) =>
        editing
          ? updateEvent.mutateAsync({ eventId: state.eventId, patch: data })
          : createEvent.mutateAsync(data)
      }
      onDelete={() => deleteEvent.mutateAsync(state.eventId)}
    />
  );
}
