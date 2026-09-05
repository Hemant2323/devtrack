import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useProjectId } from "../../hooks/useProjectId";
import { PROJECT_NAV, projectPath } from "../../lib/navigation";
import { Tooltip } from "../primitives/Tooltip";
import styles from "./Sidebar.module.css";

/**
 * Project-level navigation.
 *
 * Scoped to a project by design — it renders only inside /projects/:pid, and
 * switching projects happens in the top bar. Three presentations of the same
 * component: full column, icon rail, and off-canvas drawer.
 */
export function Sidebar({
  project,
  role,
  railed = false,
  drawer = false,
  onCollapseToggle,
  onNavigate,
}) {
  const pid = useProjectId();

  return (
    <aside
      className={cn(styles.sidebar, railed && !drawer && styles.railed, drawer && styles.drawer)}
      aria-label="Project navigation"
    >
      <div className={styles.header}>
        <span className={styles.projectKey}>{project?.key ?? "—"}</span>
        <span className={styles.projectMeta}>
          <span className={styles.projectName}>{project?.name ?? "Loading project"}</span>
          {role && <span className={styles.projectRole}>{role}</span>}
        </span>
      </div>

      <nav className={styles.nav}>
        {PROJECT_NAV.map((item) => {
          const to = projectPath(pid, item.segment);
          const link = (
            <NavLink
              key={item.key}
              to={to}
              end={item.segment === ""}
              onClick={onNavigate}
              className={({ isActive }) => cn(styles.item, isActive && styles.itemActive)}
            >
              <item.icon size={16} className={styles.icon} aria-hidden="true" />
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          );

          // In the rail the label is gone, so the tooltip carries the name.
          return railed && !drawer ? (
            <Tooltip key={item.key} content={item.label} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      {!drawer && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={onCollapseToggle}
            aria-label={railed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {railed ? (
              <PanelLeftOpen size={16} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={16} aria-hidden="true" />
            )}
            <span className={styles.label}>Collapse</span>
          </button>
        </div>
      )}
    </aside>
  );
}

export function SidebarScrim({ onClick }) {
  return <div className={styles.scrim} onClick={onClick} aria-hidden="true" />;
}
