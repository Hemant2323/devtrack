"""Issue dependency queries.

Every read here joins to the blocking or blocked Issue and excludes
soft-deleted ones, so a deleted issue silently drops out of the other issue's
dependency lists rather than rendering as a dangling row. The dependency rows
themselves are left alone — the issue is only soft-deleted, and restoring it
would restore its links.
"""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, aliased

from app.models.dependency import IssueDependency
from app.models.issue import Issue


def get_by_id(db: Session, dependency_id: int) -> IssueDependency | None:
    return db.get(IssueDependency, dependency_id)


def get_pair(
    db: Session, blocking_issue_id: int, blocked_issue_id: int
) -> IssueDependency | None:
    """The existing edge for this ordered pair, if any — the duplicate check."""
    return db.scalar(
        select(IssueDependency).where(
            IssueDependency.blocking_issue_id == blocking_issue_id,
            IssueDependency.blocked_issue_id == blocked_issue_id,
        )
    )


def list_blocked_by(db: Session, issue_id: int) -> list[tuple[IssueDependency, Issue]]:
    """Edges pointing *at* this issue, with the issue doing the blocking."""
    stmt = (
        select(IssueDependency, Issue)
        .join(Issue, Issue.id == IssueDependency.blocking_issue_id)
        .where(
            IssueDependency.blocked_issue_id == issue_id,
            Issue.deleted_at.is_(None),
        )
        .order_by(IssueDependency.id)
    )
    return [tuple(row) for row in db.execute(stmt)]


def list_blocks(db: Session, issue_id: int) -> list[tuple[IssueDependency, Issue]]:
    """Edges pointing *away* from this issue, with the issue being blocked."""
    stmt = (
        select(IssueDependency, Issue)
        .join(Issue, Issue.id == IssueDependency.blocked_issue_id)
        .where(
            IssueDependency.blocking_issue_id == issue_id,
            Issue.deleted_at.is_(None),
        )
        .order_by(IssueDependency.id)
    )
    return [tuple(row) for row in db.execute(stmt)]


def list_for_project(db: Session, project_id: int) -> list[tuple[IssueDependency, Issue]]:
    """Every edge whose two issues are both live members of this project,
    paired with the blocking issue (whose status decides "still blocked").

    One query for the whole board — the alternative would be a request per
    card. Both ends are joined so an edge that reaches a deleted issue, or an
    issue in another project, cannot appear.
    """
    blocking = aliased(Issue)
    blocked = aliased(Issue)
    stmt = (
        select(IssueDependency, blocking)
        .join(blocking, blocking.id == IssueDependency.blocking_issue_id)
        .join(blocked, blocked.id == IssueDependency.blocked_issue_id)
        .where(
            blocking.project_id == project_id,
            blocked.project_id == project_id,
            blocking.deleted_at.is_(None),
            blocked.deleted_at.is_(None),
        )
        .order_by(IssueDependency.id)
    )
    return [tuple(row) for row in db.execute(stmt)]


def list_edges_for_project(db: Session, project_id: int) -> list[tuple[int, int]]:
    """(blocking_id, blocked_id) pairs for the project — the adjacency the
    cycle check walks. Deleted issues are excluded, so a link through a
    deleted issue does not keep a chain alive."""
    blocking = aliased(Issue)
    blocked = aliased(Issue)
    stmt = (
        select(IssueDependency.blocking_issue_id, IssueDependency.blocked_issue_id)
        .join(blocking, blocking.id == IssueDependency.blocking_issue_id)
        .join(blocked, blocked.id == IssueDependency.blocked_issue_id)
        .where(
            blocking.project_id == project_id,
            blocked.project_id == project_id,
            blocking.deleted_at.is_(None),
            blocked.deleted_at.is_(None),
        )
    )
    return [(row[0], row[1]) for row in db.execute(stmt)]


def list_any_for_issue(db: Session, issue_id: int) -> list[IssueDependency]:
    """Every edge touching this issue, either end."""
    return list(
        db.scalars(
            select(IssueDependency).where(
                or_(
                    IssueDependency.blocking_issue_id == issue_id,
                    IssueDependency.blocked_issue_id == issue_id,
                )
            )
        )
    )


def create(db: Session, blocking_issue_id: int, blocked_issue_id: int) -> IssueDependency:
    dependency = IssueDependency(
        blocking_issue_id=blocking_issue_id, blocked_issue_id=blocked_issue_id
    )
    db.add(dependency)
    db.flush()
    return dependency


def delete(db: Session, dependency: IssueDependency) -> None:
    db.delete(dependency)
    db.flush()
