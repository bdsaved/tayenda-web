from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import authenticate_user, create_access_token
from ..models.models import User
from ..schemas.schemas import LoginRequest, TokenResponse, UserResponse
from . import analytics, mobile, trips
from .deps import require_operator

router = APIRouter(prefix="/v1")


@router.get("/health")
def api_health() -> dict[str, str]:
    return {"status": "healthy"}


@router.post("/auth/login", response_model=TokenResponse)
def login(login_in: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, login_in.username, login_in.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return TokenResponse(access_token=create_access_token(user.username), user=UserResponse.model_validate(user))


@router.get("/auth/me", response_model=UserResponse)
def current_user(user: User = Depends(require_operator)) -> UserResponse:
    return UserResponse.model_validate(user)


router.include_router(mobile.router)
router.include_router(trips.router)
router.include_router(analytics.router)
