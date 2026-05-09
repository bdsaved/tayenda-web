from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .config import settings
from ..models.models import User

HASH_ITERATIONS = 210_000
HASH_ALGORITHM = "sha256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        scheme, iterations_raw, salt, stored_hash = hashed_password.split("$", 3)
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    iterations = int(iterations_raw)
    candidate = hashlib.pbkdf2_hmac(
        HASH_ALGORITHM,
        plain_password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return secrets.compare_digest(candidate, stored_hash)


def get_password_hash(password: str) -> str:
    salt = secrets.token_urlsafe(16)
    password_hash = hashlib.pbkdf2_hmac(
        HASH_ALGORITHM,
        password.encode("utf-8"),
        salt.encode("utf-8"),
        HASH_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${HASH_ITERATIONS}${salt}${password_hash}"


def create_access_token(subject: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": subject, "exp": expires_at}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def ensure_default_operator(db: Session) -> None:
    existing = db.query(User).filter(User.username == settings.OPERATOR_USERNAME).first()
    if existing is not None:
        return

    db.add(
        User(
            username=settings.OPERATOR_USERNAME,
            email=settings.OPERATOR_EMAIL,
            password_hash=get_password_hash(settings.OPERATOR_PASSWORD),
            full_name="Tayenda Operator",
            role="admin",
        )
    )
    db.commit()
