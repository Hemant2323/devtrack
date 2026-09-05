import { useCallback } from "react";
import { MessagesSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { MessageThread } from "../features/chat/MessageThread";
import {
  useChatMessages,
  useDeleteMessage,
  useEditMessage,
  useLoadEarlier,
  useSendMessage,
} from "../features/chat/useChat";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useProjectId } from "../hooks/useProjectId";
import { ROLE } from "../lib/enums";
import styles from "./ChatPage.module.css";

/**
 * Team chat.
 *
 * Near-realtime by polling every 10s (see useChat for why not sockets). The
 * transcript and composer are MessageThread, shared with direct messages; this
 * page supplies the header, the permissions and the data.
 *
 * Permissions mirror the backend exactly: any member reads and posts, only the
 * author edits, the author or a project admin deletes, and an archived project
 * is read-only.
 */
export function ChatPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const { members, memberById } = useProjectDirectory(pid);

  const { data: messages, isPending, isError, error, refetch } = useChatMessages(pid);
  const { loadEarlier, isLoading: loadingEarlier, reachedStart } = useLoadEarlier(pid);
  const sendMessage = useSendMessage(pid);
  const editMessage = useEditMessage(pid);
  const deleteMessage = useDeleteMessage(pid);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);
  const myRole = members.find((member) => member.user_id === user?.id)?.role;
  const isAdmin = myRole === ROLE.ADMIN.value;
  const canPost = Boolean(myRole) && !archived;

  const resolveName = useCallback(
    (authorId) => memberById.get(authorId)?.name,
    [memberById],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.crumb}>{project?.key ?? "Project"} / Chat</span>
          <h1 className={styles.title}>Team chat</h1>
          <p className={styles.subtitle}>
            Everyone on this project can read and post here.
          </p>
        </div>
        {!isPending && !isError && !archived && (
          <span className={styles.live}>
            <span className={styles.liveDot} aria-hidden="true" />
            Updates every 10s
          </span>
        )}
      </header>

      <MessageThread
        messages={messages}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        errorTitle="Couldn't load the chat"
        loadEarlier={loadEarlier}
        loadingEarlier={loadingEarlier}
        reachedStart={reachedStart}
        currentUserId={user?.id}
        currentUserName={user?.name ?? ""}
        resolveName={resolveName}
        canPost={canPost}
        archived={archived}
        canDeleteAnyMessage={isAdmin}
        sendMessage={sendMessage}
        editMessage={editMessage}
        deleteMessage={deleteMessage}
        emptyIcon={MessagesSquare}
        emptyTitle="No messages yet"
        emptyDescription={
          canPost
            ? "Start the conversation — everyone on this project will see it."
            : "Messages posted by the project team will appear here."
        }
        archivedNotice="This project is archived. The conversation stays readable, but no new messages can be posted."
        deleteEyebrow="Team chat"
      />
    </div>
  );
}
