import { forwardRef } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";
import styles from "./Button.module.css";

/**
 * The app's single button. Variants exist so no page ever writes its own
 * button styling — that is how spacing and radius drift between pages.
 *
 * variant: primary | secondary | ghost | danger | subtle
 * size:    sm | md | lg
 */
export const Button = forwardRef(function Button(
  {
    variant = "secondary",
    size = "md",
    iconOnly = false,
    block = false,
    loading = false,
    disabled = false,
    icon: Icon = null,
    iconAfter: IconAfter = null,
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        iconOnly && styles.iconOnly,
        block && styles.block,
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner}>
          <Spinner size={size === "lg" ? 16 : 14} />
        </span>
      ) : (
        Icon && <Icon size={size === "sm" ? 14 : 16} aria-hidden="true" />
      )}
      {!iconOnly && children}
      {!iconOnly && !loading && IconAfter && <IconAfter size={14} aria-hidden="true" />}
    </button>
  );
});
