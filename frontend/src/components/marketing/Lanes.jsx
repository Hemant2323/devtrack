import styles from "./Lanes.module.css";

/** Decorative lane geometry for ink surfaces. Purely visual, hidden from AT. */
export function Lanes() {
  return (
    <div className={styles.lanes} aria-hidden="true">
      <span className={styles.lane} />
      <span className={styles.lane} />
      <span className={styles.lane} />
    </div>
  );
}
