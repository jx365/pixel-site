from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, create_guest_user, get_current_user
from app.config import settings
from app.database import get_db
from app.models import InviteCode, User
from app.schemas import InviteUpgradeRequest, ProfileUpdate, Token, UserOut, WeiboLoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/guest", response_model=Token)
def guest_login(db: Annotated[Session, Depends(get_db)]):
    user = create_guest_user(db)
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=user)


@router.post("/weibo", response_model=Token)
def weibo_login(
    _body: WeiboLoginRequest,
    user: Annotated[User, Depends(get_current_user)],
):
    # 占位：当前仅保留入口，后续接入微博 OAuth 后替换此逻辑。
    if user.auth_provider != "weibo":
        raise HTTPException(status_code=501, detail="微博登录占位接口，暂未接入真实 OAuth")
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=user)


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(get_current_user)]):
    return user


@router.patch("/profile", response_model=UserOut)
def update_profile(
    body: ProfileUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    user.display_name = body.display_name.strip() or user.display_name
    db.commit()
    db.refresh(user)
    return user


@router.post("/upgrade-admin", response_model=UserOut)
def upgrade_admin(
    body: InviteUpgradeRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    code = body.invite_code.strip()
    invite = db.query(InviteCode).filter(InviteCode.code == code, InviteCode.is_active.is_(True)).first()
    if not invite and code != settings.admin_invite_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邀请码无效")
    user.role = "admin"
    user.is_guest = False
    if invite:
        invite.is_active = False
        invite.used_by_user_id = user.id
    db.commit()
    db.refresh(user)
    return user
