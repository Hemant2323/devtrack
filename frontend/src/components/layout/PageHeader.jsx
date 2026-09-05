import styles from "./PageHeader.module.css";

/**
 * Consistent page title block. Every page uses this rather than its own h1,
 * which is what keeps title size, breadcrumb style and action placement from
 * drifting between screens.
 */
export function PageHeader({ eyebrow, title, description, actions, tabs }) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.text}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {tabs && <div className={styles.tabs}>{tabs}</div>}
    </header>
  );
}

export { styles as pageHeaderStyles };
