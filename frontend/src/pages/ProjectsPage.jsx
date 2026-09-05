import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Input } from "../components/primitives/Input";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../components/primitives/Menu";
import { SegmentedControl } from "../components/primitives/SegmentedControl";
import { Skeleton } from "../components/primitives/Skeleton";
import { ProjectCard, ProjectRow } from "../components/domain/ProjectCard";
import { CreateProjectDialog } from "../features/projects/CreateProjectDialog";
import {
  useProjectMembers,
  useProjects,
  useToggleArchive,
} from "../features/projects/useProjects";
import { cn } from "../lib/cn";
import { matches } from "../lib/format";
import styles from "./ProjectsPage.module.css";

const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All projects" },
];

const VIEWS = [
  { value: "grid", label: "Grid", icon: LayoutGrid, iconOnly: true },
  { value: "list", label: "List", icon: List, iconOnly: true },
];

function LoadingGrid() {
  return (
    <div className={styles.grid}>
      {Array.from({ length: 6 }, (_, index) => (
        <div className={styles.skeletonCard} key={index}>
          <div className={styles.skeletonHead}>
            <Skeleton width={42} height={42} radius="6px" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={10} />
            </div>
          </div>
          <Skeleton width="100%" height={12} />
          <Skeleton width="70%" height={12} />
        </div>
      ))}
    </div>
  );
}

/**
 * Projects — the workspace index.
 *
 * Every value rendered here exists on the API today: key, name, description,
 * archived, issue_counter and created_at from ProjectResponse, plus real
 * members from GET /projects/{id}/members. Nothing is invented; open-issue
 * counts and project-level "last activity" are absent because the backend
 * does not expose them.
 */
export function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const { data: projects, isPending, isError, error, refetch } = useProjects();
  const membersByProject = useProjectMembers(projects);
  const toggleArchive = useToggleArchive();

  // `?new=1` opens the dialog, so the top-bar switcher can deep-link into it.
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [view, setView] = useState("grid");

  /* Must be an effect, not a useState initialiser: arriving from the project
     switcher while already on /projects changes only the query string, so this
     page never remounts and a lazy initialiser would never re-run. */
  useEffect(() => {
    if (params.get("new") === "1") setCreateOpen(true);
  }, [params]);

  function handleCreateOpenChange(open) {
    setCreateOpen(open);
    if (!open && params.get("new")) {
      // Never mutate the instance useSearchParams returns — React Router
      // treats it as immutable and other readers share it this render.
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }

  const visible = useMemo(() => {
    return (projects ?? [])
      .filter((project) => {
        if (status === "active") return !project.archived;
        if (status === "archived") return project.archived;
        return true;
      })
      .filter(
        (project) =>
          matches(project.name, query) ||
          matches(project.key, query) ||
          matches(project.description, query),
      );
  }, [projects, status, query]);

  const statusLabel =
    STATUS_FILTERS.find((filter) => filter.value === status)?.label ?? "Active";

  const archivedCount = (projects ?? []).filter((project) => project.archived).length;

  return (
    <>
      <PageHeader
        eyebrow="Workspace / Projects"
        title="Projects"
        description="Every project you belong to, with the team and the issue counter."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New project
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            icon={Search}
            type="search"
            placeholder="Search projects…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search projects"
          />
        </div>

        <Menu>
          <MenuTrigger
            className={cn(styles.filter, status !== "active" && styles.filterActive)}
          >
            {statusLabel}
            {status === "archived" && archivedCount > 0 && ` · ${archivedCount}`}
            <ChevronDown size={13} aria-hidden="true" />
          </MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>Show</MenuLabel>
            <MenuRadioGroup value={status} onValueChange={setStatus}>
              {STATUS_FILTERS.map((filter) => (
                <MenuRadioItem key={filter.value} value={filter.value}>
                  {filter.label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>

        <span className={styles.spacer} />

        {!isPending && !isError && (
          <span className={styles.count}>
            {visible.length} of {projects?.length ?? 0}
          </span>
        )}

        <SegmentedControl
          label="View as"
          value={view}
          onChange={setView}
          options={VIEWS}
        />
      </div>

      <div className={styles.body}>
        {isPending && <LoadingGrid />}

        {isError && (
          <ErrorState
            title="Couldn't load your projects"
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {!isPending && !isError && visible.length === 0 && (
          <>
            {projects?.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="A project holds your issues, your team and their roles. Create the first one to get started."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                    New project
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="No projects match"
                description={
                  query
                    ? `Nothing matches “${query}” in ${statusLabel.toLowerCase()}.`
                    : `You have no ${statusLabel.toLowerCase()} projects.`
                }
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setStatus("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )}
          </>
        )}

        {!isPending && !isError && visible.length > 0 && (
          <div className={view === "grid" ? styles.grid : styles.list}>
            {visible.map((project, index) => {
              const entry = membersByProject[project.id] ?? {};
              const Component = view === "grid" ? ProjectCard : ProjectRow;
              return (
                <div
                  key={project.id}
                  className={styles.enter}
                  style={{ "--i": Math.min(index, 12) }}
                >
                  <Component
                    project={project}
                    members={entry.members}
                    membersLoading={entry.loading}
                    onArchiveToggle={(target) => toggleArchive.mutate(target)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={handleCreateOpenChange} />
    </>
  );
}
