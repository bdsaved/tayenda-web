import pytest
from sqlalchemy import create_engine, inspect, text

from app.core import migrate
from app.core.config import Settings


def test_pre_alembic_database_is_stamped_and_upgraded(tmp_path, monkeypatch):
    """Production databases were built with create_all and have no alembic_version."""
    url = f"sqlite:///{(tmp_path / 'legacy.db').as_posix()}"
    monkeypatch.setattr(migrate.settings, "DATABASE_URL", url)
    engine = create_engine(url)

    from alembic import command

    command.upgrade(migrate._alembic_config(), migrate.PRE_ALEMBIC_REVISION)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE alembic_version"))

    migrate.run_migrations(engine)

    inspector = inspect(engine)
    assert {"road_segments", "hazards", "alembic_version"} <= set(inspector.get_table_names())
    assert "roughness_avg" in {c["name"] for c in inspector.get_columns("trips")}


def test_production_refuses_default_secrets():
    with pytest.raises(RuntimeError):
        Settings(ENVIRONMENT="production", SECRET_KEY="supersecretkey", OPERATOR_PASSWORD="x" * 20).check_secrets()
    with pytest.raises(RuntimeError):
        Settings(ENVIRONMENT="production", SECRET_KEY="k" * 32, OPERATOR_PASSWORD="tayenda-admin").check_secrets()
    Settings(ENVIRONMENT="production", SECRET_KEY="k" * 32, OPERATOR_PASSWORD="a-real-password").check_secrets()
