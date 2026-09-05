/**
 * The month grid, as arithmetic.
 *
 * Pure functions with no React and no library: a month view is six rows of
 * seven days, which is a loop, not a dependency. Keeping it here means the
 * grid and the range the calendar requests are derived from the same code and
 * cannot disagree about which days are on screen.
 *
 * Everything below works in the viewer's local timezone, because that is the
 * calendar a person is looking at. Conversion to and from UTC happens only at
 * the API boundary (see toUtcInstant / localDayKey).
 */

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a local Date — the key every day cell is addressed by. */
export function localDayKey(value) {
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Monday-first weekday index, matching the column order the grid renders. */
function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

/**
 * The 42 days a month view shows: the month itself plus the leading and
 * trailing days that complete its weeks.
 *
 * Always six rows, so the grid does not change height between months — a
 * calendar that resizes as you page through it is disorienting.
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - mondayIndex(first));

  return Array.from({ length: 42 }, (_, i) => {
    const at = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      date: at,
      key: localDayKey(at),
      inMonth: at.getMonth() === month,
    };
  });
}

/** The window to request: the first and last day the grid actually shows. */
export function gridRange(year, month) {
  const days = monthGrid(year, month);
  return { start: days[0].key, end: days[days.length - 1].key };
}

export function addMonths(year, month, delta) {
  const at = new Date(year, month + delta, 1);
  return { year: at.getFullYear(), month: at.getMonth() };
}

const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export function monthLabel(year, month) {
  return MONTH_YEAR.format(new Date(year, month, 1));
}

/** Monday-first weekday headings, named by the viewer's own locale. */
export function weekdayLabels() {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => WEEKDAY.format(new Date(2024, 0, 1 + i)));
}

/** "14:00" for a timed entry; nothing for an all-day one. */
export function entryTime(entry) {
  if (entry.all_day) return null;
  const at = new Date(entry.start);
  return Number.isNaN(at.getTime()) ? null : TIME.format(at);
}

/**
 * Which day cells an entry belongs in.
 *
 * A sprint spans days, so it appears in each one it covers; everything else
 * lands on the single day it starts. All-day entries arrive as midnight UTC
 * and are read back as a plain date, so an issue due on the 3rd shows on the
 * 3rd regardless of the viewer's offset — reading it as a local instant would
 * put it on the 2nd for anyone west of UTC.
 */
export function entryDayKeys(entry) {
  const startKey = entry.all_day
    ? String(entry.start).slice(0, 10)
    : localDayKey(entry.start);
  if (!entry.end) return [startKey];

  const endKey = entry.all_day
    ? String(entry.end).slice(0, 10)
    : localDayKey(entry.end);
  if (endKey === startKey) return [startKey];

  const keys = [];
  const cursor = new Date(`${startKey}T00:00:00`);
  const last = new Date(`${endKey}T00:00:00`);
  // Bounded: the grid is 42 days, and the server caps a range at 120.
  while (cursor <= last && keys.length < 200) {
    keys.push(localDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/** Group entries by the day cells they occupy. */
export function groupByDay(entries) {
  const byDay = new Map();
  for (const entry of entries ?? []) {
    for (const key of entryDayKeys(entry)) {
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(entry);
    }
  }
  return byDay;
}

/**
 * A local date + time back into the UTC instant the API stores.
 *
 * Built through the Date constructor so the browser applies its own offset,
 * including across a clock change — the same conversion the meeting form uses.
 */
export function toUtcInstant(dayKey, time) {
  if (!dayKey || !time) return null;
  const [year, month, day] = dayKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const at = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** The local date and time inputs for a stored instant. */
export function fromUtcInstant(iso) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: "", time: "" };
  return { date: localDayKey(at), time: `${pad(at.getHours())}:${pad(at.getMinutes())}` };
}
