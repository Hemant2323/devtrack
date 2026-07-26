# UML Diagrams — DevTrack

All diagrams are in **Mermaid** format — they render directly on GitHub and in VS Code (with the Mermaid extension). For the college report, export as images via [mermaid.live](https://mermaid.live) or redraw in draw.io using these as the source of truth.

---

## 1. Use Case Diagram

Mermaid has no native use-case syntax, so this is modelled as a flowchart. For the report, redraw in draw.io with standard ovals/actors.

```mermaid
flowchart LR
    Admin([Admin])
    Dev([Developer])
    Tester([Tester])
    AI[LLM API]:::ext

    subgraph DevTrack System
        UC1(Sign up / Log in)
        UC2(Create project)
        UC3(Manage members & roles)
        UC4(Manage sprints)
        UC5(Create / edit issue)
        UC6(Move issue on Kanban board)
        UC7(Comment on issue)
        UC8(Search / filter issues)
        UC9(View dashboard)
        UC10(Manage test cases)
        UC11(Record test run)
        UC12(Request AI triage)
        UC13(View notifications)
        UC14(Delete / archive items)
    end

    Admin --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8 & UC9 & UC13 & UC14
    Dev --> UC1 & UC5 & UC6 & UC7 & UC8 & UC9 & UC12 & UC13
    Tester --> UC1 & UC5 & UC6 & UC7 & UC8 & UC9 & UC10 & UC11 & UC12 & UC13
    UC12 -.->|«include»| AI
    UC11 -.->|«extend» create bug on fail| UC5

    classDef ext fill:#eee,stroke:#999
```

**Key relationships:**
- «include»: *Request AI triage* includes calling the LLM API
- «extend»: *Record test run* extends into *Create issue* when a run fails
- All authenticated use cases include *Log in* (omitted from arrows for readability)

---

## 2. Class Diagram (Domain Model)

```mermaid
classDiagram
    class User {
        +int id
        +str name
        +str email
        -str password_hash
        +datetime created_at
        +verify_password(pw) bool
    }

    class Project {
        +int id
        +str name
        +str key
        +str description
        +bool archived
        +datetime created_at
        +next_issue_number() int
    }

    class ProjectMember {
        +int id
        +Role role
        +datetime joined_at
    }

    class Component {
        +int id
        +str name
        +int default_assignee_id
    }

    class Issue {
        +int id
        +str key
        +IssueType type
        +str title
        +str description
        +Priority priority
        +Severity severity
        +Status status
        +date deadline
        +str steps_to_reproduce
        +datetime created_at
        +bool deleted
        +transition(new_status) void
    }

    class Sprint {
        +int id
        +str name
        +str goal
        +date start_date
        +date end_date
        +SprintState state
        +complete() SprintReport
    }

    class Comment {
        +int id
        +str body
        +datetime created_at
        +datetime edited_at
    }

    class Activity {
        +int id
        +str action
        +str field
        +str old_value
        +str new_value
        +datetime created_at
    }

    class Notification {
        +int id
        +str message
        +NotifType type
        +bool read
        +datetime created_at
    }

    class TestCase {
        +int id
        +str title
        +str preconditions
        +str steps
        +str expected_result
    }

    class TestRun {
        +int id
        +RunResult result
        +str notes
        +datetime executed_at
    }

    class TriageSuggestion {
        +int id
        +Severity suggested_severity
        +str suggested_component
        +int suggested_assignee_id
        +str summary
        +float confidence
        +bool accepted
    }

    class Role {
        <<enumeration>>
        ADMIN
        DEVELOPER
        TESTER
    }
    class IssueType {
        <<enumeration>>
        TASK
        BUG
    }
    class Status {
        <<enumeration>>
        TODO
        IN_PROGRESS
        TESTING
        DONE
    }
    class Priority {
        <<enumeration>>
        LOW
        MEDIUM
        HIGH
        CRITICAL
    }
    class Severity {
        <<enumeration>>
        MINOR
        MAJOR
        CRITICAL
        BLOCKER
    }

    User "1" --> "*" ProjectMember : has
    Project "1" --> "*" ProjectMember : has
    Project "1" --> "*" Component
    Project "1" --> "*" Issue
    Project "1" --> "*" Sprint
    Project "1" --> "*" TestCase
    Sprint "0..1" --> "*" Issue : contains
    Issue "1" --> "*" Comment
    Issue "1" --> "*" Activity
    Issue "0..1" --> "*" TestCase : verifies
    Issue "*" --> "0..1" User : assignee
    Issue "*" --> "1" User : reporter
    Issue "*" --> "0..1" Component
    Issue "0..1" --> "0..1" TriageSuggestion
    TestCase "1" --> "*" TestRun
    Comment "*" --> "1" User : author
    Notification "*" --> "1" User : recipient
    ProjectMember --> Role
```

---

## 3. Sequence Diagram — AI-Assisted Bug Triage (the flagship flow)

```mermaid
sequenceDiagram
    actor U as Tester
    participant FE as React Frontend
    participant API as FastAPI Backend
    participant TS as TriageService
    participant LLM as Claude API
    participant DB as Database

    U->>FE: Types bug description, clicks "Suggest triage"
    FE->>API: POST /projects/{id}/triage {description}
    API->>API: Verify JWT + project membership
    API->>DB: Fetch components + members
    DB-->>API: components[], members[]
    API->>TS: suggest(description, components, members)
    TS->>LLM: Messages API (structured prompt, 10s timeout)

    alt LLM responds in time
        LLM-->>TS: {severity, component, assignee, summary, confidence}
        TS-->>API: TriageSuggestion
        API->>DB: Save suggestion (accepted=false)
        API-->>FE: 200 {suggestion}
        FE-->>U: Show suggestion chips (Accept / Ignore)
        U->>FE: Accept all
        FE->>API: POST /issues {..., triage_suggestion_id}
        API->>DB: Create issue + mark suggestion accepted + activity log
        API-->>FE: 201 {issue DEV-42}
    else Timeout / LLM error
        TS-->>API: TriageUnavailableError
        API-->>FE: 503 {detail: "AI unavailable"}
        FE-->>U: "AI unavailable — fill in manually"
    end
```

## 4. Sequence Diagram — Kanban Card Move

```mermaid
sequenceDiagram
    actor U as Developer
    participant FE as React Board
    participant API as FastAPI
    participant DB as Database

    U->>FE: Drags DEV-42 "In Progress" → "Testing"
    FE->>FE: Optimistic UI update
    FE->>API: PATCH /issues/42 {status: "TESTING"}
    API->>API: JWT + RBAC check
    API->>DB: UPDATE issue SET status
    API->>DB: INSERT activity (status: IN_PROGRESS → TESTING)
    API->>DB: INSERT notification for assignee
    API-->>FE: 200 {issue}
    Note over FE: On error → revert card + toast
```

---

## 5. Activity Diagram — Bug Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Reported : Tester/Dev creates bug
    Reported --> Triaged : AI suggestion accepted or manual triage
    Triaged --> ToDo : added to sprint/backlog
    ToDo --> InProgress : developer starts work
    InProgress --> Testing : fix pushed
    Testing --> Done : test run passes
    Testing --> InProgress : test run fails (reopen)
    Done --> [*]
    InProgress --> ToDo : deprioritised
```

## 6. Component Diagram (architecture view)

```mermaid
flowchart TB
    subgraph Client
        R[React SPA<br/>Vite + React Router + TanStack Query]
    end
    subgraph Server["FastAPI Application"]
        RT[Routers<br/>auth / projects / issues / sprints / triage / tests]
        SV[Services<br/>business rules, RBAC]
        RP[Repositories<br/>SQLAlchemy queries]
        SCH[Scheduler<br/>deadline notifications]
    end
    subgraph Data
        DB[(SQLite dev /<br/>PostgreSQL prod)]
    end
    EXT[Claude API]:::ext

    R -- "HTTPS / JSON + JWT" --> RT
    RT --> SV --> RP --> DB
    SV -- "AI triage only" --> EXT
    SCH --> RP

    classDef ext fill:#eee,stroke:#999
```
