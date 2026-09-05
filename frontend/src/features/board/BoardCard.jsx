import { CircleSlash, MoveRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/primitives/Avatar";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../../components/primitives/Menu";
import { Tooltip } from "../../components/primitives/Tooltip";
import {
  IssueKey,
  PriorityBars,
  SeverityChip,
  TypeIcon,
} from "../../components/domain/IssueAtoms";
import { cn } from "../../lib/cn";
import { BOARD_COLUMNS, statusOf } from "../../lib/enums";
import styles from "../../pages/BoardPage.module.css";

/**
 * One issue on the board.
 *
 * Two ways to change status, deliberately:
 *   - native HTML5 drag for pointer users (no dependency, no drag library)
 *   - a "Move to" menu, which is the keyboard and touch path
 *
 * The menu is not a fallback bolted on afterwards: HTML5 drag does not fire on
 * touch and is not keyboard-operable, so the menu is the accessible primary
 * and drag is the enhancement.
 *
 * The card itself is not a link — a link that is also draggable fights the
 * browser's native link-drag. The title is the link instead.
 */
export function BoardCard({
  pid,
  issue,
  assignee,
  component,
  pending,
  canEdit,
  blocked = false,
  onMove,
}) {
  const currentStatus = statusOf(issue.status);

  return (
    <article
      className={cn(styles.card, pending && styles.cardPending)}
      draggable={canEdit && !pending}
      aria-roledescription={canEdit ? "Draggable issue card" : undefined}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(issue.id));
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add(styles.cardDragging);
      }}
      onDragEnd={(event) => {
        event.currentTarget.classList.remove(styles.cardDragging);
      }}
    >
      <div className={styles.cardTop}>
        <TypeIcon type={issue.type} />
        <Link to={`/projects/${pid}/issues/${issue.id}`} className={styles.cardKey}>
          <IssueKey>{issue.key}</IssueKey>
        </Link>

        {canEdit && (
          <span className={styles.cardMenu}>
            <Menu>
              <Tooltip content="Move to…">
                <MenuTrigger
                  className={styles.menuButton}
                  aria-label={`Move ${issue.key} to another status`}
                  disabled={pending}
                >
                  <MoveRight size={14} />
                </MenuTrigger>
              </Tooltip>
              <MenuContent align="end">
                <MenuLabel>Move to</MenuLabel>
                <MenuRadioGroup
                  value={issue.status}
                  onValueChange={(status) => {
                    if (status !== issue.status) onMove(issue.id, status);
                  }}
                >
                  {BOARD_COLUMNS.map((column) => (
                    <MenuRadioItem key={column.status} value={column.status}>
                      {statusOf(column.status).label}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuContent>
            </Menu>
          </span>
        )}
      </div>

      <Link to={`/projects/${pid}/issues/${issue.id}`} className={styles.cardTitle}>
        {issue.title}
      </Link>

      {/* Advisory only — a blocked card still drags, still moves, still
          closes. The board says so; the team decides. */}
      {blocked && (
        <Tooltip content="At least one blocker is still open">
          <span className={styles.cardBlocked}>
            <CircleSlash size={11} aria-hidden="true" />
            Blocked
          </span>
        </Tooltip>
      )}

      <div className={styles.cardFoot}>
        <PriorityBars priority={issue.priority} />
        {issue.severity && <SeverityChip severity={issue.severity} />}
        {component && <span className={styles.cardComponent}>{component.name}</span>}
        <span className={styles.cardSpacer}>
          {/* The status is already encoded by the column, so the card carries
              the label only for assistive tech rather than a redundant chip. */}
          <span className="sr-only">Status: {currentStatus.label}</span>
          {assignee ? (
            <Tooltip content={assignee.name}>
              <span>
                <Avatar name={assignee.name} size="xs" />
              </span>
            </Tooltip>
          ) : (
            <span className={styles.unassigned} aria-label="Unassigned">
              —
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
