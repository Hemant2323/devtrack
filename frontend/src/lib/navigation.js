import {
  Blocks,
  MessagesSquare,
  NotebookPen,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Inbox,
  Rocket,
  Columns3,
  LayoutGrid,
  CircleUser,
  ListChecks,
  Settings,
  Users,
} from "lucide-react";

/**
 * Project-level navigation.
 *
 * Only routes backed by a real endpoint appear here. Sprints and Backlog were
 * added once Sprint 5 shipped their endpoints, and Test cases with them;
 * dashboard and AI triage remain absent until their APIs exist — a nav item that leads nowhere
 * is worse than no nav item.
 */
export const PROJECT_NAV = [
  { key: "overview",   label: "Overview",   icon: LayoutGrid,  segment: "" },
  { key: "mywork",     label: "My work",    icon: CircleUser,  segment: "my-work" },
  { key: "chat",       label: "Chat",       icon: MessagesSquare, segment: "chat" },
  { key: "notes",      label: "Notes",      icon: NotebookPen, segment: "notes" },
  { key: "meetings",   label: "Meetings",   icon: CalendarClock, segment: "meetings" },
  { key: "calendar",   label: "Calendar",   icon: CalendarDays, segment: "calendar" },
  { key: "board",      label: "Board",      icon: Columns3,    segment: "board" },
  { key: "issues",     label: "Issues",     icon: ListChecks,  segment: "issues" },
  { key: "backlog",    label: "Backlog",    icon: Inbox,       segment: "backlog" },
  { key: "sprints",    label: "Sprints",    icon: Rocket,      segment: "sprints" },
  { key: "testcases",  label: "Test cases", icon: ClipboardCheck, segment: "test-cases" },
  { key: "members",    label: "Members",    icon: Users,       segment: "members" },
  { key: "components", label: "Components", icon: Blocks,      segment: "components" },
  { key: "settings",   label: "Settings",   icon: Settings,    segment: "settings" },
];

export function projectPath(pid, segment) {
  return segment ? `/projects/${pid}/${segment}` : `/projects/${pid}`;
}
