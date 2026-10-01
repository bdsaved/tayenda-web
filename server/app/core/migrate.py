"""Bring the database schema up to date at startup.

Earlier deployments created tables with ``Base.metadata.create_all`` and never
ran Alembic, so their databases have the initial tables but no
``alembic_version`` row. Those are stamped at the last revision that
``create_all`` would have produced before upgrading.
"""
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from .config import settings

logger = logging.getLogger(__name__)

SERVER_DIR = Path(__file__).resolve().parents[2]
# Last revision whose schema matches what create_all built before Alembic was used.
PRE_ALEMBIC_REVISION = "20260512_0002"


def _alembic_config() -> Config:
    config = Config(str(SERVER_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(SERVER_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    # Keep the application's logging configuration.
    config.attributes["configure_logger"] = False
    return config


def run_migrations(engine: Engine) -> None:
    config = _alembic_config()
    tables = set(inspect(engine).get_table_names())
    if "alembic_version" not in tables and "trips" in tables:
        logger.info("Stamping pre-Alembic database at %s", PRE_ALEMBIC_REVISION)
        command.stamp(config, PRE_ALEMBIC_REVISION)
    command.upgrade(config, "head")
