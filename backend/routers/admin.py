from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy import func

from config import settings
from models.db_models import User, Order
from routers.auth import get_current_user
from services.db import get_session

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class MetricsResponse(BaseModel):
    total_users: int
    dau: int
    paid_amount: float


def require_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.email.strip().lower() not in settings.ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    session: Session = Depends(get_session),
    user: User = Depends(require_admin_user),
):
    total_users = session.exec(select(func.count(User.id))).one()
    start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    dau = session.exec(
        select(func.count(User.id)).where(User.last_active_at >= start_of_day)
    ).one()
    paid_amount = session.exec(
        select(func.coalesce(func.sum(Order.amount), 0)).where(Order.status == "paid")
    ).one()

    return {
        "total_users": int(total_users),
        "dau": int(dau),
        "paid_amount": float(paid_amount or 0),
    }
