import { ChevronLeft, MessagesSquare } from "lucide-react";
import { Link, Outlet, useMatch } from "react-router-dom";
import { EmptyState } from "../components/primitives/EmptyState";
import { ConversationRail } from "../features/chat/ConversationRail";
import { useMediaQuery, BREAKPOINTS } from "../hooks/useMediaQuery";
import { useProjectId } from "../hooks/useProjectId";
import styles from "./ChatLayout.module.css";

/**
 * The Chat area: one conversation rail, one open conversation.
 *
 * Team chat and direct messages share this frame rather than becoming two
 * sidebar destinations, so moving between "everyone" and "one person" is a
 * click inside the same place, and the distinction stays visible.
 *
 * This element is the one pinned to the viewport — it is the height of the
 * shell's content row — and each pane inside simply fills it. That keeps the
 * transcript's scroll region the only scroller, as before.
 *
 * Narrow screens get master–detail instead of two columns: the rail is the
 * whole screen at /chat/dm, and opening a conversation replaces it with the
 * thread plus a way back. No nested drawer, no second navigation model.
 */
export function ChatLayout() {
  const pid = useProjectId();
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const atConversationList = Boolean(useMatch("/projects/:pid/chat/dm"));

  if (isMobile) {
    return atConversationList ? (
      <div className={styles.mobileList}>
        <ConversationRail pid={pid} className={styles.railFull} />
      </div>
    ) : (
      <div className={styles.mobilePane}>
        <Link className={styles.back} to={`/projects/${pid}/chat/dm`}>
          <ChevronLeft size={15} aria-hidden="true" />
          Conversations
        </Link>
        <div className={styles.paneBody}>
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <ConversationRail pid={pid} className={styles.rail} />
      <div className={styles.pane}>
        <Outlet />
      </div>
    </div>
  );
}

/**
 * /chat/dm on a wide screen: the rail is already showing, so this side just
 * says what to do next. On a narrow screen the rail takes the whole screen and
 * this never renders.
 */
export function DirectMessagesIndex() {
  return (
    <div className={styles.placeholder}>
      <EmptyState
        icon={MessagesSquare}
        title="Select a conversation"
        description="Choose someone from the list, or start a new message with anyone on this project."
      />
    </div>
  );
}
