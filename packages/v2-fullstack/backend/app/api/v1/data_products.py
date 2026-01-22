"""
Data Product API Routes

提供L0/L1/L2/Overlays数据产品的统一接口

Endpoints:
- POST /data-products/l0-dashboard
- POST /data-products/map-overlays
- POST /data-products/l1-intelligence

Reference:
- docs/v2/v2实施细则/11-L0-Dashboard-细则.md
- docs/v2/v2实施细则/12-Map-Overlays-细则.md
- docs/v2/v2实施细则/13-L1-Intelligence-细则.md
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.access_control import DataProductType
from app.schemas.shared import DataProductResponse, SharedDimensions
from app.schemas.l2_evidence import L2EvidenceRequest, L2EvidenceResponse
from app.services.l2_evidence_service import l2_evidence_service
from app.services.data_products_service import (
    l0_dashboard_service,
    map_overlays_service,
    l1_intelligence_service,
)
from app.utils.access_control import AccessControlManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data-products", tags=["data-products"])


@router.post("/l0-dashboard", response_model=DataProductResponse)
async def get_l0_dashboard(
    dimensions: SharedDimensions,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DataProductResponse:
    """
    L0 Dashboard 数据产品
    
    返回: KPI + TopN排名
    """
    # 应用Access Control
    ac_manager = AccessControlManager(
        mode=dimensions.access_mode,
        data_product=DataProductType.L0_DASHBOARD,
    )

    response = l0_dashboard_service.build_response(dimensions)
    pruned, _ = ac_manager.prune_data(response.model_dump())
    return DataProductResponse.model_validate(pruned)


@router.post("/map-overlays", response_model=DataProductResponse)
async def get_map_overlays(
    dimensions: SharedDimensions,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DataProductResponse:
    """Map Overlays 数据产品"""
    ac_manager = AccessControlManager(
        mode=dimensions.access_mode,
        data_product=DataProductType.MAP_OVERLAYS,
    )
    response = map_overlays_service.build_response(dimensions)
    pruned, _ = ac_manager.prune_data(response.model_dump())
    return DataProductResponse.model_validate(pruned)


@router.post("/l1-intelligence", response_model=DataProductResponse)
async def get_l1_intelligence(
    dimensions: SharedDimensions,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DataProductResponse:
    """L1 Region Intelligence 数据产品"""
    ac_manager = AccessControlManager(
        mode=dimensions.access_mode,
        data_product=DataProductType.L1_REGION_INTELLIGENCE,
    )
    response = l1_intelligence_service.build_response(dimensions)
    pruned, _ = ac_manager.prune_data(response.model_dump())
    return DataProductResponse.model_validate(pruned)


@router.post("/l2-evidence", response_model=L2EvidenceResponse)
async def get_l2_evidence(
    request: L2EvidenceRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> L2EvidenceResponse:
    """
    L2 Evidence 数据产品
    
    返回: 风险事件 + 理赔 + 天气证据
    """
    return await l2_evidence_service.get_evidence(session, request)
