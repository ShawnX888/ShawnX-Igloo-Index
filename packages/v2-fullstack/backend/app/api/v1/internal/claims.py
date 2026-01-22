"""
Internal Claims API Routes

提供理赔的内部写入/修复接口（不对外公开）。
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_access_mode, get_session
from app.schemas.claim import Claim, ClaimCreate, ClaimUpdate
from app.schemas.shared import AccessMode, DataType
from app.services.claim_service import claim_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/claims", tags=["internal-claims"])


@router.post("", response_model=Claim, status_code=201)
async def create_claim(
    payload: ClaimCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Claim:
    """内部创建理赔"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can create claims")
    return await claim_service.create(session, payload, DataType.HISTORICAL)


@router.put("/{claim_id}", response_model=Claim)
async def update_claim(
    claim_id: str,
    payload: ClaimUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Claim:
    """内部更新理赔"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can update claims")
    claim = await claim_service.update(session, claim_id, payload)
    if not claim:
        raise HTTPException(status_code=404, detail=f"Claim not found: {claim_id}")
    return claim


@router.delete("/{claim_id}")
async def delete_claim(
    claim_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> dict[str, bool]:
    """内部删除理赔"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can delete claims")
    deleted = await claim_service.delete(session, claim_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Claim not found: {claim_id}")
    return {"deleted": True}
