import { useRef } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/primitives/Avatar";
import { IssueKey, PriorityBars, StatusChip } from "../components/domain/IssueAtoms";
import { LogoMark } from "../components/domain/Logo";
import { BoardPreview } from "../components/marketing/BoardPreview";
import { Lanes } from "../components/marketing/Lanes";
import { SiteNav } from "../components/marketing/SiteNav";
import { useReveal } from "../hooks/useReveal";
import styles from "../components/marketing/Marketing.module.css";

const TRUST = [
  { figure: "4", label: "workflow states" },
  { figure: "3", label: "project roles" },
  { figure: "6", label: "filter dimensions" },
  { figure: "100%", label: "audit coverage" },
];

const BAND = [
  { figure: "Tasks & bugs", label: "ONE WORKFLOW" },
  { figure: "Append-only", label: "ACTIVITY LOG" },
  { figure: "Per project", label: "ROLE PERMISSIONS" },
  { figure: "DEV-42", label: "READABLE KEYS" },
];

const ISSUE_ROWS = [
  { key: "DEV-42", title: "Coupon code rejected on UPI checkout", status: "TODO", priority: "CRITICAL", who: "Asha Shah" },
  { key: "DEV-39", title: "Refresh token not rotating after expiry", status: "IN_PROGRESS", priority: "HIGH", who: "Meera Pillai" },
  { key: "DEV-44", title: "Verify board grouping under load", status: "TESTING", priority: "HIGH", who: "Jon Lee" },
  { key: "DEV-28", title: "Activity log writes in one transaction", status: "DONE", priority: "LOW", who: "Ravi Kumar" },
];

const ACTIVITY = [
  { who: "Asha", text: "moved DEV-39 from In Progress to Testing", when: "2 minutes ago" },
  { who: "Ravi", text: "changed priority from Medium to High", when: "18 minutes ago" },
  { who: "Meera", text: "commented on DEV-42", when: "1 hour ago" },
  { who: "Asha", text: "created DEV-42 as a Bug", when: "3 hours ago" },
];

const TECH = [
  "FastAPI", "SQLAlchemy 2", "Alembic", "React 19", "TanStack Query", "PostgreSQL ready",
];

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8.5l3.2 3.2L13 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Public landing page.
 *
 * The one place in DevTrack that uses the display type scale and the ink
 * surface tier. The authenticated workspace deliberately shares its tokens
 * but none of its composition — marketing gets scale, the app gets density.
 */
export function LandingPage() {
  const root = useRef(null);
  useReveal(root, { selector: `.${styles.reveal}` });

  return (
    <div ref={root}>
      <SiteNav />

      <header className={styles.hero}>
        <Lanes />
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div>
            <span className={`${styles.eyebrow} ${styles.heroEyebrow} ${styles.reveal}`}>
              Project management &amp; bug tracking
            </span>
            <h1 className={`${styles.heroTitle} ${styles.reveal}`}>
              Every issue, from
              <br />
              report to <em>resolved</em>.
            </h1>
            <p className={`${styles.heroSub} ${styles.reveal}`}>
              A Kanban board, a bug tracker and a permanent activity trail in one
              workspace. Built for engineering teams who want to know exactly where the
              work stands — without asking.
            </p>
            <div className={`${styles.heroActions} ${styles.reveal}`}>
              <Link to="/signup" className={`${styles.btn} ${styles.btnPrimary}`}>
                Start tracking
              </Link>
              <a href="#workflow" className={`${styles.btn} ${styles.btnGhostInk}`}>
                See the board
              </a>
            </div>
            <div className={`${styles.trust} ${styles.reveal}`}>
              {TRUST.map((item) => (
                <div key={item.label}>
                  <b>{item.figure}</b>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.reveal}>
            <BoardPreview />
          </div>
        </div>
      </header>

      <section className={styles.band}>
        <div className={`${styles.wrap} ${styles.bandGrid}`}>
          {BAND.map((item) => (
            <div className={`${styles.bandItem} ${styles.reveal}`} key={item.label}>
              <b>{item.figure}</b>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.features} id="workflow">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>How the work moves</span>
            <h2>A workspace that answers &ldquo;where is this?&rdquo; before anyone asks.</h2>
            <p>
              Four states, two issue types, one trail of every change. Nothing to
              configure before you can file the first bug.
            </p>
          </div>

          <div className={`${styles.frow} ${styles.reveal}`}>
            <div>
              <h3>A board that reflects reality</h3>
              <p className={styles.frowLead}>
                Drag an issue between states and the change lands immediately —
                optimistically in the interface, atomically in the database, and
                permanently in the activity log.
              </p>
              <ul className={styles.flist}>
                <li><Check />To Do, In Progress, Testing, Done</li>
                <li><Check />Keyboard-operable drag and drop</li>
                <li><Check />Assignee notified on every move</li>
              </ul>
            </div>
            <div className={styles.frowMedia}>
              {ISSUE_ROWS.map((row) => (
                <div className={styles.miniRow} key={row.key}>
                  <IssueKey>{row.key}</IssueKey>
                  <span className={styles.miniTitle}>{row.title}</span>
                  <StatusChip status={row.status} />
                  <PriorityBars priority={row.priority} />
                  <Avatar name={row.who} size="xs" />
                </div>
              ))}
            </div>
          </div>

          <div className={`${styles.frow} ${styles.flip} ${styles.reveal}`} id="issues">
            <div>
              <h3>Bugs carry what bugs need</h3>
              <p className={styles.frowLead}>
                A bug is not a task with a red label. It gets severity and steps to
                reproduce, and the form refuses to accept one without the other.
              </p>
              <ul className={styles.flist}>
                <li><Check />Minor through Blocker severity</li>
                <li><Check />Validated server-side, surfaced inline</li>
                <li><Check />Filter by component, assignee, priority</li>
              </ul>
            </div>
            <div className={styles.frowMedia}>
              <div className={styles.act}>
                {ACTIVITY.map((item) => (
                  <div className={styles.actItem} key={item.text}>
                    <p>
                      <b>{item.who}</b> {item.text}
                    </p>
                    <time>{item.when}</time>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.tech} id="built">
        <div className={`${styles.wrap} ${styles.techIn}`}>
          {TECH.map((item, index) => (
            <span key={item} style={{ display: "contents" }}>
              {index > 0 && <i />}
              <span>{item}</span>
            </span>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <Lanes />
        <div className={styles.wrap}>
          <h2 className={styles.reveal}>Put the board where the work already is.</h2>
          <p className={`${styles.closingSub} ${styles.reveal}`}>
            Create a project, invite the team, file the first issue. Nothing else to set up.
          </p>
          <div className={`${styles.heroActions} ${styles.reveal}`}>
            <Link to="/signup" className={`${styles.btn} ${styles.btnPrimary}`}>
              Start tracking
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerIn}`}>
          <LogoMark size={16} />
          <span>Project management &amp; bug tracking</span>
          <span className={styles.footerSpacer}>&copy; 2026 DevTrack</span>
        </div>
      </footer>
    </div>
  );
}
