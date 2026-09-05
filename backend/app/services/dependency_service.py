"""Issue dependency business rules (Sprint 6).

Authorization is the issue model's, unchanged: any project member may read and
write, a non-member gets 404 rather than 403 (existence hiding), and an
archived project rejects every write. There is deliberately no admin tier —
a dependency is a statement about the work, not a privileged act.

Dependencies are informational. Nothing here changes a status, blocks a
transition, moves a sprint, or touches priority; the team decides what to do
about a blocker.
"""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.issue import Issue
from app.repositories import dependency_repo, issue_repo, project_repo
from app.schemas.dependency import (
    DependencyCreate,
    DependencyDirection,
    DependencyIssueRef,
    DependencyLink,
    IssueDependenciesResponse,
    ProjectDependencyEdge,
)
from app.services.issue_service import _get_issue_or_404, _get_project_member_or_404


def _issue_ref(issue: Issue, project_key: str) -> DependencyIssueRef:
    return DependencyIssueRef(
        id=issue.id,
        key=f"{project_key}-{issue.number}",
        title=issue.title,
        type=issue.type,
        status=issue.status,
    )


def _link(dependency, other: Issue, project_key: str) -> DependencyLink:
    return DependencyLink(
        id=dependency.id,
        issue=_issue_ref(other, project_key),
        created_at=dependency.created_at,
    )


def _require_not_archived(project) -> None:
    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")


def _would_create_cycle(
    db: Session, project_id: int, blocking_id: int, blocked_id: int
) -> bool:
    """True if `blocking_id -> blocked_id` would close a loop.

    A loop exists when the issue about to be blocked can already reach, through
    existing edges, the issue about to block it. So walk forward from
    `blocked_id` along "blocks" edges and see whether `blocking_id` turns up.

    A plain reachability walk over the project's edges, loaded once, with a
    seen-set so an existing loop elsewhere cannot spin it. That is the right
    size of tool here: a project's dependency graph is small and sparse, and
    this needs no recursive CTE, no extra table, and no library.
    """
    adjacency: dict[int, list[int]] = {}
    for blocker, blocked in dependency_repo.list_edges_for_project(db, project_id):
        adjacency.setdefault(blocker, []).append(blocked)

    seen = {blocked_id}
    queue = [blocked_id]
    while queue:
        current = queue.pop()
        if current == blocking_id:
            return True
        for nxt in adjacency.get(current, ()):
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return False


# ---------- reads ----------


def list_dependencies(
    db: Session, issue_id: int, caller_id: int
) -> IssueDependenciesResponse:
    """Both directions for one issue. Read access is the issue's own."""
    issue = _get_issue_or_404(db, issue_id, caller_id)
    project = project_repo.get_by_id(db, issue.project_id)

    return IssueDependenciesResponse(
        blocked_by=[
            _link(dependency, other, project.key)
            for dependency, other in dependency_repo.list_blocked_by(db, issue_id)
        ],
        blocks=[
            _link(dependency, other, project.key)
            for dependency, other in dependency_repo.list_blocks(db, issue_id)
        ],
    )


def list_project_dependencies(
    db: Session, project_id: int, caller_id: int
) -> list[ProjectDependencyEdge]:
    """Every edge in the project, for the board's blocked indicator — one
    request for the whole board rather than one per card."""
    _get_project_member_or_404(db, project_id, caller_id)
    return [
        ProjectDependencyEdge(
            id=dependency.id,
            blocking_issue_id=dependency.blocking_issue_id,
            blocked_issue_id=dependency.blocked_issue_id,
            blocking_status=blocking.status,
        )
        for dependency, blocking in dependency_repo.list_for_project(db, project_id)
    ]


# ---------- writes ----------


def create_dependency(
    db: Session, issue_id: int, data: DependencyCreate, caller_id: int
) -> DependencyLink:
    issue = _get_issue_or_404(db, issue_id, caller_id)
    project = project_repo.get_by_id(db, issue.project_id)
    _require_not_archived(project)

    if data.issue_id == issue_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "An issue cannot block itself"
        )

    other = issue_repo.get_by_id(db, data.issue_id)
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Issue not found")
    if other.project_id != issue.project_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Both issues must belong to the same project",
        )

    if data.direction == DependencyDirection.BLOCKS:
        blocking_id, blocked_id = issue_id, other.id
    else:
        blocking_id, blocked_id = other.id, issue_id

    if dependency_repo.get_pair(db, blocking_id, blocked_id) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That dependency already exists"
        )

    if _would_create_cycle(db, issue.project_id, blocking_id, blocked_id):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "This would create a circular dependency",
        )

    try:
        dependency = dependency_repo.create(db, blocking_id, blocked_id)
        db.commit()
    except IntegrityError:
        # The unique constraint caught a duplicate that two concurrent
        # requests both saw as absent.
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That dependency already exists"
        ) from None

    db.refresh(dependency)
    return _link(dependency, other, project.key)


def delete_dependency(db: Session, dependency_id: int, caller_id: int) -> None:
    """Any member of the project may remove a dependency they can see."""
    dependency = dependency_repo.get_by_id(db, dependency_id)
    if dependency is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dependency not found")

    # Reached through one of its issues, so membership is checked exactly the
    # way it is for the issue itself — a non-member gets 404, not 403.
    blocking = issue_repo.get_by_id(db, dependency.blocking_issue_id)
    if blocking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dependency not found")
    if project_repo.get_member(db, blocking.project_id, caller_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dependency not found")

    project = project_repo.get_by_id(db, blocking.project_id)
    _require_not_archived(project)

    dependency_repo.delete(db, dependency)
    db.commit()
