"""
Internal Policy API Routes

提供保单的内部写入/修复接口（不对外公开）。
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_access_mode, get_session
from app.schemas.policy import Policy, PolicyCreate, PolicyUpdate
from app.schemas.shared import AccessMode
from app.services.policy_service import policy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/policies", tags=["internal-policies"])


@router.post("", response_model=Policy, status_code=201)
async def create_policy(
    payload: PolicyCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Policy:
    """内部创建保单"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can create policies")
    return await policy_service.create(session, payload)


@router.put("/{policy_id}", response_model=Policy)
async def update_policy(
    policy_id: str,
    payload: PolicyUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Policy:
    """内部更新保单"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can update policies")
    policy = await policy_service.update(session, policy_id, payload)
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy not found: {policy_id}")
    return policy


@router.delete("/{policy_id}")
async def delete_policy(
    policy_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> dict[str, bool]:
    """内部删除保单"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can delete policies")
    deleted = await policy_service.delete(session, policy_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Policy not found: {policy_id}")
    return {"deleted": True}
