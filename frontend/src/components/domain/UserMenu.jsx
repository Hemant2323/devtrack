import { LogOut } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../primitives/Avatar";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "../primitives/Menu";
import styles from "./UserMenu.module.css";

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <Menu>
      <MenuTrigger className={styles.trigger} aria-label={`Account menu for ${user.name}`}>
        <Avatar name={user.name} size="sm" />
      </MenuTrigger>
      <MenuContent>
        <div className={styles.identity}>
          <Avatar name={user.name} size="lg" />
          <span className={styles.identityText}>
            <span className={styles.name}>{user.name}</span>
            <span className={styles.email}>{user.email}</span>
          </span>
        </div>
        <MenuSeparator />
        <MenuItem icon={LogOut} danger onSelect={logout}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
