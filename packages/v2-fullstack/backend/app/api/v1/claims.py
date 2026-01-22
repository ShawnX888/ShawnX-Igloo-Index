"""
Claim API Routes

提供 claims 的查询、内部写入/修复接口，以及统计入口。

Endpoints:
- GET /claims - 查询理赔列表（筛选）
- GET /claims/{id} - 获取理赔详情
- POST /claims - 创建理赔（内部/Admin）
- PUT /claims/{id} - 更新理赔（内部/Admin）
- DELETE /claims/{id} - 删除理赔（内部/Admin）
- GET /policies/{id}/claims - 获取保单理赔列表
- GET /statistics/claims - 理赔统计

Reference:
- docs/v2/v2实施细则/30-理赔表与Claim-Service-细则.md
"""

import logging
from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_access_mode, get_session
from app.schemas.claim import Claim, ClaimCreate, ClaimFilter, ClaimStats, ClaimUpdate
from app.schemas.shared import AccessMode, DataType
from app.services.claim_service import claim_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/claims", tags=["claims"])
policy_router = APIRouter(prefix="/policies", tags=["claims"])
stats_router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("", response_model=List[Claim])
async def list_claims(
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
    policy_id: Optional[str] = Query(None, description="保单ID"),
    product_id: Optional[str] = Query(None, description="产品ID"),
    region_code: Optional[str] = Query(None, description="区域代码"),
    status: Optional[str] = Query(None, description="理赔状态"),
    tier_level: Optional[int] = Query(None, ge=1, le=3, description="档位等级"),
    start_time: Optional[datetime] = Query(None, description="开始时间(UTC)"),
    end_time: Optional[datetime] = Query(None, description="结束时间(UTC)"),
    limit: int = Query(100, ge=1, le=1000, description="返回数量上限"),
) -> List[Claim]:
    """按筛选条件查询理赔列表"""
    claim_filter = ClaimFilter(
        policy_id=policy_id,
        product_id=product_id,
        region_code=region_code,
        status=status,
        tier_level=tier_level,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )
    return await claim_service.list_by_filter(session, claim_filter, access_mode)


@router.get("/{claim_id}", response_model=Claim)
async def get_claim(
    claim_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Claim:
    """获取理赔详情"""
    claim = await claim_service.get_by_id(session, claim_id, access_mode)
    if not claim:
        raise HTTPException(status_code=404, detail=f"Claim not found: {claim_id}")
    return claim


@router.post("", response_model=Claim, status_code=201)
async def create_claim(
    claim_create: ClaimCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
    data_type: DataType = Query(DataType.HISTORICAL, description="数据类型"),
) -> Claim:
    """创建理赔（内部/Admin）"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can create claims")
    try:
        return await claim_service.create(session, claim_create, data_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{claim_id}", response_model=Claim)
async def update_claim(
    claim_id: str,
    claim_update: ClaimUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Claim:
    """更新理赔（内部/Admin）"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can update claims")
    claim = await claim_service.update(session, claim_id, claim_update)
    if not claim:
        raise HTTPException(status_code=404, detail=f"Claim not found: {claim_id}")
    return claim


@router.delete("/{claim_id}")
async def delete_claim(
    claim_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> dict[str, bool]:
    """删除理赔（内部/Admin）"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can delete claims")
    deleted = await claim_service.delete(session, claim_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Claim not found: {claim_id}")
    return {"deleted": True}


@policy_router.get("/{policy_id}/claims", response_model=List[Claim])
async def list_claims_by_policy(
    policy_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> List[Claim]:
    """按保单查询理赔列表"""
    return await claim_service.list_by_policy(session, policy_id, access_mode)


@stats_router.get("/claims", response_model=ClaimStats)
async def get_claim_stats(
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
    region_code: Optional[str] = Query(None, description="区域代码"),
    product_id: Optional[str] = Query(None, description="产品ID"),
) -> ClaimStats:
    """理赔统计"""
    return await claim_service.get_stats(
        session,
        region_code=region_code,
        product_id=product_id,
        access_mode=access_mode,
    )
