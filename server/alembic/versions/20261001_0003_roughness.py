"""road roughness segments, hazards, trip routes and processing results

Revision ID: 20261001_0003
Revises: 20260512_0002
Create Date: 2026-10-01 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261001_0003"
down_revision: Union[str, None] = "20260512_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("devices") as batch:
        batch.add_column(sa.Column("last_seen_at", sa.DateTime(), nullable=True))

    with op.batch_alter_table("trips") as batch:
        batch.add_column(sa.Column("processing_version", sa.Integer(), server_default="0", nullable=False))
        batch.add_column(sa.Column("processed_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("roughness_avg", sa.Float(), nullable=True))
        batch.add_column(sa.Column("good_m", sa.Float(), server_default="0", nullable=False))
        batch.add_column(sa.Column("fair_m", sa.Float(), server_default="0", nullable=False))
        batch.add_column(sa.Column("poor_m", sa.Float(), server_default="0", nullable=False))
        batch.add_column(sa.Column("hazard_count", sa.Integer(), server_default="0", nullable=False))
        batch.add_column(sa.Column("tag_count", sa.Integer(), server_default="0", nullable=False))

    op.create_table(
        "road_segments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("start_ts", sa.BigInteger(), nullable=False),
        sa.Column("length_m", sa.Float(), nullable=False),
        sa.Column("distance_from_start_m", sa.Float(), nullable=False),
        sa.Column("avg_speed", sa.Float(), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("roughness", sa.Float(), nullable=False),
        sa.Column("condition", sa.String(), nullable=False),
        sa.Column("coordinates", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.trip_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_road_segments_trip_id", "road_segments", ["trip_id"])
    op.create_index("ix_road_segments_start_ts", "road_segments", ["start_ts"])

    op.create_table(
        "hazards",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("ts", sa.BigInteger(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("magnitude", sa.Float(), nullable=True),
        sa.Column("speed", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.trip_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hazards_trip_id", "hazards", ["trip_id"])
    op.create_index("ix_hazards_ts", "hazards", ["ts"])

    op.create_table(
        "trip_tracks",
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("parts", sa.JSON(), nullable=False),
        sa.Column("point_count", sa.Integer(), nullable=False),
        sa.Column("distance_m", sa.Float(), nullable=False),
        sa.Column("start_ts", sa.BigInteger(), nullable=False),
        sa.Column("end_ts", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.trip_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("trip_id"),
    )


def downgrade() -> None:
    op.drop_table("trip_tracks")
    op.drop_index("ix_hazards_ts", table_name="hazards")
    op.drop_index("ix_hazards_trip_id", table_name="hazards")
    op.drop_table("hazards")
    op.drop_index("ix_road_segments_start_ts", table_name="road_segments")
    op.drop_index("ix_road_segments_trip_id", table_name="road_segments")
    op.drop_table("road_segments")
    with op.batch_alter_table("trips") as batch:
        for column in (
            "tag_count",
            "hazard_count",
            "poor_m",
            "fair_m",
            "good_m",
            "roughness_avg",
            "processed_at",
            "processing_version",
        ):
            batch.drop_column(column)
    with op.batch_alter_table("devices") as batch:
        batch.drop_column("last_seen_at")
