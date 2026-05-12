"""add trip analytics indexes

Revision ID: 20260512_0002
Revises: 20260510_0001
Create Date: 2026-05-12 00:30:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260512_0002"
down_revision: Union[str, None] = "20260510_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_trips_status", "trips", ["status"], unique=False)
    op.create_index("ix_trips_start_time", "trips", ["start_time"], unique=False)
    op.create_index("ix_trips_road_surface", "trips", ["road_surface"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_trips_road_surface", table_name="trips")
    op.drop_index("ix_trips_start_time", table_name="trips")
    op.drop_index("ix_trips_status", table_name="trips")
