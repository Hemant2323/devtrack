"""project calendar

Adds the calendar_events table — the only rows the calendar owns — and
test_cases.deadline, the date the calendar needs in order to place a test case
and to write one back.

Issues, sprints and meetings already carry their own dates and gain nothing
here: the calendar reads them at request time rather than copying them, so
there is deliberately no aggregated calendar table.

The new column is nullable, so every existing test case stays valid with no
data migration.

Revision ID: b6d21f84c703
Revises: f3b81e57a2c9
Create Date: 2026-09-05 15:07:44.183025

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6d21f84c703'
down_revision: Union[str, None] = 'f3b81e57a2c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('calendar_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('creator_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('starts_at', sa.DateTime(), nullable=False),
    sa.Column('ends_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('calendar_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_calendar_events_project_id'), ['project_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_calendar_events_starts_at'), ['starts_at'], unique=False)

    with op.batch_alter_table('test_cases', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deadline', sa.Date(), nullable=True))
        batch_op.create_index(batch_op.f('ix_test_cases_deadline'), ['deadline'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('test_cases', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_test_cases_deadline'))
        batch_op.drop_column('deadline')

    with op.batch_alter_table('calendar_events', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_calendar_events_starts_at'))
        batch_op.drop_index(batch_op.f('ix_calendar_events_project_id'))

    op.drop_table('calendar_events')
