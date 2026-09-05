"""project notes

Adds the notes table. Nothing existing changes, so there is no data migration
and every current row stays valid.

Revision ID: a7f2d9c14b83
Revises: c48a2b7e51d6
Create Date: 2026-09-05 12:18:33.740221

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7f2d9c14b83'
down_revision: Union[str, None] = 'c48a2b7e51d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('author_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('note_type', sa.Enum('GENERAL', 'MEETING', 'SPRINT', 'TECHNICAL', 'RETROSPECTIVE', name='notetype'), nullable=False),
    sa.Column('issue_id', sa.Integer(), nullable=True),
    sa.Column('sprint_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['issue_id'], ['issues.id'], ),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.ForeignKeyConstraint(['sprint_id'], ['sprints.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notes_note_type'), ['note_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_notes_project_id'), ['project_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_notes_project_id'))
        batch_op.drop_index(batch_op.f('ix_notes_note_type'))

    op.drop_table('notes')
