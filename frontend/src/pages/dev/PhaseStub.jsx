import { PageHeader } from "../../components/layout/PageHeader";
import styles from "./PhaseStub.module.css";

/**
 * Temporary development scaffold.
 *
 * These exist only so the Phase 1 shell has real routes to navigate between.
 * Each one is replaced by its actual page in the phase named below, and none
 * of them stands in for a feature the backend cannot support.
 */
export function PhaseStub({ title, phase, description }) {
  return (
    <>
      <PageHeader title={title} />
      <div className={styles.stub}>
        <div className={styles.panel}>
          <span className={styles.phase}>{phase}</span>
          <h2 className={styles.title}>Not built yet</h2>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
    </>
  );
}
