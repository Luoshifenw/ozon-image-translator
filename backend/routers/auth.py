
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
from services.access_manager import access_manager

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class VerifyRequest(BaseModel):
    code: str

class VerifyResponse(BaseModel):
    token: str
    remaining_quota: int
    message: str

class QuotaResponse(BaseModel):
    usage: int
    limit: int
    remaining: int

async def get_token_header(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authentication Scheme")
    
    return token

@router.post("/verify", response_model=VerifyResponse)
async def verify_code(request: VerifyRequest):
    result = access_manager.verify_code(request.code)
    
    if not result:
        raise HTTPException(status_code=400, detail="Invalid code or no slots available")
        
    return {
        "token": result["token"],
        "remaining_quota": result["remaining_quota"],
        "message": "Activation successful"
    }

@router.get("/quota", response_model=QuotaResponse)
async def get_quota(token: str = Depends(get_token_header)):
    quota_info = access_manager.get_quota(token)
    
    if not quota_info:
        raise HTTPException(status_code=403, detail="Invalid session token")
        
    return quota_info
