import { Archive, ArchiveRestore, Copy, Layers, MoreHorizontal, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { formatDate } from "../../lib/format";
import { Badge } from "../primitives/Badge";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../primitives/Menu";
import { Tooltip } from "../primitives/Tooltip";
import { AvatarStack } from "./AvatarStack";
import styles from "./ProjectCard.module.css";

/**
 * Every field shown here comes from the real API:
 *   key, name, description, archived, issue_counter, created_at   (ProjectResponse)
 *   members                                                       (GET /projects/{id}/members)
 *
 * `issue_counter` is monotonic — it is the source of sequential issue keys and
 * never decreases — so it is labelled "created", not "open". Anything the
 * backend does not expose (open counts, last activity) is deliberately absent
 * rather than invented.
 */
function ProjectMenu({ project, onArchiveToggle }) {
  return (
    <Menu>
      <Tooltip content="Project actions">
        <MenuTrigger asChild>
          <button
            type="button"
            className={styles.menuButton}
            aria-label={`Actions for ${project.name}`}
            onClick={(event) => {
              // The card is a link; the menu must not navigate.
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent>
        <MenuItem
          icon={Copy}
          onSelect={() => navigator.clipboard?.writeText(project.key)}
        >
          Copy project key
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={project.archived ? ArchiveRestore : Archive}
          onSelect={() => onArchiveToggle?.(project)}
        >
          {project.archived ? "Restore project" : "Archive project"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function ProjectCard({ project, members, membersLoading, onArchiveToggle }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className={cn(styles.card, project.archived && styles.archived)}
    >
      <div className={styles.head}>
        <span className={styles.keyTile}>{project.key}</span>
        <span className={styles.headText}>
          <span className={styles.name}>{project.name}</span>
          <span className={styles.created}>Created {formatDate(project.created_at)}</span>
        </span>
        {project.archived && (
          <Badge variant="neutral" className={styles.badge}>
            Archived
          </Badge>
        )}
        <span className={styles.menuSlot}>
          <ProjectMenu project={project} onArchiveToggle={onArchiveToggle} />
        </span>
      </div>

      <p className={cn(styles.description, !project.description && styles.descriptionEmpty)}>
        {project.description || "No description yet."}
      </p>

      <div className={styles.foot}>
        <Tooltip content="Issues created in this project. The counter never decreases, so deleted issues are included.">
          <span className={styles.stat}>
            <Layers size={14} aria-hidden="true" />
            <span className={styles.statValue}>{project.issue_counter}</span>
            created
          </span>
        </Tooltip>

        {!membersLoading && members?.length ? (
          <span className={styles.stat}>
            <Users size={14} aria-hidden="true" />
            <span className={styles.statValue}>{members.length}</span>
          </span>
        ) : null}

        <span className={styles.members}>
          <AvatarStack members={members} loading={membersLoading} />
        </span>
      </div>
    </Link>
  );
}

export function ProjectRow({ project, members, membersLoading, onArchiveToggle }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className={cn(styles.row, project.archived && styles.archived)}
    >
      <span className={styles.rowKey}>{project.key}</span>

      <span className={styles.rowText}>
        <span className={styles.rowName}>{project.name}</span>
        <span className={styles.rowDesc}>
          {project.description || "No description yet."}
        </span>
      </span>

      <span className={cn(styles.stat, styles.rowStats)}>
        <Layers size={14} aria-hidden="true" />
        <span className={styles.statValue}>{project.issue_counter}</span>
      </span>

      <AvatarStack members={members} loading={membersLoading} max={3} />

      <span className={styles.menuSlot}>
        <ProjectMenu project={project} onArchiveToggle={onArchiveToggle} />
      </span>
    </Link>
  );
}
