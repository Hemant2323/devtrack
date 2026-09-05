import { useMemo, useState } from "react";
import { FileText, Plus, Rocket, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { PageHeader } from "../components/layout/PageHeader";
import { Avatar } from "../components/primitives/Avatar";
import { Badge } from "../components/primitives/Badge";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Input } from "../components/primitives/Input";
import { Select } from "../components/primitives/Select";
import { Skeleton } from "../components/primitives/Skeleton";
import { IssueKey } from "../components/domain/IssueAtoms";
import { CreateNoteDialog } from "../features/notes/CreateNoteDialog";
import { useNotes } from "../features/notes/useNotes";
import { useProjectId } from "../hooks/useProjectId";
import { NOTE_TYPE, noteTypeOf } from "../lib/enums";
import { formatRelative, matches } from "../lib/format";
import styles from "./NotesPage.module.css";

/** First non-empty line of the body, as the list's one-line preview. */
function excerpt(content) {
  return (content ?? "").split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

function SkeletonRows() {
  return Array.from({ length: 4 }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={`${30 + ((i * 13) % 28)}%`} height={14} />
      <Skeleton width="70%" height={12} />
      <Skeleton width={160} height={11} />
    </div>
  ));
}

/**
 * Project notes.
 *
 * Deliberately a list of documents, not a workspace: no folders, no nesting,
 * no boards. The type filter is a server-side query parameter; search is a
 * client-side filter over the loaded list, since a project's notes are few and
 * a request per keystroke would buy nothing.
 */
export function NotesPage() {
  const pid = useProjectId();
  const [noteType, setNoteType] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: notes, isPending, isError, error, refetch } = useNotes(
    pid,
    noteType || null,
  );

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);

  const visible = useMemo(
    () =>
      (notes ?? []).filter(
        (note) => matches(note.title, query) || matches(note.content, query),
      ),
    [notes, query],
  );

  const hasNotes = (notes ?? []).length > 0;

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Notes`}
        title="Notes"
        description="Meeting notes, planning, retrospectives and technical decisions for this project."
        actions={
          !archived ? (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New note
            </Button>
          ) : null
        }
      />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Input
              type="search"
              icon={Search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
            />
          </div>
          <div className={styles.filter}>
            <Select
              value={noteType}
              onChange={(event) => setNoteType(event.target.value)}
              placeholder="All types"
              aria-label="Filter by note type"
              options={Object.values(NOTE_TYPE).map((type) => ({
                value: type.value,
                label: type.label,
              }))}
            />
          </div>
        </div>

        {isPending && <div className={styles.list}>{SkeletonRows()}</div>}

        {isError && (
          <ErrorState
            title="Couldn't load notes"
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {!isPending && !isError && !hasNotes && (
          <EmptyState
            icon={FileText}
            title={noteType ? "No notes of this type" : "No notes yet"}
            description={
              archived
                ? "This project is archived, so no new notes can be written."
                : "Write down what the team decided, planned or learned — and link it to the work it belongs to."
            }
            action={
              !archived && !noteType ? (
                <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                  New note
                </Button>
              ) : null
            }
          />
        )}

        {!isPending && !isError && hasNotes && visible.length === 0 && (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`Nothing in this project's notes matches “${query}”.`}
          />
        )}

        {!isPending && !isError && visible.length > 0 && (
          <ul className={styles.list}>
            {visible.map((note) => (
              <li key={note.id}>
                <Link to={`/projects/${pid}/notes/${note.id}`} className={styles.row}>
                  <div className={styles.rowTop}>
                    <span className={styles.title}>{note.title}</span>
                    <Badge variant="neutral">{noteTypeOf(note.note_type).label}</Badge>
                  </div>

                  {excerpt(note.content) && (
                    <p className={styles.excerpt}>{excerpt(note.content)}</p>
                  )}

                  <div className={styles.meta}>
                    <Avatar name={note.author_name} size="xs" />
                    <span className={styles.author}>{note.author_name}</span>
                    <span className={styles.dot} aria-hidden="true">
                      ·
                    </span>
                    <time className={styles.when} title={note.updated_at}>
                      Updated {formatRelative(note.updated_at)}
                    </time>

                    {/* Links resolve server-side, so one that no longer exists
                        simply is not here — never a reference leading nowhere. */}
                    {note.issue && (
                      <span className={styles.link}>
                        <IssueKey>{note.issue.key}</IssueKey>
                      </span>
                    )}
                    {note.sprint && (
                      <span className={styles.link}>
                        <Rocket size={11} aria-hidden="true" />
                        {note.sprint.name}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateNoteDialog pid={pid} open={creating} onOpenChange={setCreating} />
    </>
  );
}
