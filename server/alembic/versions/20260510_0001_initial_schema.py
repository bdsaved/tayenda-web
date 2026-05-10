"""initial schema

Revision ID: 20260510_0001
Revises:
Create Date: 2026-05-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260510_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )
    op.create_table(
        "devices",
        sa.Column("hashed_device_id", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("os_version", sa.String(), nullable=False),
        sa.Column("app_version", sa.String(), nullable=False),
        sa.Column("user_uuid", sa.String(), nullable=False),
        sa.Column("api_key", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("hashed_device_id"),
    )
    op.create_table(
        "trips",
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("server_trip_id", sa.String(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("device_id", sa.String(), nullable=False),
        sa.Column("device_model", sa.String(), nullable=True),
        sa.Column("operator_name", sa.String(), nullable=True),
        sa.Column("mount_type", sa.String(), nullable=True),
        sa.Column("vehicle_type", sa.String(), nullable=True),
        sa.Column("road_surface", sa.String(), nullable=True),
        sa.Column("sampling_profile", sa.String(), nullable=True),
        sa.Column("start_time", sa.BigInteger(), nullable=False),
        sa.Column("end_time", sa.BigInteger(), nullable=True),
        sa.Column("total_samples", sa.Integer(), nullable=False),
        sa.Column("total_distance", sa.Float(), nullable=False),
        sa.Column("avg_speed", sa.Float(), nullable=False),
        sa.Column("mount_quality", sa.Float(), nullable=False),
        sa.Column("quality_flags", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("total_chunks_expected", sa.Integer(), nullable=False),
        sa.Column("total_chunks_received", sa.Integer(), nullable=False),
        sa.Column("total_samples_received", sa.Integer(), nullable=False),
        sa.Column("upload_source", sa.String(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("finalized_at", sa.DateTime(), nullable=True),
        sa.Column("artifact_path", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.hashed_device_id"]),
        sa.PrimaryKeyConstraint("trip_id"),
    )
    op.create_table(
        "chunks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("chunk_seq", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(), nullable=False),
        sa.Column("checksum", sa.String(), nullable=False),
        sa.Column("total_chunks", sa.Integer(), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("samples", sa.JSON(), nullable=False),
        sa.Column("artifact_path", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.trip_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", "chunk_seq", name="uq_chunks_trip_seq"),
    )


def downgrade() -> None:
    op.drop_table("chunks")
    op.drop_table("trips")
    op.drop_table("devices")
    op.drop_table("users")
