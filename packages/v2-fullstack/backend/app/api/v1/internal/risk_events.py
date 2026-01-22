"""
Internal Risk Events API Routes

提供风险事件的内部写入/修复接口（不对外公开）。
"""

import logging
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_access_mode, get_session
from app.schemas.risk_event import RiskEventCreate, RiskEventResponse
from app.schemas.shared import AccessMode
from app.services.risk_service import risk_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/risk-events", tags=["internal-risk-events"])


@router.post("", response_model=RiskEventResponse, status_code=201)
async def create_risk_event(
    payload: RiskEventCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> RiskEventResponse:
    """内部创建风险事件"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can create risk events")
    return await risk_service.create(session, payload)


@router.post("/batch", response_model=List[RiskEventResponse], status_code=201)
async def batch_create_risk_events(
    payload: List[RiskEventCreate],
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> List[RiskEventResponse]:
    """内部批量创建风险事件"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can create risk events")
    return await risk_service.batch_create(session, payload)
