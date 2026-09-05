import { useMemo, useState } from "react";
import { Search, SquarePen, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Avatar } from "../../components/primitives/Avatar";
import { Button } from "../../components/primitives/Button";
import { ErrorState } from "../../components/primitives/ErrorState";
import { Input } from "../../components/primitives/Input";
import { Skeleton } from "../../components/primitives/Skeleton";
import { cn } from "../../lib/cn";
import { formatRelative, matches } from "../../lib/format";
import { NewDmDialog } from "./NewDmDialog";
import { useDmPartners } from "./useDirectMessages";
import styles from "./ConversationRail.module.css";

/** Above this many conversations, scanning beats reading — add a filter. */
const FILTER_THRESHOLD = 6;

function RailSkeleton() {
  return Array.from({ length: 4 }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={28} height={28} radius="999px" />
      <div className={styles.skelBody}>
        <Skeleton width={`${45 + ((i * 11) % 30)}%`} height={11} />
        <Skeleton width={`${60 + ((i * 7) % 25)}%`} height={10} />
      </div>
    </div>
  ));
}

/**
 * The conversation list beside the transcript: team chat first, then the
 * caller's direct messages.
 *
 * This is the whole navigation model for chat — one rail rather than a second
 * sidebar section — so the distinction between a message everyone can read and
 * a message two people can read is visible in one glance, without leaving the
 * Chat area.
 *
 * Only conversations that exist are listed. Everyone else is reachable through
 * "New message", which keeps the rail calm on a project with many members and
 * makes starting a conversation a deliberate act.
 */
export function ConversationRail({ pid, className, onNavigate }) {
  const { data: partners, isPending, isError, error, refetch } = useDmPartners(pid);
  const [filter, setFilter] = useState("");
  const [picking, setPicking] = useState(false);

  const conversations = useMemo(
    () => (partners ?? []).filter((partner) => partner.last_message_at),
    [partners],
  );

  const visible = useMemo(
    () => conversations.filter((partner) => matches(partner.name, filter)),
    [conversations, filter],
  );

  const showFilter = conversations.length > FILTER_THRESHOLD;

  return (
    <nav className={cn(styles.rail, className)} aria-label="Conversations">
      <div className={styles.section}>
        <NavLink
          to={`/projects/${pid}/chat`}
          end
          onClick={onNavigate}
          className={({ isActive }) => cn(styles.row, isActive && styles.rowActive)}
        >
          <span className={styles.teamIcon} aria-hidden="true">
            <Users size={14} />
          </span>
          <span className={styles.rowBody}>
            <span className={styles.rowTop}>
              <span className={styles.name}>Team chat</span>
            </span>
            <span className={styles.preview}>Everyone on this project</span>
          </span>
        </NavLink>
      </div>

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Direct messages</h2>
      </div>

      <div className={styles.newWrap}>
        <Button
          variant="secondary"
          size="sm"
          icon={SquarePen}
          block
          onClick={() => setPicking(true)}
        >
          New message
        </Button>
      </div>

      {showFilter && (
        <div className={styles.filter}>
          <Input
            type="search"
            icon={Search}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter conversations"
            aria-label="Filter conversations"
          />
        </div>
      )}

      <div className={styles.list}>
        {isPending && <RailSkeleton />}

        {isError && (
          <div className={styles.railError}>
            <ErrorState
              compact
              title="Couldn't load conversations"
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        )}

        {!isPending && !isError && conversations.length === 0 && (
          <p className={styles.note}>
            No direct messages yet. Start one with anybody on this project.
          </p>
        )}

        {!isPending && !isError && conversations.length > 0 && visible.length === 0 && (
          <p className={styles.note}>No conversations match “{filter}”.</p>
        )}

        {visible.map((partner) => (
          <NavLink
            key={partner.user_id}
            to={`/projects/${pid}/chat/dm/${partner.user_id}`}
            onClick={onNavigate}
            className={({ isActive }) => cn(styles.row, isActive && styles.rowActive)}
          >
            <Avatar name={partner.name} size="md" />
            <span className={styles.rowBody}>
              <span className={styles.rowTop}>
                <span className={styles.name}>{partner.name}</span>
                <time className={styles.when} title={partner.last_message_at}>
                  {formatRelative(partner.last_message_at)}
                </time>
              </span>
              {/* A preview of the caller's own conversation — never anyone
                  else's; the server only returns threads they take part in. */}
              <span className={styles.preview}>{partner.last_message_body}</span>
            </span>
          </NavLink>
        ))}
      </div>

      <NewDmDialog
        pid={pid}
        open={picking}
        onOpenChange={setPicking}
        partners={partners ?? []}
        isPending={isPending}
        isError={isError}
        onNavigate={onNavigate}
      />
    </nav>
  );
}
