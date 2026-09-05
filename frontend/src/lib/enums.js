/**
 * Single source of truth for every backend enum's presentation.
 *
 * The board, the issue table, the detail panel, the filters and the marketing
 * previews all read from here, so a status can never look one way in one place
 * and another way somewhere else. Values match the API exactly — see
 * backend/app/models/issue.py and project.py.
 */

export const STATUS = {
  TODO: { value: "TODO", label: "To do", fg: "var(--status-todo-fg)", bg: "var(--status-todo-bg)" },
  IN_PROGRESS: {
    value: "IN_PROGRESS",
    label: "In progress",
    fg: "var(--status-progress-fg)",
    bg: "var(--status-progress-bg)",
  },
  TESTING: { value: "TESTING", label: "Testing", fg: "var(--status-testing-fg)", bg: "var(--status-testing-bg)" },
  DONE: { value: "DONE", label: "Done", fg: "var(--status-done-fg)", bg: "var(--status-done-bg)" },
};

/** Board column order — matches the keys the /board endpoint returns. */
export const BOARD_COLUMNS = [
  { key: "todo", status: "TODO" },
  { key: "in_progress", status: "IN_PROGRESS" },
  { key: "testing", status: "TESTING" },
  { key: "done", status: "DONE" },
];

/**
 * Priority. `level` drives a stepped bar glyph so the value is readable
 * without colour — colour only reinforces it.
 */
export const PRIORITY = {
  LOW: { value: "LOW", label: "Low", level: 1, color: "var(--priority-low)" },
  MEDIUM: { value: "MEDIUM", label: "Medium", level: 2, color: "var(--priority-medium)" },
  HIGH: { value: "HIGH", label: "High", level: 3, color: "var(--priority-high)" },
  CRITICAL: { value: "CRITICAL", label: "Critical", level: 4, color: "var(--priority-critical)" },
};

export const SEVERITY = {
  MINOR: { value: "MINOR", label: "Minor", color: "var(--severity-minor)" },
  MAJOR: { value: "MAJOR", label: "Major", color: "var(--severity-major)" },
  CRITICAL: { value: "CRITICAL", label: "Critical", color: "var(--severity-critical)" },
  BLOCKER: { value: "BLOCKER", label: "Blocker", color: "var(--severity-blocker)" },
};

export const ISSUE_TYPE = {
  TASK: { value: "TASK", label: "Task" },
  BUG: { value: "BUG", label: "Bug" },
};

/**
 * Sprint lifecycle. Matches SprintState on the backend. `PLANNED -> ACTIVE`
 * happens via /start and `ACTIVE -> COMPLETED` via /complete; there is no
 * other legal transition, which is why the UI only ever offers those two.
 */
export const SPRINT_STATE = {
  PLANNED: { value: "PLANNED", label: "Planned", variant: "outline" },
  ACTIVE: { value: "ACTIVE", label: "Active", variant: "success" },
  COMPLETED: { value: "COMPLETED", label: "Completed", variant: "neutral" },
};

export const sprintStateOf = (value) => SPRINT_STATE[value] ?? SPRINT_STATE.PLANNED;

/** Test run outcomes (FR-9.2). Only FAIL can raise a bug. */
export const TEST_RESULT = {
  PASS: { value: "PASS", label: "Pass", fg: "var(--status-done-fg)", bg: "var(--status-done-bg)" },
  FAIL: { value: "FAIL", label: "Fail", fg: "var(--danger-fg)", bg: "var(--danger-bg)" },
  BLOCKED: { value: "BLOCKED", label: "Blocked", fg: "var(--status-testing-fg)", bg: "var(--status-testing-bg)" },
};

export const testResultOf = (value) => TEST_RESULT[value] ?? TEST_RESULT.BLOCKED;

/**
 * Note types. A small closed set for labelling and filtering — not a template
 * engine. Templates live in features/notes/templates.js and only prefill text,
 * so a note's type can be changed afterwards without anything following it.
 */
export const NOTE_TYPE = {
  GENERAL: { value: "GENERAL", label: "General" },
  MEETING: { value: "MEETING", label: "Meeting" },
  SPRINT: { value: "SPRINT", label: "Sprint" },
  TECHNICAL: { value: "TECHNICAL", label: "Technical" },
  RETROSPECTIVE: { value: "RETROSPECTIVE", label: "Retrospective" },
};

export const noteTypeOf = (value) => NOTE_TYPE[value] ?? NOTE_TYPE.GENERAL;

export const ROLE = {
  ADMIN: { value: "ADMIN", label: "Admin" },
  DEVELOPER: { value: "DEVELOPER", label: "Developer" },
  TESTER: { value: "TESTER", label: "Tester" },
};

export const statusOf = (value) => STATUS[value] ?? STATUS.TODO;
export const priorityOf = (value) => PRIORITY[value] ?? PRIORITY.MEDIUM;
export const severityOf = (value) => (value ? SEVERITY[value] : null);
