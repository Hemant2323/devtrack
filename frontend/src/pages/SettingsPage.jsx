import { useEffect, useState } from "react";
import { AlertCircle, Archive, ArchiveRestore, Check, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { ApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/primitives/Badge";
import { Button } from "../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../components/primitives/Dialog";
import { ErrorState } from "../components/primitives/ErrorState";
import { Input, Textarea } from "../components/primitives/Input";
import { Skeleton } from "../components/primitives/Skeleton";
import {
  useArchiveProject,
  useUpdateProject,
} from "../features/projects/useProjectSettings";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { ROLE } from "../lib/enums";
import { formatDate, formatRelative } from "../lib/format";
import styles from "./SettingsPage.module.css";

function LoadingLayout() {
  return (
    <div className={styles.body}>
      <div className={styles.skelPanel}>
        <Skeleton width="25%" height={13} />
        <Skeleton width="100%" height={32} />
        <Skeleton width="100%" height={64} />
      </div>
      <div className={styles.skelPanel}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} width="100%" height={14} />
        ))}
      </div>
    </div>
  );
}

/**
 * Project settings.
 *
 * This page is the deliberate exception to the app's archived rule. Every
 * other page goes read-only when a project is archived, because the backend
 * rejects their writes with 403. `update_project` has no archived guard — that
 * is precisely what makes restoring possible — so an admin can still rename,
 * re-describe and un-archive from here.
 *
 * `key` is not part of ProjectUpdate and is shown read-only: it prefixes every
 * issue key ever minted, so changing it would orphan every existing reference.
 */
export function SettingsPage() {
  const pid = useProjectId();
  const { user } = useAuth();
  const { members } = useProjectDirectory(pid);
  const updateProject = useUpdateProject(pid);
  const archiveProject = useArchiveProject(pid);

  const {
    data: project,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Seed the form from the server once it arrives, and re-seed whenever the
  // record changes underneath (another tab, or our own successful save).
  useEffect(() => {
    if (!project) return;
    setName(project.name ?? "");
    setDescription(project.description ?? "");
  }, [project]);

  const isAdmin =
    members.find((member) => member.user_id === user?.id)?.role === ROLE.ADMIN.value;
  const archived = Boolean(project?.archived);

  const dirty =
    Boolean(project) &&
    (name.trim() !== project.name || description.trim() !== (project.description ?? ""));

  async function handleSave(event) {
    event.preventDefault();
    setSaveError(null);
    setSaved(false);
    try {
      await updateProject.mutateAsync({
        name: name.trim(),
        // An empty string clears the description. Never null: the service uses
        // exclude_none, so a null would simply be dropped from the payload.
        description: description.trim(),
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new ApiError(0, "Could not save changes"));
    }
  }

  async function handleArchiveToggle(next) {
    setSaveError(null);
    try {
      await archiveProject.mutateAsync(next);
      setConfirmArchive(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new ApiError(0, "Could not change the status"));
    }
  }

  if (isPending) {
    return (
      <>
        <PageHeader eyebrow="Project / Settings" title="Settings" />
        <LoadingLayout />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader eyebrow="Project / Settings" title="Settings" />
        <div className={styles.body}>
          <ErrorState title="Couldn't load this project" error={error} onRetry={() => refetch()} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`${project.key} / Settings`}
        title="Settings"
        description="Rename the project, edit its description, or archive it."
      />

      {archived && (
        <p className={styles.archivedBanner}>
          <Archive size={15} aria-hidden="true" />
          This project is archived and read-only everywhere else. It can still be
          edited and restored from this page.
        </p>
      )}

      {saveError && (
        <p className={styles.errorBar} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{saveError.message}</span>
          <button
            type="button"
            className={styles.errorDismiss}
            onClick={() => setSaveError(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      <div className={styles.body}>
        {/* ---------------------------------------------- project details */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Project details</h2>
          </div>

          <form onSubmit={handleSave}>
            <div className={styles.panelBody}>
              <div className={styles.form}>
                <Input
                  label="Name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setSaved(false);
                  }}
                  maxLength={100}
                  error={saveError?.fieldError("name")}
                  disabled={!isAdmin}
                  required
                />

                <Textarea
                  label="Description"
                  optional
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setSaved(false);
                  }}
                  placeholder="What does this project cover?"
                  rows={3}
                  error={saveError?.fieldError("description")}
                  disabled={!isAdmin}
                  hint="Leave empty to clear the description."
                />

                {!isAdmin && (
                  <p className={styles.readOnlyNote}>
                    <Lock size={13} aria-hidden="true" />
                    Only project admins can change these settings. You can see them
                    here, but the fields are read-only for your role.
                  </p>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className={styles.formActions}>
                <span className={styles.formHint}>
                  {saved && !dirty ? (
                    <span className={styles.saved}>
                      <Check size={13} aria-hidden="true" />
                      Saved
                    </span>
                  ) : (
                    "The project key can't be changed."
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!dirty || updateProject.isPending}
                  onClick={() => {
                    setName(project.name ?? "");
                    setDescription(project.description ?? "");
                    setSaveError(null);
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={updateProject.isPending}
                  disabled={!dirty || !name.trim()}
                >
                  Save changes
                </Button>
              </div>
            )}
          </form>
        </section>

        {/* --------------------------------------------------- read-only */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Project information</h2>
          </div>
          <div className={styles.facts}>
            <div className={styles.factRow}>
              <span className={styles.factLabel}>Key</span>
              <span className={styles.factValue}>
                <span className={cn(styles.keyTile, archived && styles.keyTileArchived)}>
                  {project.key}
                </span>
                <span className={styles.factNote}>Permanent</span>
              </span>
            </div>
            <div className={styles.factRow}>
              <span className={styles.factLabel}>Status</span>
              <span className={styles.factValue}>
                <Badge variant={archived ? "neutral" : "success"} dot>
                  {archived ? "Archived" : "Active"}
                </Badge>
              </span>
            </div>
            <div className={styles.factRow}>
              <span className={styles.factLabel}>Created</span>
              <span className={styles.factValue} title={formatDate(project.created_at)}>
                {formatRelative(project.created_at)}
              </span>
            </div>
            <div className={styles.factRow}>
              <span className={styles.factLabel} title="Never decreases — deleted issues are included.">
                Issues created
              </span>
              <span className={cn(styles.factValue, styles.factMono)}>
                {project.issue_counter}
              </span>
            </div>
            <div className={styles.factRow}>
              <span className={styles.factLabel}>Next issue key</span>
              <span className={cn(styles.factValue, styles.factMono)}>
                {project.key}-{project.issue_counter + 1}
              </span>
            </div>
            <div className={styles.factRow}>
              <span className={styles.factLabel}>Members</span>
              <span className={cn(styles.factValue, styles.factMono)}>{members.length}</span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ archive / restore */}
        {isAdmin && (
          <section className={cn(styles.panel, !archived && styles.panelDanger)}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                {archived ? "Restore project" : "Archive project"}
              </h2>
            </div>
            <div className={styles.panelBody}>
              <p className={styles.archiveText}>
                {archived
                  ? "Restoring makes this project writable again everywhere — issues, board, sprints, comments and members."
                  : "Archiving makes the project read-only everywhere else in DevTrack: no new issues, comments, sprints or members, and no edits to existing ones. Nothing is deleted, and you can restore it from this page at any time."}
              </p>
              <div className={styles.archiveActions}>
                {archived ? (
                  <Button
                    variant="secondary"
                    icon={ArchiveRestore}
                    loading={archiveProject.isPending}
                    onClick={() => handleArchiveToggle(false)}
                  >
                    Restore project
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    icon={Archive}
                    onClick={() => setConfirmArchive(true)}
                  >
                    Archive project
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent
          eyebrow="Project"
          title="Archive this project?"
          description="Nothing is deleted. You can restore it from Settings at any time."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={archiveProject.isPending}
                onClick={() => handleArchiveToggle(true)}
              >
                Archive project
              </Button>
            </>
          }
        >
          <p className={styles.confirmText}>
            <span className={styles.confirmName}>{project.name}</span> becomes read-only
            everywhere else: nobody can create or edit issues, move cards, comment,
            run sprints or change members until it is restored.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
