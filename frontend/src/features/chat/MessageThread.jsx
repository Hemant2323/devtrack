import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ChevronUp,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { ApiError } from "../../api/errors";
import { Avatar } from "../../components/primitives/Avatar";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { EmptyState } from "../../components/primitives/EmptyState";
import { ErrorState } from "../../components/primitives/ErrorState";
import { Textarea } from "../../components/primitives/Input";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "../../components/primitives/Menu";
import { Skeleton } from "../../components/primitives/Skeleton";
import { cn } from "../../lib/cn";
import { formatDate, formatRelative } from "../../lib/format";
import { PAGE_SIZE } from "./useChat";
import styles from "./MessageThread.module.css";

/** Messages within five minutes of the previous one from the same author. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function dayKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toDateString();
}

function SkeletonMessages() {
  return Array.from({ length: 5 }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={28} height={28} radius="999px" />
      <div className={styles.skelBody}>
        <Skeleton width="22%" height={11} />
        <Skeleton width={`${50 + ((i * 13) % 35)}%`} height={12} />
      </div>
    </div>
  ));
}

/**
 * A transcript and its composer.
 *
 * Team chat and a direct message thread are the same reading and writing
 * experience over different data, so both render this: identical grouping, day
 * dividers, auto-scroll rules, edit and delete affordances, and keyboard
 * behaviour. What differs between them — who may delete, what the empty state
 * says, which mutations to call — arrives as props, so the two can never drift
 * apart visually.
 *
 * It renders as a fragment, becoming flex children of the page that owns the
 * column: the transcript takes the free space and the composer stays pinned.
 */
export function MessageThread({
  messages,
  isPending,
  isError,
  error,
  onRetry,
  errorTitle = "Couldn't load the conversation",

  loadEarlier,
  loadingEarlier = false,
  reachedStart = false,

  currentUserId,
  currentUserName = "",
  /** Live directory name for an author id, or null to use the denormalised one. */
  resolveName,

  canPost = false,
  archived = false,
  /** Team chat only: a project admin may remove anyone's message. */
  canDeleteAnyMessage = false,

  sendMessage,
  editMessage,
  deleteMessage,

  emptyIcon = MessagesSquare,
  emptyTitle = "No messages yet",
  emptyDescription,
  startNote = "This is the start of the conversation.",
  composerPlaceholder = "Write a message…",
  composerLabel = "Write a message",
  archivedNotice,
  deleteEyebrow = "Chat",
  deleteDescription = "It will be removed for everyone. This can't be undone.",
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionError, setActionError] = useState(null);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  // Remembers whether the user was already at the bottom before this render,
  // so a poll can't yank them away from older history they're reading.
  const wasAtBottom = useRef(true);
  const previousCount = useRef(0);

  // Record the scroll position before the DOM updates with new messages.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    wasAtBottom.current = distance < 120;
  });

  /* Auto-scroll only when it is welcome: on first load, and afterwards only if
     the reader was already at the bottom. Loading earlier history prepends
     rows, which must not scroll anyone anywhere. */
  useEffect(() => {
    const count = messages?.length ?? 0;
    if (!count) return;
    const grew = count > previousCount.current;
    const first = previousCount.current === 0;
    previousCount.current = count;
    if (first || (grew && wasAtBottom.current)) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  async function handleSend(event) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || !canPost) return;
    setActionError(null);
    try {
      await sendMessage.mutateAsync(body);
      setDraft("");
      wasAtBottom.current = true;
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new ApiError(0, "Could not send"));
    }
  }

  function handleComposerKeyDown(event) {
    // Enter sends; Shift+Enter is a newline.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  async function handleSaveEdit(messageId) {
    const body = editDraft.trim();
    if (!body) return;
    setActionError(null);
    try {
      await editMessage.mutateAsync({ messageId, body });
      setEditingId(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new ApiError(0, "Could not edit"));
    }
  }

  async function handleDelete(messageId) {
    setActionError(null);
    try {
      await deleteMessage.mutateAsync(messageId);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new ApiError(0, "Could not delete"));
    }
  }

  return (
    <>
      {isError ? (
        <div className={styles.centered}>
          <ErrorState title={errorTitle} error={error} onRetry={onRetry} />
        </div>
      ) : (
        <div className={styles.scroll} ref={scrollRef}>
          {isPending && <SkeletonMessages />}

          {!isPending && messages?.length === 0 && (
            <div className={styles.centered}>
              <EmptyState
                icon={emptyIcon}
                title={emptyTitle}
                description={emptyDescription}
              />
            </div>
          )}

          {!isPending && messages?.length > 0 && (
            <>
              {reachedStart ? (
                <p className={styles.startNote}>{startNote}</p>
              ) : (
                messages.length >= PAGE_SIZE && (
                  <div className={styles.earlier}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ChevronUp}
                      loading={loadingEarlier}
                      onClick={loadEarlier}
                    >
                      Load earlier messages
                    </Button>
                  </div>
                )
              )}

              {messages.map((message, index) => {
                const previous = messages[index - 1];
                const newDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
                const grouped =
                  !newDay &&
                  previous?.author_id === message.author_id &&
                  new Date(message.created_at) - new Date(previous.created_at) < GROUP_WINDOW_MS;

                const isAuthor = message.author_id === currentUserId;
                const canEdit = isAuthor && !archived;
                const canDelete = (isAuthor || canDeleteAnyMessage) && !archived;
                const editing = editingId === message.id;
                // Prefer the live directory name; fall back to the denormalised
                // one for an author who has since left the project.
                const name = resolveName?.(message.author_id) ?? message.author_name;

                return (
                  <div key={message.id}>
                    {newDay && (
                      <div className={styles.dayDivider}>
                        <span className={styles.dayLabel}>{formatDate(message.created_at)}</span>
                      </div>
                    )}

                    <article className={cn(styles.message, grouped && styles.grouped)}>
                      <span className={styles.avatarSlot}>
                        {!grouped && <Avatar name={name} size="md" />}
                      </span>

                      <div className={styles.body}>
                        {!grouped && (
                          <div className={styles.meta}>
                            <span className={styles.author}>{name}</span>
                            <time
                              className={styles.time}
                              title={formatDate(message.created_at)}
                            >
                              {formatRelative(message.created_at)}
                            </time>
                            {message.edited_at && (
                              <span className={styles.edited}>(edited)</span>
                            )}
                          </div>
                        )}

                        {editing ? (
                          <div className={styles.editForm}>
                            <Textarea
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                              rows={2}
                              aria-label="Edit message"
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  handleSaveEdit(message.id);
                                }
                                if (event.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                            />
                            <div className={styles.editActions}>
                              <span className={styles.editHint}>
                                Enter saves · Escape cancels
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={editMessage.isPending}
                                disabled={!editDraft.trim()}
                                onClick={() => handleSaveEdit(message.id)}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className={styles.text}>{message.body}</p>
                            {grouped && message.edited_at && (
                              <span className={styles.edited}>(edited)</span>
                            )}
                          </>
                        )}
                      </div>

                      {(canEdit || canDelete) && !editing && (
                        <span className={styles.actions}>
                          <Menu>
                            <MenuTrigger
                              className={styles.actionButton}
                              aria-label={`Actions for ${name}'s message`}
                            >
                              <MoreHorizontal size={15} />
                            </MenuTrigger>
                            <MenuContent align="end">
                              {canEdit && (
                                <MenuItem
                                  icon={Pencil}
                                  onSelect={() => {
                                    setEditDraft(message.body);
                                    setEditingId(message.id);
                                  }}
                                >
                                  Edit message
                                </MenuItem>
                              )}
                              {canDelete && (
                                <MenuItem
                                  icon={Trash2}
                                  danger
                                  onSelect={() => setConfirmDelete(message)}
                                >
                                  Delete message
                                </MenuItem>
                              )}
                            </MenuContent>
                          </Menu>
                        </span>
                      )}
                    </article>
                  </div>
                );
              })}
            </>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {actionError && (
        <p className={styles.errorBar} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{actionError.message}</span>
          <button
            type="button"
            className={styles.errorDismiss}
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      {archived ? (
        <p className={styles.archivedComposer}>
          <Archive size={15} aria-hidden="true" />
          {archivedNotice}
        </p>
      ) : (
        canPost && (
          <form className={styles.composer} onSubmit={handleSend}>
            <div className={styles.composerRow}>
              <Avatar name={currentUserName} size="md" />
              <div className={styles.composerBody}>
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={composerPlaceholder}
                  rows={2}
                  maxLength={10000}
                  aria-label={composerLabel}
                />
                <div className={styles.composerFoot}>
                  <span className={styles.composerHint}>
                    <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={sendMessage.isPending}
                    disabled={!draft.trim()}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )
      )}

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent
          eyebrow={deleteEyebrow}
          title="Delete this message?"
          description={deleteDescription}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={deleteMessage.isPending}
                onClick={() => handleDelete(confirmDelete.id)}
              >
                Delete message
              </Button>
            </>
          }
        >
          <p className={styles.text}>{confirmDelete?.body}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
