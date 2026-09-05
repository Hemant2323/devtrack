/**
 * Note templates.
 *
 * Deliberately just prefilled text: a template picks a starting title, a
 * starting body and a note type, and then has no further existence. Nothing is
 * stored, nothing is enforced, and every character is editable or deletable
 * the moment the note opens — which is why there is no template management
 * screen and no template records in the database.
 */

export const NOTE_TEMPLATES = [
  {
    // A note must have content — the server rejects an empty or whitespace-only
    // body — so "blank" means one neutral heading to type under, not nothing at
    // all. It reads sensibly if left, and is one keystroke to clear.
    id: "blank",
    label: "Blank",
    description: "A plain page with a single heading.",
    noteType: "GENERAL",
    title: "",
    content: "Notes:\n",
  },
  {
    id: "meeting",
    label: "Meeting notes",
    description: "Agenda, discussion, decisions, actions.",
    noteType: "MEETING",
    title: "Meeting — ",
    content: [
      "Attendees:",
      "",
      "Agenda:",
      "",
      "Discussion:",
      "",
      "Decisions:",
      "",
      "Action items:",
      "",
    ].join("\n"),
  },
  {
    id: "sprint-planning",
    label: "Sprint planning",
    description: "Goal, scope, capacity, risks.",
    noteType: "SPRINT",
    title: "Sprint planning — ",
    content: [
      "Sprint goal:",
      "",
      "Scope:",
      "",
      "Capacity:",
      "",
      "Risks and unknowns:",
      "",
    ].join("\n"),
  },
  {
    id: "sprint-review",
    label: "Sprint review",
    description: "What shipped, what did not, feedback.",
    noteType: "SPRINT",
    title: "Sprint review — ",
    content: [
      "Delivered:",
      "",
      "Not delivered:",
      "",
      "Demo notes:",
      "",
      "Feedback:",
      "",
    ].join("\n"),
  },
  {
    id: "retrospective",
    label: "Retrospective",
    description: "What went well, what did not, what changes.",
    noteType: "RETROSPECTIVE",
    title: "Retrospective — ",
    content: [
      "What went well:",
      "",
      "What did not go well:",
      "",
      "What we will change:",
      "",
      "Action items:",
      "",
    ].join("\n"),
  },
  {
    id: "technical-decision",
    label: "Technical decision",
    description: "Context, options, decision, consequences.",
    noteType: "TECHNICAL",
    title: "Decision — ",
    content: [
      "Context:",
      "",
      "Options considered:",
      "",
      "Decision:",
      "",
      "Consequences:",
      "",
    ].join("\n"),
  },
];

export const templateById = (id) =>
  NOTE_TEMPLATES.find((template) => template.id === id) ?? NOTE_TEMPLATES[0];
