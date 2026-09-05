import { Bell, Menu as MenuIcon, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../primitives/Button";
import { Tooltip } from "../primitives/Tooltip";
import { LogoMark } from "../domain/Logo";
import { ProjectSwitcher } from "../domain/ProjectSwitcher";
import { ThemeToggle } from "../domain/ThemeToggle";
import { UserMenu } from "../domain/UserMenu";
import styles from "./TopBar.module.css";

/**
 * Account-level chrome: identity, project context, global actions.
 *
 * Fixed 48px. It never scrolls, and it owns no data beyond what its children
 * fetch for themselves.
 */
export function TopBar({ onOpenNav }) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={MenuIcon}
          className={styles.menuButton}
          onClick={onOpenNav}
          aria-label="Open navigation"
        />

        <Link to="/projects" className={styles.brandLink} aria-label="DevTrack home">
          <LogoMark size={20} />
        </Link>

        <span className={styles.divider} aria-hidden="true" />

        <ProjectSwitcher />
      </div>

      <span className={styles.spacer} />

      <button className={styles.search} type="button" aria-label="Search — coming in a later phase" disabled>
        <Search size={14} aria-hidden="true" />
        <span className={styles.searchLabel}>Search</span>
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>

      <div className={styles.right}>
        <Tooltip content="Notifications">
          <span className={styles.bellWrap}>
            <Button variant="ghost" size="sm" iconOnly icon={Bell} aria-label="Notifications" disabled />
          </span>
        </Tooltip>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
