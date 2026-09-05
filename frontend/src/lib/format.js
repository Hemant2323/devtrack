/**
 * Formatting helpers. Built on Intl rather than a date library — the app needs
 * two formats, and Intl is already in the runtime.
 */

const DATE = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_SHORT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

export function formatDate(value, { short = false } = {}) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return (short ? DATE_SHORT : DATE).format(date);
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago" — falls back to an absolute date beyond a year. */
export function formatRelative(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  for (const [unit, secondsPerUnit] of UNITS) {
    if (abs >= secondsPerUnit) {
      return RELATIVE.format(Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return formatDate(value);
}

/** Case-insensitive substring match used by the client-side project filter. */
export function matches(haystack, needle) {
  if (!needle) return true;
  return String(haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}
