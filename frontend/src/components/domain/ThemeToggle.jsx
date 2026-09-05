import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../../theme/ThemeProvider";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../primitives/Menu";
import { Button } from "../primitives/Button";
import { Tooltip } from "../primitives/Tooltip";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Three-way theme control. A plain toggle can't express "follow the system",
 * which is the state most users actually want, so this is a radio menu.
 */
export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <Menu>
      <Tooltip content="Theme">
        <MenuTrigger asChild>
          <Button variant="ghost" size="sm" iconOnly icon={Icon} aria-label="Change theme" />
        </MenuTrigger>
      </Tooltip>
      <MenuContent>
        <MenuLabel>Appearance</MenuLabel>
        <MenuRadioGroup value={theme} onValueChange={setTheme}>
          {OPTIONS.map((option) => (
            <MenuRadioItem key={option.value} value={option.value} icon={option.icon}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
