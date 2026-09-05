import { CheckCircle2, Inbox, Target, Undo2 } from "lucide-react";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import styles from "./Sprints.module.css";

/**
 * The completed-vs-planned report (FR-5.4).
 *
 * This is the mutation's response, shown once. The backend does not persist
 * it — after completion the unfinished issues have already left the sprint,
 * so the original planned scope cannot be reconstructed later. That is why the
 * dialog opens automatically on completion rather than being something the
 * user navigates to.
 */
export function SprintReportDialog({ report, open, onOpenChange }) {
  if (!report) return null;

  const { sprint, planned, completed, returned_to_backlog: returned } = report;
  const rate = planned === 0 ? 0 : Math.round((completed / planned) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Sprint completed"
        title={sprint.name}
        description="Unfinished issues have been returned to the backlog."
        footer={
          <DialogClose asChild>
            <Button variant="primary">Done</Button>
          </DialogClose>
        }
      >
        <div className={styles.reportRate}>
          <span className={styles.reportRateValue}>{rate}%</span>
          <span className={styles.reportRateLabel}>
            of planned work completed
          </span>
        </div>

        <div className={styles.reportGrid}>
          <div className={styles.reportStat}>
            <Target size={15} aria-hidden="true" />
            <span className={styles.reportStatValue}>{planned}</span>
            <span className={styles.reportStatLabel}>Planned</span>
          </div>
          <div className={styles.reportStat}>
            <CheckCircle2 size={15} aria-hidden="true" />
            <span className={styles.reportStatValue}>{completed}</span>
            <span className={styles.reportStatLabel}>Completed</span>
          </div>
          <div className={styles.reportStat}>
            <Inbox size={15} aria-hidden="true" />
            <span className={styles.reportStatValue}>{returned}</span>
            <span className={styles.reportStatLabel}>To backlog</span>
          </div>
        </div>

        {returned > 0 && (
          <p className={styles.reportNote}>
            <Undo2 size={13} aria-hidden="true" />
            {returned} unfinished {returned === 1 ? "issue is" : "issues are"} back in the
            backlog and can be planned into another sprint.
          </p>
        )}

        <p className={styles.reportFootnote}>
          This report is generated at completion and is not stored — take a note
          of it if you need it later.
        </p>
      </DialogContent>
    </Dialog>
  );
}
