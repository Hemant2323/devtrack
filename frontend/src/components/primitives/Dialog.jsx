import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import styles from "./Dialog.module.css";

/**
 * Modal dialog on Radix.
 *
 * Radix handles the parts that are easy to get subtly wrong: focus trapping,
 * focus restoration on close, Escape, scroll locking, and the aria-modal /
 * labelledby wiring. Title and description are required by the primitive so a
 * dialog can never ship without an accessible name.
 */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  eyebrow,
  title,
  description,
  footer,
  children,
  ...props
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={styles.overlay} />
      <RadixDialog.Content className={styles.content} {...props}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            {description && (
              <RadixDialog.Description className={styles.description}>
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close className={styles.close} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </RadixDialog.Close>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
