import json
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from hashlib import md5
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from config import settings
from models.db_models import Order, User
from routers.auth import get_current_user
from services.db import get_session

router = APIRouter(prefix="/api/payments", tags=["Payments"])


PAYMENT_PACKAGES = {
    "starter": {"name": "入门版", "credits": 100, "amount": 9.9},
    "pro": {"name": "专业版", "credits": 500, "amount": 39.9},
    "enterprise": {"name": "企业版", "credits": 2000, "amount": 129.9},
}


class CreateOrderRequest(BaseModel):
    package_id: str


class CreateOrderResponse(BaseModel):
    order_id: str
    payment_url: str


class OrderRecord(BaseModel):
    out_trade_no: str
    amount: float
    credits: int
    status: str
    created_at: datetime
    paid_at: datetime | None


def _build_sign(params: dict[str, str]) -> str:
    parts = []
    for key in sorted(params.keys()):
        if key in ("sign", "sign_type"):
            continue
        value = params.get(key)
        if value is None or value == "":
            continue
        parts.append(f"{key}={value}")
    sign_str = "&".join(parts) + settings.ZPAY_KEY
    return md5(sign_str.encode("utf-8")).hexdigest()


@router.post("/create", response_model=CreateOrderResponse)
async def create_order(
    request: CreateOrderRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not settings.ZPAY_PID or not settings.ZPAY_KEY:
        raise HTTPException(status_code=500, detail="ZPay is not configured")

    package = PAYMENT_PACKAGES.get(request.package_id)
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package")

    out_trade_no = uuid.uuid4().hex
    order = Order(
        user_id=user.id,
        out_trade_no=out_trade_no,
        package_id=request.package_id,
        credits=package["credits"],
        amount=package["amount"],
        status="pending",
    )
    session.add(order)
    session.commit()

    params = {
        "pid": settings.ZPAY_PID,
        "type": settings.ZPAY_TYPE,
        "out_trade_no": out_trade_no,
        "notify_url": settings.ZPAY_NOTIFY_URL,
        "return_url": settings.ZPAY_RETURN_URL,
        "name": f"{package['name']} {package['credits']}积分",
        "money": f"{package['amount']:.2f}",
    }
    params["sign"] = _build_sign(params)
    params["sign_type"] = "MD5"

    payment_url = f"{settings.ZPAY_GATEWAY}?{urlencode(params)}"
    return {"order_id": out_trade_no, "payment_url": payment_url}


@router.get("/orders", response_model=list[OrderRecord])
async def list_orders(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    orders = session.exec(
        select(Order)
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
    ).all()
    return [
        OrderRecord(
            out_trade_no=order.out_trade_no,
            amount=order.amount,
            credits=order.credits,
            status=order.status,
            created_at=order.created_at,
            paid_at=order.paid_at,
        )
        for order in orders
    ]


@router.post("/notify")
async def zpay_notify(
    request: Request,
    session: Session = Depends(get_session),
):
    payload = dict(await request.form())
    if not payload:
        payload = dict(request.query_params)
    if not payload:
        raise HTTPException(status_code=400, detail="Missing payload")

    sign = payload.get("sign")
    if not sign:
        raise HTTPException(status_code=400, detail="Missing sign")

    expected_sign = _build_sign(payload)
    if sign.lower() != expected_sign.lower():
        raise HTTPException(status_code=400, detail="Invalid sign")

    trade_status = payload.get("trade_status") or payload.get("status")
    if trade_status not in ("TRADE_SUCCESS", "success", "SUCCESS", "1"):
        return "fail"

    out_trade_no = payload.get("out_trade_no")
    if not out_trade_no:
        return "fail"

    order = session.exec(select(Order).where(Order.out_trade_no == out_trade_no)).first()
    if not order:
        return "fail"
    if payload.get("money"):
        try:
            reported_amount = Decimal(str(payload.get("money"))).quantize(Decimal("0.01"))
            expected_amount = Decimal(str(order.amount)).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            return "fail"
        if reported_amount != expected_amount:
            return "fail"

    if order.status != "paid":
        order.status = "paid"
        order.paid_at = datetime.utcnow()
        order.notify_payload = json.dumps(payload, ensure_ascii=False)

        user = session.exec(select(User).where(User.id == order.user_id)).first()
        if user:
            user.credits += order.credits
            session.add(user)

        session.add(order)
        session.commit()

    return "success"
