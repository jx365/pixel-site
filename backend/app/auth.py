from datetime import datetime, timedelta
import random
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/guest")
oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/guest", auto_error=False)
NICK_ADJECTIVES = ["像素", "彩虹", "云朵", "夜空", "薄荷", "珊瑚", "琥珀", "霓虹"]
NICK_ANIMALS = ["小猫", "海豚", "狐狸", "鲸鱼", "松鼠", "知更鸟", "水獭", "北极熊"]


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )


def random_guest_name() -> str:
    return f"{random.choice(NICK_ADJECTIVES)}{random.choice(NICK_ANIMALS)}{random.randint(1000, 9999)}"


def create_guest_user(db: Session) -> User:
    guest_session_id = uuid.uuid4().hex
    user = User(
        username=f"guest_{guest_session_id[:12]}",
        email=None,
        password_hash=None,
        display_name=random_guest_name(),
        auth_provider="guest",
        role="guest",
        is_guest=True,
        guest_session_id=guest_session_id,
        weibo_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def decode_user_from_token(token: str | None, db: Session) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return db.get(User, int(user_id))


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = decode_user_from_token(token, db)
    if user is None:
        raise _credentials_exception()
    return user


def get_current_or_guest_user(
    token: Annotated[str | None, Depends(oauth2_optional_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = decode_user_from_token(token, db)
    if user is not None:
        return user
    return create_guest_user(db)


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user
