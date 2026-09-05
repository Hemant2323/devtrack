import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { membersApi, projectsApi } from "../../api/endpoints";
import { keys } from "../../api/queryKeys";
import { useAuth } from "../../auth/AuthContext";
import { BREAKPOINTS, useMediaQuery } from "../../hooks/useMediaQuery";
import { useProjectId } from "../../hooks/useProjectId";
import { cn } from "../../lib/cn";
import { Sidebar, SidebarScrim } from "./Sidebar";
import { TopBar } from "./TopBar";
import styles from "./AppShell.module.css";

/**
 * Application frame.
 *
 * Owns layout and nothing else: no business rules, no data beyond the project
 * its own chrome needs to label itself. Pages render through <Outlet />.
 *
 * Responsive behaviour is three distinct designs rather than a shrunk desktop:
 *   desktop  persistent 240px sidebar, user-collapsible to a rail
 *   tablet   icon rail
 *   mobile   off-canvas drawer over a scrim
 */
export function AppShell() {
  const pid = useProjectId();
  const location = useLocation();
  const { user } = useAuth();

  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const isTablet = useMediaQuery(BREAKPOINTS.tablet);

  /* null = follow the responsive default; true/false = the user decided.
     Kept as a tri-state because an OR against isTablet made the breakpoint
     always win, leaving the Expand control inert at tablet widths. */
  const [collapsed, setCollapsed] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A route change must never leave the drawer covering the page behind it.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Escape closes the drawer, matching every other overlay in the app.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  /* Members double as the app's user directory: issue responses carry
     assignee_id/reporter_id with no names, so this list is what every view
     joins against. Fetching it here warms the cache for the whole project. */
  const { data: members } = useQuery({
    queryKey: keys.members(pid),
    queryFn: ({ signal }) => membersApi.list(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 5 * 60_000,
  });

  const myRole = members?.find((member) => member.user_id === user?.id)?.role;

  const inProject = Boolean(pid);
  const showStaticSidebar = inProject && !isMobile;
  const railed = collapsed ?? isTablet;

  return (
    <div className={cn(styles.shell, !showStaticSidebar && styles.noSidebar)}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className={styles.topbar}>
        <TopBar onOpenNav={() => setDrawerOpen(true)} />
      </div>

      {showStaticSidebar && (
        <Sidebar
          project={project}
          role={myRole}
          railed={railed}
          onCollapseToggle={() => setCollapsed((value) => !(value ?? isTablet))}
        />
      )}

      {inProject && isMobile && drawerOpen && (
        <>
          <SidebarScrim onClick={() => setDrawerOpen(false)} />
          <Sidebar project={project} role={myRole} drawer onNavigate={() => setDrawerOpen(false)} />
        </>
      )}

      <main className={styles.main} id="main-content" tabIndex={-1}>
        <div className={cn(styles.content, styles.transition)}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
