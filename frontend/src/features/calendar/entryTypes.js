/**
 * The five things that can appear on the calendar, and where each one lives.
 *
 * One place decides a type's label, its colour and the page it opens, so a
 * chip in the grid, a legend row and a filter button can never disagree. The
 * `value`s match CalendarEventType on the backend exactly — they are the
 * filter vocabulary the API accepts.
 */
export const ENTRY_TYPES = {
  ISSUE: {
    value: "ISSUE",
    label: "Issue",
    plural: "Issues",
    fg: "var(--status-progress-fg)",
    bg: "var(--status-progress-bg)",
  },
  TEST_CASE: {
    value: "TEST_CASE",
    label: "Test case",
    plural: "Test cases",
    fg: "var(--status-testing-fg)",
    bg: "var(--status-testing-bg)",
  },
  SPRINT: {
    value: "SPRINT",
    label: "Sprint",
    plural: "Sprints",
    fg: "var(--a-700)",
    bg: "var(--a-100)",
  },
  MEETING: {
    value: "MEETING",
    label: "Meeting",
    plural: "Meetings",
    fg: "var(--success-fg)",
    bg: "var(--success-bg)",
  },
  CUSTOM: {
    value: "CUSTOM",
    label: "Event",
    plural: "Events",
    fg: "var(--warning-fg)",
    bg: "var(--warning-bg)",
  },
};

export const ENTRY_TYPE_LIST = Object.values(ENTRY_TYPES);

export const entryTypeOf = (value) => ENTRY_TYPES[value] ?? ENTRY_TYPES.CUSTOM;

/**
 * Where clicking through to the source goes.
 *
 * A custom event has no page of its own — it is edited in place on the
 * calendar — so it returns null and the dialog offers no "open" link.
 * Sprints have no detail route either; the Sprints list is where they live.
 */
export function sourcePath(pid, entry) {
  switch (entry.type) {
    case "ISSUE":
      return `/projects/${pid}/issues/${entry.source_id}`;
    case "TEST_CASE":
      return `/projects/${pid}/test-cases/${entry.source_id}`;
    case "SPRINT":
      return `/projects/${pid}/sprints`;
    case "MEETING":
      return `/projects/${pid}/meetings/${entry.source_id}`;
    default:
      return null;
  }
}
