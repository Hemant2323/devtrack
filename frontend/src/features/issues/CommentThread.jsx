import { useState } from "react";
import { AlertCircle, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { ApiError } from "../../api/errors";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/primitives/Avatar";
import { Button } from "../../components/primitives/Button";
import { EmptyState } from "../../components/primitives/EmptyState";
import { ErrorState } from "../../components/primitives/ErrorState";
import { Skeleton } from "../../components/primitives/Skeleton";
import { Textarea } from "../../components/primitives/Input";
import { Tooltip } from "../../components/primitives/Tooltip";
import { formatDate, formatRelative } from "../../lib/format";
import { ROLE } from "../../lib/enums";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "./useIssues";
import styles from "./CommentThread.module.css";

/**
 * Comment thread.
 *
 * CommentResponse carries `author_name` denormalised, so unlike issues this is
 * the one place that needs no id -> name join.
 *
 * Permissions mirror the backend exactly (comment_service):
 *   edit   — the author only
 *   delete — the author, or a project admin
 * Controls the current user cannot use are not rendered; the server enforces
 * the same rules regardless.
 */
export function CommentThread({ iid, myRole, archived }) {
  const { user } = useAuth();
  const { data: comments, isPending, isError, error, refetch } = useComments(iid);
  const createComment = useCreateComment(iid);
  const updateComment = useUpdateComment(iid);
  const deleteComment = useDeleteComment(iid);

  const [draft, setDraft] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  const isAdmin = myRole === ROLE.ADMIN.value;

  async function handleSubmit(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSubmitError(null);
    try {
      await createComment.mutateAsync(body);
      setDraft("");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err : new ApiError(0, "Could not post comment"));
    }
  }

  async function handleEditSave(commentId) {
    const body = editDraft.trim();
    if (!body) return;
    try {
      await updateComment.mutateAsync({ commentId, body });
      setEditingId(null);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err : new ApiError(0, "Could not edit comment"));
    }
  }

  if (isError) {
    return <ErrorState compact title="Couldn't load comments" error={error} onRetry={refetch} />;
  }

  return (
    <div className={styles.thread}>
      {isPending && (
        <div className={styles.comment}>
          <Skeleton width={24} height={24} radius="999px" />
          <div className={styles.body}>
            <Skeleton width="30%" height={12} />
            <div style={{ height: 8 }} />
            <Skeleton width="90%" height={12} />
          </div>
        </div>
      )}

      {!isPending && comments?.length === 0 && (
        <EmptyState
          compact
          icon={MessageSquare}
          title="No comments yet"
          description="Discussion about this issue will appear here."
        />
      )}

      {!isPending &&
        comments?.map((comment) => {
          const isAuthor = comment.author_id === user?.id;
          const editing = editingId === comment.id;
          return (
            <article className={styles.comment} key={comment.id}>
              <Avatar name={comment.author_name} size="sm" />
              <div className={styles.body}>
                <div className={styles.meta}>
                  <span className={styles.author}>{comment.author_name}</span>
                  <time className={styles.time} title={formatDate(comment.created_at)}>
                    {formatRelative(comment.created_at)}
                  </time>
                  {comment.edited_at && <span className={styles.edited}>edited</span>}

                  {(isAuthor || isAdmin) && !editing && (
                    <span className={styles.actions}>
                      {isAuthor && (
                        <Tooltip content="Edit">
                          <button
                            type="button"
                            className={styles.actionButton}
                            aria-label="Edit comment"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditDraft(comment.body);
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip content="Delete">
                        <button
                          type="button"
                          className={styles.actionButton}
                          aria-label="Delete comment"
                          onClick={() => deleteComment.mutate(comment.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </Tooltip>
                    </span>
                  )}
                </div>

                {editing ? (
                  <div className={styles.editForm}>
                    <Textarea
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      rows={3}
                      aria-label="Edit comment"
                    />
                    <div className={styles.formActions}>
                      <span className={styles.formHint} />
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={updateComment.isPending}
                        disabled={!editDraft.trim()}
                        onClick={() => handleEditSave(comment.id)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.text}>{comment.body}</p>
                )}
              </div>
            </article>
          );
        })}

      {archived ? (
        <p className={styles.archivedNote}>
          This project is archived — existing comments stay readable, but new ones
          can&rsquo;t be added.
        </p>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <Avatar name={user?.name ?? ""} size="sm" />
          <div className={styles.formBody}>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a comment…"
              rows={3}
              maxLength={10000}
              aria-label="Add a comment"
            />
            {submitError && (
              <p className={styles.error} role="alert">
                <AlertCircle size={13} aria-hidden="true" />
                {submitError.message}
              </p>
            )}
            <div className={styles.formActions}>
              <span className={styles.formHint}>
                Comments notify the assignee.
              </span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={createComment.isPending}
                disabled={!draft.trim()}
              >
                Comment
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
