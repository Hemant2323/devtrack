import { useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/primitives/Button";
import { Dialog, DialogClose, DialogContent } from "../../components/primitives/Dialog";
import { Input } from "../../components/primitives/Input";
import { Select } from "../../components/primitives/Select";
import { ROLE } from "../../lib/enums";
import { useAddMember } from "./useMembers";
import styles from "../../pages/MembersPage.module.css";

const ROLE_OPTIONS = Object.values(ROLE).map((role) => ({
  value: role.value,
  label: role.label,
}));

/**
 * Add an existing DevTrack user to the project.
 *
 * Mirrors MemberAdd exactly: an email and a role, defaulting to Developer as
 * the schema does. There is no invitation flow on the backend — the person
 * must already have an account — so the dialog says that outright rather than
 * implying an email is sent.
 *
 * The two expected failures are surfaced on the email field, because that is
 * the input they are about:
 *   404 "No user with that email"
 *   409 "User is already a member"
 */
export function AddMemberDialog({ pid, open, onOpenChange }) {
  const addMember = useAddMember(pid);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ROLE.DEVELOPER.value);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole(ROLE.DEVELOPER.value);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    try {
      await addMember.mutateAsync({ email: email.trim(), role });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Could not add the member"));
    }
  }

  /* 404 and 409 both carry a string detail, so they arrive as form-level
     messages rather than field errors. Both are about the email, so they are
     shown against that input; anything else falls through to the banner. */
  const emailProblem =
    error && (error.isNotFound || error.status === 409) ? error.message : null;
  const fieldError = error?.fieldError("email") ?? emailProblem;
  const bannerError = error && !error.isValidation && !emailProblem ? error.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Project"
        title="Add member"
        description="Give an existing DevTrack user access to this project."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              form="add-member-form"
              variant="primary"
              loading={addMember.isPending}
              disabled={!email.trim()}
            >
              Add member
            </Button>
          </>
        }
      >
        <form id="add-member-form" className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@team.dev"
            error={fieldError}
            autoFocus
            required
          />

          <Select
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            options={ROLE_OPTIONS}
            error={error?.fieldError("role")}
            hint="Admins can manage members, components and project settings."
          />

          <p className={styles.note}>
            <Info size={14} aria-hidden="true" />
            This adds someone who already has a DevTrack account — it does not send
            an invitation. If they haven&rsquo;t signed up yet, ask them to create an
            account first.
          </p>

          {bannerError && (
            <p className={styles.formError} role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              {bannerError}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
