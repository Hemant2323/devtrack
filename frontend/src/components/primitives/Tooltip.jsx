import * as RadixTooltip from "@radix-ui/react-tooltip";
import styles from "./Tooltip.module.css";

/** One provider at the app root controls delay for every tooltip. */
export function TooltipProvider({ children }) {
  return (
    <RadixTooltip.Provider delayDuration={400} skipDelayDuration={300}>
      {children}
    </RadixTooltip.Provider>
  );
}

/**
 * Tooltips are supplementary only. Any control with a tooltip must also carry
 * its own accessible name (aria-label), because tooltips do not appear for
 * touch users and are not a substitute for a label.
 */
export function Tooltip({ content, shortcut, side = "bottom", children, ...props }) {
  if (!content) return children;
  return (
    <RadixTooltip.Root {...props}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content side={side} sideOffset={6} className={styles.content}>
          {content}
          {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
          <RadixTooltip.Arrow className={styles.arrow} width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
