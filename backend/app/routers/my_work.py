"""My Work endpoint (Sprint 6). Routers stay thin.

One read, deriving everything from data the project already holds. There is no
write counterpart and no My Work table: editing an issue or a test case happens
on that record's own page, through the API that already owns it.

The endpoint takes no user parameter of any kind. The subject is always the
authenticated caller, so there is no way to ask for someone else's work.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.my_work import MyWorkResponse
from app.services import my_work_service

router = APIRouter(tags=["my-work"])


@router.get("/projects/{project_id}/my-work", response_model=MyWorkResponse)
def get_my_work(
    project_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Work in this project assigned to the caller, plus the sprint and
    meetings around it.

    Ordered actionable-first: overdue, then blocked, then in progress, then
    other active work, then done — soonest due date within each band.
    """
    return my_work_service.get_my_work(db, project_id, me.id)
