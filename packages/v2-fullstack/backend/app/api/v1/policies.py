"""
Policy API Routes

提供保单的查询与统计入口（读路径）。

Endpoints:
- GET /policies - 查询保单列表（筛选）
- GET /policies/{id} - 获取保单详情
- GET /statistics/policies - 保单统计

Reference:
- docs/v2/v2实施细则/06-保单表与Policy-Service-细则.md
"""

import logging
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_access_mode, get_session
from app.schemas.policy import Policy, PolicyStats
from app.schemas.shared import AccessMode
from app.services.policy_service import policy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/policies", tags=["policies"])
stats_router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("", response_model=List[Policy])
async def list_policies(
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
    region_code: Optional[str] = Query(None, description="区域代码"),
    product_id: Optional[str] = Query(None, description="产品ID"),
    is_active: Optional[bool] = Query(True, description="是否只返回有效保单"),
    limit: int = Query(100, ge=1, le=1000, description="返回数量上限"),
) -> List[Policy]:
    """按筛选条件查询保单列表"""
    return await policy_service.list_by_filter(
        session,
        region_code=region_code,
        product_id=product_id,
        is_active=is_active,
        limit=limit,
        access_mode=access_mode,
    )


@router.get("/{policy_id}", response_model=Policy)
async def get_policy(
    policy_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Policy:
    """获取保单详情"""
    policy = await policy_service.get_by_id(session, policy_id, access_mode)
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy not found: {policy_id}")
    return policy


@stats_router.get("/policies", response_model=PolicyStats)
async def get_policy_stats(
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
    region_code: Optional[str] = Query(None, description="区域代码"),
    product_id: Optional[str] = Query(None, description="产品ID"),
) -> PolicyStats:
    """保单统计"""
    return await policy_service.get_stats(
        session,
        region_code=region_code,
        product_id=product_id,
        access_mode=access_mode,
    )
