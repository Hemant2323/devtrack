"""All database queries for test cases and runs."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.testing import TestCase, TestRun


# ---------- test cases ----------


def get_case(db: Session, case_id: int) -> TestCase | None:
    return db.get(TestCase, case_id)


def list_cases(db: Session, project_id: int, issue_id: int | None = None) -> list[TestCase]:
    """Newest first, matching the ordering convention used for issues."""
    stmt = select(TestCase).where(TestCase.project_id == project_id)
    if issue_id is not None:
        stmt = stmt.where(TestCase.issue_id == issue_id)
    return list(db.scalars(stmt.order_by(TestCase.created_at.desc())))


def create_case(db: Session, project_id: int, created_by: int, **fields) -> TestCase:
    case = TestCase(project_id=project_id, created_by=created_by, **fields)
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def update_case(db: Session, case: TestCase, **fields) -> TestCase:
    for key, value in fields.items():
        setattr(case, key, value)
    db.commit()
    db.refresh(case)
    return case


def delete_case(db: Session, case: TestCase) -> None:
    """Runs are meaningless without their case, so they go with it. Deleting
    in one transaction keeps the tables from ever disagreeing."""
    for run in list_runs(db, case.id):
        db.delete(run)
    db.delete(case)
    db.commit()


# ---------- test runs ----------


def get_run(db: Session, run_id: int) -> TestRun | None:
    return db.get(TestRun, run_id)


def list_runs(db: Session, case_id: int) -> list[TestRun]:
    """Most recent execution first."""
    return list(
        db.scalars(
            select(TestRun)
            .where(TestRun.test_case_id == case_id)
            .order_by(TestRun.executed_at.desc(), TestRun.id.desc())
        )
    )


def create_run(db: Session, case_id: int, executed_by: int, **fields) -> TestRun:
    run = TestRun(test_case_id=case_id, executed_by=executed_by, **fields)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def link_bug(db: Session, run: TestRun, issue_id: int) -> TestRun:
    run.issue_id = issue_id
    db.commit()
    db.refresh(run)
    return run
