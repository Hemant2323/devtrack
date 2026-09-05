import { useCallback, useMemo } from "react";
import { Lock } from "lucide-react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/primitives/Avatar";
import { MessageThread } from "../features/chat/MessageThread";
import {
  useDeleteDm,
  useDmMessages,
  useDmPartners,
  useEditDm,
  useLoadEarlierDm,
  useSendDm,
} from "../features/chat/useDirectMessages";
import { useProjectId } from "../hooks/useProjectId";
import styles from "./DirectMessagePage.module.css";

/**
 * One 1-to-1 conversation.
 *
 * The transcript is the same MessageThread team chat uses, with two rules
 * tightened to match the backend: nobody but the author may delete — a project
 * admin has no moderation power over a message they cannot read — and the
 * archived notice says who can still see the thread.
 *
 * The header names the other participant, so what is private and to whom is
 * never in doubt.
 */
export function DirectMessagePage() {
  const pid = useProjectId();
  const { userId } = useParams();
  const { user } = useAuth();

  // Shares the rail's query, so opening a conversation costs no extra request.
  const { data: partners, isPending: partnersPending } = useDmPartners(pid);
  const partner = useMemo(
    () => (partners ?? []).find((row) => String(row.user_id) === String(userId)),
    [partners, userId],
  );

  const { data: messages, isPending, isError, error, refetch } = useDmMessages(pid, userId);
  const { loadEarlier, isLoading: loadingEarlier, reachedStart } = useLoadEarlierDm(pid, userId);
  const sendMessage = useSendDm(pid, userId);
  const editMessage = useEditDm(pid, userId);
  const deleteMessage = useDeleteDm(pid, userId);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);

  // The server answers 404 when the other person is no longer a member of this
  // project, which is also the answer for a thread that was never reachable.
  // Either way the honest thing to say is that they can't be messaged here.
  const gone = isError && error?.isNotFound;

  const resolveName = useCallback(
    (authorId) => {
      if (authorId === user?.id) return user?.name;
      if (partner && authorId === partner.user_id) return partner.name;
      return undefined; // falls back to the denormalised author_name
    },
    [partner, user],
  );

  // Until the partner list resolves, the URL is all we know — don't invent a
  // name for someone we haven't loaded.
  const displayName = partner?.name ?? (partnersPending ? "" : "This person");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Avatar name={displayName} size="lg" />
        <div className={styles.headerText}>
          <span className={styles.crumb}>{project?.key ?? "Project"} / Direct message</span>
          <h1 className={styles.title}>{displayName || "Conversation"}</h1>
          {partner?.email && <p className={styles.subtitle}>{partner.email}</p>}
        </div>
        <span className={styles.private}>
          <Lock size={12} aria-hidden="true" />
          Only you two
        </span>
      </header>

      {gone ? (
        <div className={styles.centered}>
          <p className={styles.goneTitle}>This conversation isn&apos;t available</p>
          <p className={styles.goneBody}>
            They may no longer be a member of this project. Ask a project admin to
            add them back, or pick someone else from the conversation list.
          </p>
        </div>
      ) : (
        <MessageThread
          messages={messages}
          isPending={isPending}
          isError={isError}
          error={error}
          onRetry={() => refetch()}
          errorTitle="Couldn't load this conversation"
          loadEarlier={loadEarlier}
          loadingEarlier={loadingEarlier}
          reachedStart={reachedStart}
          currentUserId={user?.id}
          currentUserName={user?.name ?? ""}
          resolveName={resolveName}
          canPost={!archived}
          archived={archived}
          // Deliberately false: a DM has no moderator.
          canDeleteAnyMessage={false}
          sendMessage={sendMessage}
          editMessage={editMessage}
          deleteMessage={deleteMessage}
          emptyIcon={Lock}
          emptyTitle={
            displayName ? `No messages with ${displayName} yet` : "No messages yet"
          }
          emptyDescription="Say something — only the two of you can read this conversation."
          startNote="This is the start of your conversation."
          composerPlaceholder={
            displayName ? `Message ${displayName}…` : "Write a message…"
          }
          composerLabel="Write a direct message"
          archivedNotice="This project is archived. The conversation stays readable, but no new messages can be sent."
          deleteEyebrow="Direct message"
          deleteDescription="It will be removed for both of you. This can't be undone."
        />
      )}
    </div>
  );
}
