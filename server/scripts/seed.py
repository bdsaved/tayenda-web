"""Seed operator accounts.

The default operator (from OPERATOR_USERNAME / OPERATOR_PASSWORD) is created
automatically at API startup via ensure_default_operator(). This script seeds an
additional named admin and can be run manually:

    python -m scripts.seed            # from web/server/

It uses the same pbkdf2_sha256 hasher the API verifies against
(app.core.security.get_password_hash) — NOT bcrypt/passlib — so seeded accounts
can actually log in.
"""
import os
import sys

from sqlalchemy.orm import Session

# Allow importing the `app` package when run directly.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import SessionLocal
from app.core.security import ensure_default_operator, get_password_hash
from app.models.models import User

def _extra_admins() -> list[dict]:
    """Optional named admin, configured entirely via env vars.

    No credentials are hardcoded. Set SEED_ADMIN_USERNAME and
    SEED_ADMIN_PASSWORD to seed an additional admin; otherwise only the
    default operator is ensured.
    """
    username = os.getenv("SEED_ADMIN_USERNAME")
    password = os.getenv("SEED_ADMIN_PASSWORD")
    if not username or not password:
        return []
    return [
        {
            "username": username,
            "email": os.getenv("SEED_ADMIN_EMAIL", f"{username}@tayenda.renai-labs.com"),
            "password": password,
            "full_name": os.getenv("SEED_ADMIN_FULL_NAME", "Tayenda Administrator"),
            "role": "admin",
        }
    ]


def seed_users() -> None:
    db: Session = SessionLocal()
    try:
        # Guarantee the configured default operator exists too.
        ensure_default_operator(db)

        for admin in _extra_admins():
            existing = db.query(User).filter(User.username == admin["username"]).first()
            if existing is not None:
                print(f"[=] admin already exists: {admin['username']}")
                continue

            db.add(
                User(
                    username=admin["username"],
                    email=admin["email"],
                    password_hash=get_password_hash(admin["password"]),
                    full_name=admin["full_name"],
                    role=admin["role"],
                    is_active=True,
                )
            )
            db.commit()
            print(f"[+] created admin: {admin['username']}")
    except Exception as exc:  # noqa: BLE001 - surface seeding errors to the operator
        db.rollback()
        print(f"[!] error seeding database: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_users()
