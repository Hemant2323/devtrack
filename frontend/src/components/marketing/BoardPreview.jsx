import { Avatar } from "../primitives/Avatar";
import { IssueKey, PriorityBars } from "../domain/IssueAtoms";
import styles from "./BoardPreview.module.css";

/**
 * Live product preview for the hero.
 *
 * Built from the same atoms the real board uses (IssueKey, PriorityBars,
 * Avatar) rather than an exported image, so it stays truthful as the product
 * evolves and costs nothing to load.
 */
const COLUMNS = [
  {
    name: "To do",
    count: 3,
    cards: [
      { key: "DEV-42", title: "Coupon code rejected on UPI checkout", priority: "CRITICAL", who: "Asha Shah" },
      { key: "DEV-47", title: "Add pagination to issue search", priority: "LOW", who: "Ravi Kumar" },
    ],
  },
  {
    name: "In progress",
    count: 2,
    cards: [
      { key: "DEV-39", title: "Refresh token not rotating after expiry", priority: "HIGH", who: "Meera Pillai", moving: true },
      { key: "DEV-51", title: "Board column drag target offset", priority: "HIGH", who: "Jon Lee" },
    ],
  },
  {
    name: "Done",
    count: 5,
    cards: [
      { key: "DEV-31", title: "Seed script for demo data", priority: "LOW", who: "Ravi Kumar" },
      { key: "DEV-28", title: "Activity log writes in one transaction", priority: "MEDIUM", who: "Asha Shah" },
    ],
  },
];

export function BoardPreview() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.inner}>
        <div className={styles.chrome}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.chromeTitle}>devtrack — DEV board</span>
        </div>

        <div className={styles.board}>
          {COLUMNS.map((column) => (
            <div className={styles.column} key={column.name}>
              <div className={styles.columnHead}>
                <span className={styles.columnName}>{column.name}</span>
                <span className={styles.columnCount}>{column.count}</span>
              </div>
              {column.cards.map((card) => (
                <div
                  key={card.key}
                  className={`${styles.card} ${card.moving ? styles.moving : ""}`}
                >
                  <p className={styles.cardTitle}>{card.title}</p>
                  <div className={styles.cardMeta}>
                    <IssueKey>{card.key}</IssueKey>
                    <PriorityBars priority={card.priority} />
                    <Avatar name={card.who} size="xs" className={styles.spacer} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
