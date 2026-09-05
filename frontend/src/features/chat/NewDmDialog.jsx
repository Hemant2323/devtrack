import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../../components/primitives/Avatar";
import { Dialog, DialogContent } from "../../components/primitives/Dialog";
import { Input } from "../../components/primitives/Input";
import { formatRelative, matches } from "../../lib/format";
import styles from "./NewDmDialog.module.css";

/**
 * Pick someone to message.
 *
 * The list is the DM partner list the rail already loaded — the server derives
 * it from project membership and excludes the caller, so there is no way to
 * pick yourself and no second member-management path to keep in step. Nobody
 * outside the project can appear here.
 */
export function NewDmDialog({
  pid,
  open,
  onOpenChange,
  partners,
  isPending = false,
  isError = false,
  onNavigate,
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  // Each opening starts from a clean list rather than the last search.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const visible = useMemo(
    () =>
      (partners ?? []).filter(
        (partner) => matches(partner.name, query) || matches(partner.email, query),
      ),
    [partners, query],
  );

  function startConversation(userId) {
    onOpenChange(false);
    onNavigate?.();
    navigate(`/projects/${pid}/chat/dm/${userId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Direct messages"
        title="New message"
        description="Choose a project member to start a private conversation with."
        onOpenAutoFocus={(event) => {
          // Land in the search field rather than on the first person, so
          // typing filters instead of selecting.
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <Input
          ref={searchRef}
          type="search"
          icon={Search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          aria-label="Search project members"
        />

        <div className={styles.list}>
          {isPending && <p className={styles.note}>Loading project members…</p>}

          {isError && (
            <p className={styles.note} role="alert">
              Couldn&apos;t load project members. Close this and try again.
            </p>
          )}

          {!isPending && !isError && (partners ?? []).length === 0 && (
            <p className={styles.note}>
              You are the only member of this project. Add someone on the Members
              page to start a conversation.
            </p>
          )}

          {!isPending && !isError && (partners ?? []).length > 0 && visible.length === 0 && (
            <p className={styles.note}>Nobody matches “{query}”.</p>
          )}

          {visible.map((partner) => (
            <button
              key={partner.user_id}
              type="button"
              className={styles.person}
              onClick={() => startConversation(partner.user_id)}
            >
              <Avatar name={partner.name} size="md" />
              <span className={styles.personBody}>
                <span className={styles.personName}>{partner.name}</span>
                <span className={styles.personMeta}>{partner.email}</span>
              </span>
              {partner.last_message_at && (
                <span className={styles.personWhen}>
                  {formatRelative(partner.last_message_at)}
                </span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
