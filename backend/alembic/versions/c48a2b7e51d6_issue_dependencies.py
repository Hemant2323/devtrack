"""issue dependencies

Adds the issue_dependencies join table. Nothing existing changes, so there is
no data migration and every current row stays valid.

Revision ID: c48a2b7e51d6
Revises: 9d3b1c47f2ae
Create Date: 2026-09-05 10:41:07.552918

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c48a2b7e51d6'
down_revision: Union[str, None] = '9d3b1c47f2ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('issue_dependencies',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('blocking_issue_id', sa.Integer(), nullable=False),
    sa.Column('blocked_issue_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['blocked_issue_id'], ['issues.id'], ),
    sa.ForeignKeyConstraint(['blocking_issue_id'], ['issues.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('blocking_issue_id', 'blocked_issue_id', name='uq_issue_dependency_pair')
    )
    with op.batch_alter_table('issue_dependencies', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_issue_dependencies_blocked_issue_id'), ['blocked_issue_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_issue_dependencies_blocking_issue_id'), ['blocking_issue_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('issue_dependencies', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_issue_dependencies_blocking_issue_id'))
        batch_op.drop_index(batch_op.f('ix_issue_dependencies_blocked_issue_id'))

    op.drop_table('issue_dependencies')
