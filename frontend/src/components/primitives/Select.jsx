import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { FieldError } from "./FieldError";
import styles from "./Select.module.css";

/**
 * Labelled select.
 *
 * Built on a native <select> deliberately: it needs no extra dependency, gets
 * keyboard, typeahead and screen-reader behaviour for free, and opens the
 * platform picker on touch devices. Errors are wired through aria-describedby
 * and aria-invalid the same way Input does it.
 *
 * `options`: [{ value, label, disabled? }]
 */
export const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    optional = false,
    options = [],
    placeholder,
    className,
    id,
    ...props
  },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
          {optional && <span className={styles.optional}>optional</span>}
        </label>
      )}
      <div className={styles.wrap}>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(error && errorId, hint && hintId) || undefined}
          className={cn(styles.select, error && styles.invalid, className)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </div>
      {hint && !error && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});
