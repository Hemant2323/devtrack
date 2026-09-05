/**
 * Query key factory.
 *
 * One place to derive every cache key, so invalidation is precise and
 * typo-proof. Keys are hierarchical: invalidating `keys.project(pid)`
 * also invalidates everything nested beneath that project.
 */
export const keys = {
  me: () => ["me"],

  projects: () => ["projects"],
  project: (pid) => ["projects", String(pid)],

  members: (pid) => ["projects", String(pid), "members"],
  // The request carries no user — the server always answers for the caller —
  // but the *cache* is scoped by user id, because signing out does not clear
  // the query cache, and one person must never be served another's rows.
  myWork: (pid, userId = null) => [
    "projects", String(pid), "my-work", userId == null ? null : String(userId),
  ],
  chat: (pid) => ["projects", String(pid), "chat"],
  // Every dependency edge in the project, read once per board load so the
  // blocked indicator costs no per-card request.
  projectDependencies: (pid) => ["projects", String(pid), "dependencies"],

  // Direct messages sit beside team chat rather than beneath it: they share a
  // backend router but must never invalidate together, so a team-chat send
  // cannot trigger a refetch of a private thread.
  dmPartners: (pid) => ["projects", String(pid), "dm-partners"],
  dm: (pid, userId) => ["projects", String(pid), "dm", String(userId)],
  components: (pid) => ["projects", String(pid), "components"],
  // The type filter is server-side, so it participates in the key; search
  // is client-side and deliberately does not.
  // The upcoming/past split is a server-side scope, so it participates in
  // the key and each section caches independently.
  // The visible window and the active type filters both change what the
  // server returns, so both participate in the key.
  calendar: (pid, range = null, types = null) => [
    "projects", String(pid), "calendar", range, types,
  ],
  calendarEvent: (eventId) => ["calendar-events", String(eventId)],
  meetings: (pid, scope = null) => ["projects", String(pid), "meetings", scope],
  meeting: (meetingId) => ["meetings", String(meetingId)],
  notes: (pid, noteType = null) => ["projects", String(pid), "notes", noteType],
  // Notes written for one meeting, fetched in one request.
  meetingNotes: (pid, meetingId) => [
    "projects", String(pid), "meeting-notes", String(meetingId),
  ],
  note: (noteId) => ["notes", String(noteId)],
  sprints: (pid) => ["projects", String(pid), "sprints"],
  sprint: (sid) => ["sprints", String(sid)],
  testCases: (pid, filters = {}) => ["projects", String(pid), "test-cases", filters],
  testCase: (caseId) => ["test-cases", String(caseId)],
  testRuns: (caseId) => ["test-cases", String(caseId), "runs"],

  // Filters participate in the key so each filter combination caches
  // separately and the URL stays the single source of truth.
  issues: (pid, filters = {}) => ["projects", String(pid), "issues", filters],
  board: (pid, sprintId = null) => ["projects", String(pid), "board", sprintId],

  issue: (iid) => ["issues", String(iid)],
  activities: (iid) => ["issues", String(iid), "activities"],
  comments: (iid) => ["issues", String(iid), "comments"],
  // Nested under the issue like activities and comments, so removing a
  // deleted issue's cache removes its links with it.
  dependencies: (iid) => ["issues", String(iid), "dependencies"],

  notifications: () => ["notifications"],
};
