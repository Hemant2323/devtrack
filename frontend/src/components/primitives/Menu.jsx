import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import styles from "./Menu.module.css";

/**
 * Dropdown menu built on Radix.
 *
 * Radix is used rather than a hand-rolled menu because this is exactly the
 * component where bespoke implementations fail: focus trapping, roving
 * tabindex, typeahead, Escape handling, aria-expanded wiring, and focus
 * restoration on close. It ships unstyled, so the look is entirely ours.
 */
/**
 * `modal={false}` is deliberate and load-bearing.
 *
 * Radix defaults dropdown menus to modal, which installs three global side
 * effects while open: `body { pointer-events: none }`, `hideOthers()`
 * (aria-hidden on the rest of the app) and a RemoveScroll lock. The last two
 * are torn down only when the content UNMOUNTS — and the content sits behind
 * <Presence>, which defers unmount until the exit animation reports back. Any
 * interruption of that animation leaves the locks installed and the page
 * unclickable until reload.
 *
 * A dropdown does not need modality. Non-modal keeps outside-click and Escape
 * dismissal (DismissableLayer is still active) while installing none of those
 * global locks, so the page can never be left stuck. Dialogs stay modal, where
 * the behaviour is both wanted and correctly scoped.
 */
export function Menu({ modal = false, ...props }) {
  return <DropdownMenu.Root modal={modal} {...props} />;
}
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children, align = "end", sideOffset = 6, className, ...props }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(styles.content, className)}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ icon: Icon, children, danger = false, shortcut, trailing, ...props }) {
  return (
    <DropdownMenu.Item className={cn(styles.item, danger && styles.danger)} {...props}>
      {Icon && <Icon size={15} className={styles.itemIcon} aria-hidden="true" />}
      {children}
      {shortcut && <kbd className={styles.shortcut}>{shortcut}</kbd>}
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuRadioItem({ icon: Icon, children, ...props }) {
  return (
    <DropdownMenu.RadioItem className={styles.item} {...props}>
      {Icon && <Icon size={15} className={styles.itemIcon} aria-hidden="true" />}
      {children}
      <DropdownMenu.ItemIndicator className={styles.check}>
        <Check size={14} aria-hidden="true" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuLabel({ children }) {
  return <DropdownMenu.Label className={styles.label}>{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={styles.separator} />;
}
