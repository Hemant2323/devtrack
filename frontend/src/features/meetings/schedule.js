/**
 * Turning one instant into the two fields a form needs, and back.
 *
 * The API stores and returns UTC. People schedule in the timezone they are
 * sitting in. These are the only two places that conversion happens, so a date
 * picker and a list row can never disagree about what "14:00" meant.
 *
 * Pure functions with no React and no dates of their own beyond `now`, so the
 * behaviour is checkable without a browser.
 */

const pad = (n) => String(n).padStart(2, "0");

/** UTC ISO -> the local `date` and `time` an <input> expects. */
export function toLocalParts(iso) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: "", time: "" };
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

/**
 * Local `date` + `time` -> a UTC ISO string.
 *
 * Built through the Date constructor rather than by string concatenation so
 * the browser applies its own offset — including the day a clock changes,
 * where naive arithmetic would be an hour out.
 */
export function fromLocalParts(date, time) {
  if (!date || !time) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const at = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** The date and time an hour from now, rounded up to the next half hour. */
export function defaultSlot(now = new Date()) {
  const at = new Date(now.getTime() + 60 * 60 * 1000);
  at.setSeconds(0, 0);
  at.setMinutes(at.getMinutes() > 30 ? 60 : 30);
  return toLocalParts(at.toISOString());
}

export function isPast(iso, now = new Date()) {
  const at = new Date(iso);
  return !Number.isNaN(at.getTime()) && at.getTime() < now.getTime();
}

const DAY = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/** "Wed 10 Sep · 14:00–14:45", or without the end when there is no duration. */
export function formatWhen(iso, durationMinutes) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const start = `${DAY.format(at)} · ${TIME.format(at)}`;
  if (!durationMinutes) return start;
  const end = new Date(at.getTime() + durationMinutes * 60 * 1000);
  return `${start}–${TIME.format(end)}`;
}

/** "45 min" / "1 h" / "1 h 30 min". */
export function formatDuration(minutes) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
