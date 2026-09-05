import { useMatch } from "react-router-dom";

/**
 * The active project id, read from the URL.
 *
 * AppShell is now a single pathless layout route shared by every authenticated
 * page, so `useParams()` inside it cannot see `:pid` — that param is matched by
 * a descendant route. Matching the path directly gives the shell, sidebar and
 * project switcher one consistent answer without prop-drilling through TopBar.
 */
export function useProjectId() {
  const nested = useMatch("/projects/:pid/*");
  const index = useMatch("/projects/:pid");
  return nested?.params.pid ?? index?.params.pid ?? undefined;
}
