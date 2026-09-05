import { forwardRef, useId } from "react";
import { cn } from "../../lib/cn";
import { FieldError } from "./FieldError";
import styles from "./Input.module.css";

/**
 * Labelled text input.
 *
 * The label is always a real <label> bound by id, and the error is wired
 * through aria-describedby + aria-invalid so screen readers announce it with
 * the field rather than as loose text somewhere on the page.
 */
export const Input = forwardRef(function Input(
  { label, error, hint, optional = false, icon: Icon = null, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {optional && <span className={styles.optional}>optional</span>}
        </label>
      )}
      <div className={styles.wrap}>
        {Icon && (
          <span className={styles.icon}>
            <Icon size={14} aria-hidden="true" />
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(error && errorId, hint && hintId) || undefined}
          className={cn(styles.input, Icon && styles.hasIcon, error && styles.invalid, className)}
          {...props}
        />
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

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, optional = false, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {optional && <span className={styles.optional}>optional</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(styles.textarea, error && styles.invalid, className)}
        {...props}
      />
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});
