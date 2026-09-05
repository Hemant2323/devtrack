import { useState } from "react";
import { Archive, Blocks, Info, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { Avatar } from "../components/primitives/Avatar";
import { Button } from "../components/primitives/Button";
import { EmptyState } from "../components/primitives/EmptyState";
import { ErrorState } from "../components/primitives/ErrorState";
import { Skeleton } from "../components/primitives/Skeleton";
import { ComponentDialog } from "../features/components/ComponentDialog";
import { useComponents } from "../features/components/useComponents";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useProjectId } from "../hooks/useProjectId";
import { ROLE } from "../lib/enums";
import styles from "./ComponentsPage.module.css";

function SkeletonRows() {
  return Array.from({ length: 4 }, (_, i) => (
    <div className={styles.skelRow} key={i}>
      <Skeleton width={26} height={26} radius="4px" />
      <Skeleton width={`${28 + ((i * 13) % 30)}%`} height={13} />
      <Skeleton width={120} height={12} />
    </div>
  ));
}

/**
 * Project components.
 *
 * Read and create only: the API has no PATCH or DELETE for components, so no
 * rename or remove control is offered. The page says so plainly rather than
 * leaving the absence unexplained.
 *
 * Creating is admin-only and blocked on an archived project, matching what the
 * backend enforces — the server stays authoritative either way.
 */
export function ComponentsPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const { data: components, isPending, isError, error, refetch } = useComponents(pid);
  const { members, memberById } = useProjectDirectory(pid);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const archived = Boolean(project?.archived);
  const isAdmin =
    members.find((member) => member.user_id === user?.id)?.role === ROLE.ADMIN.value;
  const canManage = isAdmin && !archived;

  return (
    <>
      <PageHeader
        eyebrow={`${project?.key ?? "Project"} / Components`}
        title="Components"
        description="Areas of the product that issues can be grouped by."
        actions={
          canManage ? (
            <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
              Add component
            </Button>
          ) : null
        }
      />

      {archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. Components are read-only.
        </p>
      )}

      <div className={styles.body}>
        {isError ? (
          <ErrorState title="Couldn't load components" error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className={styles.panel}>
              {!isPending && components?.length > 0 && (
                <div className={styles.head}>
                  <span />
                  <span>Component</span>
                  <span>Default assignee</span>
                </div>
              )}

              {isPending && <SkeletonRows />}

              {!isPending && components?.length === 0 && (
                <EmptyState
                  icon={Blocks}
                  title="No components yet"
                  description="Components let you group issues by area — Payments, Auth, UI — and filter the issue list by them."
                  action={
                    canManage ? (
                      <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                        Add component
                      </Button>
                    ) : null
                  }
                />
              )}

              {!isPending &&
                components?.map((component) => {
                  const owner = component.default_assignee_id
                    ? memberById.get(component.default_assignee_id)
                    : null;
                  return (
                    <div className={styles.row} key={component.id}>
                      <span className={styles.markerCell}>
                        <span className={styles.marker}>
                          <Blocks size={14} aria-hidden="true" />
                        </span>
                      </span>

                      <span className={styles.nameCell}>
                        <span className={styles.name}>{component.name}</span>
                      </span>

                      <span className={styles.assigneeCell}>
                        {owner ? (
                          <span className={styles.assignee}>
                            <Avatar name={owner.name} size="xs" />
                            <span className={styles.assigneeName}>
                              {owner.name}
                              {" "}
                              <span className={styles.assigneeEmail}>{owner.email}</span>
                            </span>
                          </span>
                        ) : (
                          <span className={styles.noAssignee}>None</span>
                        )}
                      </span>
                    </div>
                  );
                })}
            </div>

            {!isPending && components?.length > 0 && (
              <p className={styles.limitation}>
                <Info size={13} aria-hidden="true" />
                Components can&rsquo;t be renamed or removed yet — the API supports
                creating and listing them only. To correct one, add the replacement
                and move the affected issues over from the issue&rsquo;s own component
                picker.
              </p>
            )}
          </>
        )}
      </div>

      <ComponentDialog pid={pid} open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
