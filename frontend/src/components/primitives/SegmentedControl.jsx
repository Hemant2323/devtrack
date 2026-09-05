import { cn } from "../../lib/cn";
import styles from "./SegmentedControl.module.css";

/**
 * Mutually-exclusive view switch.
 *
 * Rendered as a radiogroup rather than tabs: it changes how the same content
 * is presented, it does not navigate. Each option keeps a visible label for
 * screen readers even when only an icon is shown.
 */
export function SegmentedControl({ value, onChange, options, label, className }) {
  return (
    <div className={cn(styles.group, className)} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(styles.option, selected && styles.selected)}
            onClick={() => onChange(option.value)}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {option.iconOnly ? <span className="sr-only">{option.label}</span> : option.label}
          </button>
        );
      })}
    </div>
  );
}
