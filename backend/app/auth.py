from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.get(User, int(user_id))
    if user is None:
        raise credentials_exception
    return user


def _ensure_guest_user(db: Session) -> User:
    guest = db.query(User).filter(User.username == "__guest__").first()
    if guest:
        return guest

    guest = User(
        username="__guest__",
        email="__guest__@local.user",
        password_hash=hash_password("guest-not-for-login"),
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


def get_current_or_guest_user(
    token: Annotated[str | None, Depends(oauth2_optional_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if not token:
        return _ensure_guest_user(db)

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            return _ensure_guest_user(db)
    except JWTError:
        return _ensure_guest_user(db)

    user = db.get(User, int(user_id))
    if user is None:
        return _ensure_guest_user(db)
    return user
