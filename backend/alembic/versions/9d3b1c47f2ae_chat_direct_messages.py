"""chat direct messages

Adds ChatMessage.recipient_id. NULL means the message belongs to the project's
team chat, which is what every pre-existing row already is — so no data
migration is required and existing chat history stays valid untouched.

Revision ID: 9d3b1c47f2ae
Revises: 4386f61b9ea0
Create Date: 2026-09-04 09:14:22.108934

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d3b1c47f2ae'
down_revision: Union[str, None] = '4386f61b9ea0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # batch mode because SQLite cannot add a foreign key to an existing table
    # in place; it recreates chat_messages with the new column and constraint.
    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('recipient_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_chat_messages_recipient_id_users', 'users', ['recipient_id'], ['id']
        )
        batch_op.create_index(
            'ix_chat_messages_project_recipient',
            ['project_id', 'recipient_id'],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.drop_index('ix_chat_messages_project_recipient')
        batch_op.drop_constraint('fk_chat_messages_recipient_id_users', type_='foreignkey')
        batch_op.drop_column('recipient_id')
