import { useState } from "react";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/endpoints";
import { keys } from "../api/queryKeys";
import { ApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/primitives/Avatar";
import { Button } from "../components/primitives/Button";
import { ErrorState } from "../components/primitives/ErrorState";
import { Input, Textarea } from "../components/primitives/Input";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../components/primitives/Menu";
import { Skeleton } from "../components/primitives/Skeleton";
import {
  IssueKey,
  PriorityBars,
  SeverityChip,
  StatusChip,
  TypeIcon,
} from "../components/domain/IssueAtoms";
import { ActivityFeed } from "../features/issues/ActivityFeed";
import { CommentThread } from "../features/issues/CommentThread";
import { DependencyPanel } from "../features/issues/DependencyPanel";
import { useDeleteIssue, useIssue, useUpdateIssue } from "../features/issues/useIssues";
import { useProjectDirectory } from "../features/projects/useProjectDirectory";
import { assignableSprints, useSprints } from "../features/sprints/useSprints";
import { useProjectId } from "../hooks/useProjectId";
import { cn } from "../lib/cn";
import { ISSUE_TYPE, PRIORITY, ROLE, SEVERITY, STATUS } from "../lib/enums";
import { formatDate, formatRelative } from "../lib/format";
import styles from "./IssueDetailPage.module.css";

/** A menu-based inline picker — no modal for a single-value change. */
function Picker({ label, value, display, options, onChange, empty = "None", disabled }) {
  if (disabled) {
    return <span className={styles.readOnly}>{display ?? empty}</span>;
  }
  return (
    <Menu>
      <MenuTrigger className={styles.picker} aria-label={`Change ${label}`}>
        <span className={cn(styles.pickerText, !display && styles.pickerEmpty)}>
          {display ?? empty}
        </span>
        <ChevronDown size={12} className={styles.pickerChevron} aria-hidden="true" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>{label}</MenuLabel>
        <MenuRadioGroup value={value ?? ""} onValueChange={onChange}>
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function LoadingLayout() {
  return (
    <div className={styles.body}>
      <div className={styles.col}>
        <div className={styles.skelPanel}>
          <Skeleton width="25%" height={13} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="85%" height={12} />
        </div>
        <div className={styles.skelPanel}>
          <Skeleton width="25%" height={13} />
          <Skeleton width="100%" height={40} />
        </div>
      </div>
      <div className={styles.col}>
        <div className={styles.skelPanel}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} width="100%" height={14} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Issue detail.
 *
 * Every editable control maps to a field IssueUpdate actually accepts:
 * title, description, status, priority, severity, steps_to_reproduce,
 * assignee_id, component_id, deadline and sprint_id — the sprint picker moves
 * an issue between the backlog and a sprint (FR-5.2).
 *
 * Permissions follow the backend: any project member may edit an issue;
 * only an ADMIN may delete one; an archived project rejects all writes with
 * 403, so writes are disabled rather than offered and refused.
 */
export function IssueDetailPage() {
  const pid = useProjectId();
  const { iid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: issue, isPending, isError, error, refetch } = useIssue(iid);
  const { members, components, memberById, componentById } = useProjectDirectory(pid);
  const { data: sprints } = useSprints(pid);
  const updateIssue = useUpdateIssue(pid, iid);
  const deleteIssue = useDeleteIssue(pid, iid);

  const { data: project } = useQuery({
    queryKey: keys.project(pid),
    queryFn: ({ signal }) => projectsApi.get(pid, { signal }),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });

  const [editing, setEditing] = useState(null); // "title" | "description" | "steps"
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState(null);

  const archived = Boolean(project?.archived);
  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canDelete = myRole === ROLE.ADMIN.value && !archived;
  const canEdit = !archived;

  async function save(patch) {
    setSaveError(null);
    try {
      await updateIssue.mutateAsync(patch);
      setEditing(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new ApiError(0, "Could not save the change"));
    }
  }

  if (isPending) {
    return (
      <>
        <div className={styles.header}>
          <Skeleton width={180} height={11} />
          <div style={{ height: 12 }} />
          <Skeleton width="45%" height={26} />
        </div>
        <LoadingLayout />
      </>
    );
  }

  if (isError) {
    return (
      <div className={styles.body}>
        <ErrorState
          title={error?.isNotFound ? "Issue not found" : "Couldn't load this issue"}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const assignee = issue.assignee_id ? memberById.get(issue.assignee_id) : null;
  const reporter = memberById.get(issue.reporter_id);
  const component = issue.component_id ? componentById.get(issue.component_id) : null;
  const isBug = issue.type === ISSUE_TYPE.BUG.value;

  return (
    <>
      <div className={styles.header}>
        <nav className={styles.crumb}>
          <Link to={`/projects/${pid}`} className={styles.crumbLink}>
            {project?.key ?? "Project"}
          </Link>
          <ChevronRight size={11} aria-hidden="true" />
          <Link to={`/projects/${pid}/issues`} className={styles.crumbLink}>
            Issues
          </Link>
          <ChevronRight size={11} aria-hidden="true" />
          <span>{issue.key}</span>
        </nav>

        <div className={styles.titleRow}>
          <div className={styles.identity}>
            <div className={styles.keyLine}>
              <TypeIcon type={issue.type} />
              <IssueKey>{issue.key}</IssueKey>
            </div>

            {editing === "title" ? (
              <div className={styles.editForm}>
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={200}
                  aria-label="Issue title"
                  error={saveError?.fieldError("title")}
                  autoFocus
                />
                <div className={styles.editActions}>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={updateIssue.isPending}
                    disabled={!draft.trim()}
                    onClick={() => save({ title: draft.trim() })}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : canEdit ? (
              <button
                type="button"
                className={cn(styles.title, styles.titleButton)}
                onClick={() => {
                  setDraft(issue.title);
                  setEditing("title");
                }}
                aria-label="Edit title"
              >
                {issue.title}
              </button>
            ) : (
              <h1 className={styles.title}>{issue.title}</h1>
            )}
          </div>

          {canDelete && (
            <div className={styles.headerActions}>
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="secondary" size="sm" iconOnly icon={MoreHorizontal} aria-label="Issue actions" />
                </MenuTrigger>
                <MenuContent>
                  <MenuLabel>Admin</MenuLabel>
                  <MenuSeparator />
                  <MenuItem
                    icon={Trash2}
                    danger
                    onSelect={async () => {
                      await deleteIssue.mutateAsync();
                      navigate(`/projects/${pid}/issues`);
                    }}
                  >
                    Delete issue
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          )}
        </div>

        <div className={styles.chipRow}>
          <StatusChip status={issue.status} />
          <PriorityBars priority={issue.priority} />
          {issue.severity && <SeverityChip severity={issue.severity} />}
        </div>
      </div>

      {archived && (
        <p className={styles.archivedNote}>
          <Archive size={15} aria-hidden="true" />
          This project is archived. This issue is read-only.
        </p>
      )}

      {saveError && !saveError.isValidation && (
        <p className={styles.saveError} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          {saveError.message}
        </p>
      )}

      <div className={styles.body}>
        <div className={styles.col}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Description</h2>
            </div>
            <div className={styles.panelBody}>
              {editing === "description" ? (
                <div className={styles.editForm}>
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={6}
                    aria-label="Issue description"
                    error={saveError?.fieldError("description")}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={updateIssue.isPending}
                      onClick={() => save({ description: draft })}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : canEdit ? (
                <button
                  type="button"
                  className={styles.editable}
                  onClick={() => {
                    setDraft(issue.description ?? "");
                    setEditing("description");
                  }}
                  aria-label="Edit description"
                >
                  <span className={cn(styles.prose, !issue.description && styles.prosePlaceholder)}>
                    {issue.description || "No description. Click to add one."}
                  </span>
                </button>
              ) : (
                <p className={cn(styles.prose, !issue.description && styles.prosePlaceholder)}>
                  {issue.description || "No description."}
                </p>
              )}
            </div>
          </section>

          {isBug && (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>Steps to reproduce</h2>
              </div>
              <div className={styles.panelBody}>
                {editing === "steps" ? (
                  <div className={styles.editForm}>
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={5}
                      aria-label="Steps to reproduce"
                      autoFocus
                    />
                    <div className={styles.editActions}>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={updateIssue.isPending}
                        onClick={() => save({ steps_to_reproduce: draft })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : canEdit ? (
                  <button
                    type="button"
                    className={styles.editable}
                    onClick={() => {
                      setDraft(issue.steps_to_reproduce ?? "");
                      setEditing("steps");
                    }}
                    aria-label="Edit steps to reproduce"
                  >
                    <span
                      className={cn(
                        styles.prose,
                        !issue.steps_to_reproduce && styles.prosePlaceholder,
                      )}
                    >
                      {issue.steps_to_reproduce || "No steps recorded. Click to add them."}
                    </span>
                  </button>
                ) : (
                  <p className={cn(styles.prose, !issue.steps_to_reproduce && styles.prosePlaceholder)}>
                    {issue.steps_to_reproduce || "No steps recorded."}
                  </p>
                )}
              </div>
            </section>
          )}

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Dependencies</h2>
              <span className={styles.panelMeta}>Informational</span>
            </div>
            <DependencyPanel pid={pid} iid={iid} archived={archived} />
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Comments</h2>
            </div>
            <CommentThread iid={iid} myRole={myRole} archived={archived} />
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Activity</h2>
              <span className={styles.panelMeta}>Append-only</span>
            </div>
            <ActivityFeed iid={iid} memberById={memberById} componentById={componentById} />
          </section>
        </div>

        {/* ------------------------------------------------------- sidebar */}
        <div className={styles.col}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Details</h2>
            </div>
            <div className={styles.fieldList}>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Status</span>
                <span className={styles.fieldValue}>
                  <Picker
                    label="Status"
                    value={issue.status}
                    display={STATUS[issue.status]?.label}
                    options={Object.values(STATUS).map((s) => ({ value: s.value, label: s.label }))}
                    onChange={(value) => save({ status: value })}
                    disabled={!canEdit}
                  />
                </span>
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Priority</span>
                <span className={styles.fieldValue}>
                  <PriorityBars priority={issue.priority} />
                  <Picker
                    label="Priority"
                    value={issue.priority}
                    display={PRIORITY[issue.priority]?.label}
                    options={Object.values(PRIORITY).map((p) => ({ value: p.value, label: p.label }))}
                    onChange={(value) => save({ priority: value })}
                    disabled={!canEdit}
                  />
                </span>
              </div>

              {isBug && (
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Severity</span>
                  <span className={styles.fieldValue}>
                    <Picker
                      label="Severity"
                      value={issue.severity}
                      display={issue.severity ? SEVERITY[issue.severity]?.label : null}
                      options={Object.values(SEVERITY).map((s) => ({ value: s.value, label: s.label }))}
                      onChange={(value) => save({ severity: value })}
                      disabled={!canEdit}
                    />
                  </span>
                </div>
              )}

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Assignee</span>
                <span className={styles.fieldValue}>
                  {assignee && <Avatar name={assignee.name} size="xs" />}
                  <Picker
                    label="Assignee"
                    value={issue.assignee_id ? String(issue.assignee_id) : ""}
                    display={assignee?.name}
                    empty="Unassigned"
                    options={[
                      { value: "", label: "Unassigned" },
                      ...members.map((m) => ({ value: String(m.user_id), label: m.name })),
                    ]}
                    onChange={(value) => save({ assignee_id: value ? Number(value) : null })}
                    disabled={!canEdit}
                  />
                </span>
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Component</span>
                <span className={styles.fieldValue}>
                  <Picker
                    label="Component"
                    value={issue.component_id ? String(issue.component_id) : ""}
                    display={component?.name}
                    empty={components.length ? "None" : "No components"}
                    options={[
                      { value: "", label: "None" },
                      ...components.map((c) => ({ value: String(c.id), label: c.name })),
                    ]}
                    onChange={(value) => save({ component_id: value ? Number(value) : null })}
                    disabled={!canEdit || components.length === 0}
                  />
                </span>
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Sprint</span>
                <span className={styles.fieldValue}>
                  <Picker
                    label="Sprint"
                    value={issue.sprint_id ? String(issue.sprint_id) : ""}
                    display={
                      (sprints ?? []).find((s) => s.id === issue.sprint_id)?.name
                    }
                    empty="Backlog"
                    /* Completed sprints are omitted: the backend rejects a move
                       into one with 409. The issue's own sprint is kept in the
                       list even if completed, so the current value still reads
                       correctly. */
                    options={[
                      { value: "", label: "Backlog (no sprint)" },
                      ...assignableSprints(sprints).map((s) => ({
                        value: String(s.id),
                        label: s.name,
                      })),
                    ]}
                    onChange={(value) => save({ sprint_id: value ? Number(value) : null })}
                    disabled={!canEdit}
                  />
                </span>
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Reporter</span>
                <span className={styles.fieldValue}>
                  {reporter && <Avatar name={reporter.name} size="xs" />}
                  <span className={styles.readOnly}>{reporter?.name ?? "Unknown"}</span>
                </span>
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Due date</span>
                <span className={styles.fieldValue}>
                  <span className={cn(styles.readOnly, styles.mono)}>
                    {issue.deadline ? formatDate(issue.deadline) : "—"}
                  </span>
                </span>
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Created</span>
                <span className={styles.fieldValue}>
                  <span className={styles.readOnly} title={formatDate(issue.created_at)}>
                    {formatRelative(issue.created_at)}
                  </span>
                </span>
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Updated</span>
                <span className={styles.fieldValue}>
                  <span className={styles.readOnly} title={formatDate(issue.updated_at)}>
                    {formatRelative(issue.updated_at)}
                  </span>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
