from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy import func

from config import settings
from models.db_models import User, Order
from services.db import get_session

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class MetricsResponse(BaseModel):
    total_users: int
    dau: int
    paid_amount: float


def require_admin_token(x_admin_token: str | None = Header(None)) -> None:
    if not settings.ADMIN_TOKEN or x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/metrics", response_model=MetricsResponse, dependencies=[Depends(require_admin_token)])
async def get_metrics(session: Session = Depends(get_session)):
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
