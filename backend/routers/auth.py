
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select
from typing import Optional

from config import settings
from models.db_models import User
from services.db import get_session
from services.security import create_access_token, decode_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    invite_code: Optional[str] = None

class RegisterResponse(BaseModel):
    token: str
    credits: int
    message: str

class TokenRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    credits: int
    token_type: str

class BalanceResponse(BaseModel):
    credits: int

async def get_token_header(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authentication Scheme")
    
    return token

def _is_valid_invite_code(code: Optional[str]) -> bool:
    if not code:
        return False
    return code.strip() in settings.INVITE_CODES


def get_current_user(
    token: str = Depends(get_token_header),
    session: Session = Depends(get_session),
) -> User:
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = session.exec(select(User).where(User.id == int(user_id))).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


@router.post("/register", response_model=RegisterResponse)
async def register_user(
    request: RegisterRequest,
    session: Session = Depends(get_session),
):
    existing = session.exec(select(User).where(User.email == request.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    credits = settings.INVITE_BONUS if _is_valid_invite_code(request.invite_code) else settings.TRIAL_BONUS
    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        credits=credits,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {
        "token": token,
        "credits": user.credits,
        "message": "Registration successful",
    }


@router.post("/token", response_model=TokenResponse)
async def login_user(
    request: TokenRequest,
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.email == request.email)).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return {
        "token": token,
        "credits": user.credits,
        "token_type": "bearer",
    }

@router.get("/quota", response_model=BalanceResponse)
async def get_quota(user: User = Depends(get_current_user)):
    return {"credits": user.credits}
