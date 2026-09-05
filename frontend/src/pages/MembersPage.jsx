import { useState } from "react";
import { AlertCircle, Archive, ChevronDown, UserMinus, UserPlus, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { Avatar } from "../components/primitives/Avatar";
import { Badge } from "../components/primitives/Badge";
import { Button } from "../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../components/primitives/Dialog";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../components/primitives/Menu";
import { Skeleton } from "../components/primitives/Skeleton";
import { Tooltip } from "../components/primitives/Tooltip";
import { AddMemberDialog } from "../features/members/AddMemberDialog";
import {
  adminCount,
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from "../features/members/useMembers";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { ROLE } from "../lib/enums";
import { formatDate, formatRelative } from "../lib/format";
import styles from "./MembersPage.module.css";

const ROLE_OPTIONS = Object.values(ROLE);

function SkeletonRows() {
  return Array.from({ length: 4 }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={28} height={28} radius="999px" />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Skeleton width={`${35 + ((i * 11) % 25)}%`} height={12} />
        <Skeleton width="45%" height={10} />
      </div>
      <Skeleton width={72} height={20} radius="4px" />
      <Skeleton width={70} height={11} />
      <span />
    </div>
  ));
}

/**
 * Project members.
 *
 * Runs entirely on endpoints that already existed. Mutation controls are shown
 * only to admins on a non-archived project, matching what the backend enforces
 * — the server stays authoritative, and a 403 would still be surfaced if the
 * two ever disagreed.
 *
 * One rule is added here that the backend does not enforce: the last remaining
 * admin cannot demote or remove themselves. The API would allow it and leave
 * the project unmanageable, so the control is disabled with an explanation
 * rather than silently permitted.
 */
export function MembersPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const { data: members, isPending, isError, error, refetch } = useMembers(pid);
  const updateRole = useUpdateMemberRole(pid);
  const removeMember = useRemoveMember(pid);

  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);
  const myMembership = (members ?? []).find((member) => member.user_id === user?.id);
  const isAdmin = myMembership?.role === ROLE.ADMIN.value;
  const canManage = isAdmin && !archived;
  const admins = adminCount(members);

  /** The last admin must not be able to strand the project without one. */
  function lastAdminBlock(member) {
    if (member.role !== ROLE.ADMIN.value) return null;
    if (member.user_id !== user?.id) return null;
    if (admins > 1) return null;
    return "You're the only admin. Promote someone else before changing your own role or leaving.";
  }

  async function run(action, arg, memberId) {
    setActionError(null);
    setPendingId(memberId);
    try {
      await action.mutateAsync(arg);
      setConfirmRemove(null);
    } catch (err) {
      setActionError(err);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Members`}
        title="Members"
        description="Who can see this project, and what each of them is allowed to do."
        actions={
          canManage ? (
            <Button variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>
              Add member
            </Button>
          ) : null
        }
      />

      {archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. Membership is read-only.
        </p>
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

      <div className={styles.body}>
        {isError ? (
          <ErrorState title="Couldn't load members" error={error} onRetry={() => refetch()} />
        ) : (
          <div className={styles.panel}>
            {!isPending && members?.length > 0 && (
              <div className={styles.head}>
                <span />
                <span>Member</span>
                <span>Role</span>
                <span className={styles.joined}>Joined</span>
                <span />
              </div>
            )}

            {isPending && <SkeletonRows />}

            {!isPending && members?.length === 0 && (
              <EmptyState
                icon={Users}
                title="No members"
                description="This project has no members yet."
                action={
                  canManage ? (
                    <Button variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>
                      Add member
                    </Button>
                  ) : null
                }
              />
            )}

            {!isPending &&
              members?.map((member) => {
                const isMe = member.user_id === user?.id;
                const block = lastAdminBlock(member);
                const roleMeta = ROLE[member.role] ?? { label: member.role };

                return (
                  <div
                    key={member.user_id}
                    className={cn(styles.row, pendingId === member.user_id && styles.rowPending)}
                  >
                    <span className={styles.avatarCell}>
                      <Avatar name={member.name} size="md" />
                    </span>

                    <span className={styles.identity}>
                      <span className={styles.name}>
                        {member.name}
                        {isMe && <span className={styles.you}>You</span>}
                      </span>
                      <span className={styles.email}>{member.email}</span>
                    </span>

                    <span className={styles.roleCell}>
                      {canManage && !block ? (
                        <Menu>
                          <MenuTrigger
                            className={styles.rolePicker}
                            aria-label={`Change ${member.name}'s role`}
                          >
                            {roleMeta.label}
                            <ChevronDown size={12} aria-hidden="true" />
                          </MenuTrigger>
                          <MenuContent align="start">
                            <MenuLabel>Project role</MenuLabel>
                            <MenuRadioGroup
                              value={member.role}
                              onValueChange={(role) => {
                                if (role !== member.role) {
                                  run(updateRole, { userId: member.user_id, role }, member.user_id);
                                }
                              }}
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <MenuRadioItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuRadioItem>
                              ))}
                            </MenuRadioGroup>
                          </MenuContent>
                        </Menu>
                      ) : block ? (
                        <Tooltip content={block}>
                          <span>
                            <Badge variant="accent">{roleMeta.label}</Badge>
                          </span>
                        </Tooltip>
                      ) : (
                        <Badge
                          variant={member.role === ROLE.ADMIN.value ? "accent" : "outline"}
                        >
                          {roleMeta.label}
                        </Badge>
                      )}
                    </span>

                    <span className={styles.joined} title={formatDate(member.joined_at)}>
                      {formatRelative(member.joined_at)}
                    </span>

                    <span className={styles.actionSlot}>
                      {canManage &&
                        (block ? (
                          <Tooltip content={block}>
                            <span>
                              <button
                                type="button"
                                className={styles.removeButton}
                                aria-label={`Remove ${member.name} — unavailable`}
                                disabled
                              >
                                <UserMinus size={15} />
                              </button>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip content={isMe ? "Leave project" : "Remove from project"}>
                            <button
                              type="button"
                              className={styles.removeButton}
                              aria-label={
                                isMe ? "Leave this project" : `Remove ${member.name} from the project`
                              }
                              onClick={() => setConfirmRemove(member)}
                            >
                              <UserMinus size={15} />
                            </button>
                          </Tooltip>
                        ))}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <AddMemberDialog pid={pid} open={addOpen} onOpenChange={setAddOpen} />

      <Dialog
        open={Boolean(confirmRemove)}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <DialogContent
          eyebrow="Project"
          title={
            confirmRemove?.user_id === user?.id ? "Leave this project?" : "Remove member?"
          }
          description="They keep their DevTrack account — this only removes their access to this project."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={removeMember.isPending}
                onClick={() =>
                  run(removeMember, confirmRemove.user_id, confirmRemove.user_id)
                }
              >
                {confirmRemove?.user_id === user?.id ? "Leave project" : "Remove member"}
              </Button>
            </>
          }
        >
          <p className={styles.confirmText}>
            <span className={styles.confirmName}>{confirmRemove?.name}</span> will lose
            access to this project&rsquo;s issues, board and sprints. Issues they reported
            or were assigned stay exactly as they are.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
