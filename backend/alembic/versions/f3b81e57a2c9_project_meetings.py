"""project meetings

Adds the meetings and meeting_participants tables, plus notes.meeting_id —
all three in one revision because that column's foreign key needs the meetings
table to exist first.

Nothing existing changes: the new column is nullable, so every current note
stays valid with no data migration.

Revision ID: f3b81e57a2c9
Revises: a7f2d9c14b83
Create Date: 2026-09-05 13:42:11.906318

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3b81e57a2c9'
down_revision: Union[str, None] = 'a7f2d9c14b83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('meetings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('organizer_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('scheduled_at', sa.DateTime(), nullable=False),
    sa.Column('duration_minutes', sa.Integer(), nullable=True),
    sa.Column('meet_url', sa.String(length=500), nullable=True),
    sa.Column('sprint_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['organizer_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.ForeignKeyConstraint(['sprint_id'], ['sprints.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('meetings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meetings_project_id'), ['project_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meetings_scheduled_at'), ['scheduled_at'], unique=False)

    op.create_table('meeting_participants',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('meeting_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('meeting_id', 'user_id')
    )
    with op.batch_alter_table('meeting_participants', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meeting_participants_meeting_id'), ['meeting_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meeting_participants_user_id'), ['user_id'], unique=False)

    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meeting_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_notes_meeting_id'), ['meeting_id'], unique=False)
        batch_op.create_foreign_key('fk_notes_meeting_id_meetings', 'meetings', ['meeting_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.drop_constraint('fk_notes_meeting_id_meetings', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_notes_meeting_id'))
        batch_op.drop_column('meeting_id')

    with op.batch_alter_table('meeting_participants', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meeting_participants_user_id'))
        batch_op.drop_index(batch_op.f('ix_meeting_participants_meeting_id'))

    op.drop_table('meeting_participants')

    with op.batch_alter_table('meetings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meetings_scheduled_at'))
        batch_op.drop_index(batch_op.f('ix_meetings_project_id'))

    op.drop_table('meetings')
