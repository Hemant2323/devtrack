import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, FolderKanban, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { projectsApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { useProjectId } from "../../hooks/useProjectId";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "../primitives/Menu";
import { Skeleton } from "../primitives/Skeleton";
import styles from "./ProjectSwitcher.module.css";

/**
 * Project context control in the top bar.
 *
 * This is how you leave a project, which is why the sidebar carries no
 * project list of its own — one place to switch context, not two.
 */
export function ProjectSwitcher() {
  const pid = useProjectId();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * React Router does not deduplicate: navigate() to the location you are
   * already on still pushes a history entry. Clicking "View all projects"
   * from /projects therefore stacked identical entries, and Back appeared to
   * do nothing because it moved between two copies of the same page.
   *
   * Comparing first makes the action idempotent. The menu still closes when
   * this is a no-op — Radix closes it after onSelect regardless of what the
   * handler does — so the item stays a normal, well-behaved menu action.
   */
  const go = (to, { replace = false } = {}) => {
    if (to === `${location.pathname}${location.search}`) return;
    navigate(to, { replace });
  };

  const { data: projects, isPending } = useQuery({
    queryKey: keys.projects(),
    queryFn: ({ signal }) => projectsApi.list({ signal }),
    staleTime: 60_000,
  });

  const active = projects?.find((project) => String(project.id) === String(pid));
  const visible = (projects ?? []).filter((project) => !project.archived || project.id === active?.id);

  return (
    <Menu>
      <MenuTrigger className={styles.trigger} aria-label="Switch project">
        {active ? (
          <>
            <span className={styles.triggerKey}>{active.key}</span>
            <span className={styles.triggerName}>{active.name}</span>
          </>
        ) : (
          <>
            <FolderKanban size={15} aria-hidden="true" />
            <span className={styles.triggerName}>All projects</span>
          </>
        )}
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </MenuTrigger>

      <MenuContent align="start" className={styles.content}>
        <MenuLabel>Projects</MenuLabel>

        {isPending && (
          <div className={styles.loading}>
            <Skeleton height={22} />
            <Skeleton height={22} />
            <Skeleton height={22} />
          </div>
        )}

        {!isPending && visible.length === 0 && (
          <p className={styles.empty}>No projects yet</p>
        )}

        {visible.map((project) => (
          <MenuItem
            key={project.id}
            onSelect={() => go(`/projects/${project.id}`)}
            trailing={
              project.id === active?.id ? <Check size={14} aria-hidden="true" /> : null
            }
          >
            <span className={styles.itemKey}>{project.key}</span>
            <span className={styles.itemName}>{project.name}</span>
          </MenuItem>
        ))}

        <MenuSeparator />
        <MenuItem icon={FolderKanban} onSelect={() => go("/projects")}>
          View all projects
        </MenuItem>
        <MenuItem
          icon={Plus}
          onSelect={() =>
            go("/projects?new=1", { replace: location.pathname === "/projects" })
          }
        >
          New project
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
