"""
Risk Events API Routes

提供风险事件查询入口（读路径，严格按 time_range 裁剪）。

Endpoints:
- GET /risk-events - 查询风险事件列表（必填维度）
- GET /risk-events/{id} - 获取风险事件详情（可选）

Reference:
- docs/v2/v2实施细则/09-风险事件表与Risk-Service-细则.md
"""

import logging
from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.risk_event import RiskEventResponse
from app.schemas.shared import DataType, WeatherType
from app.services.risk_service import risk_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/risk-events", tags=["risk-events"])


@router.get("/{event_id}", response_model=RiskEventResponse)
async def get_risk_event(
    event_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RiskEventResponse:
    """获取风险事件详情"""
    event = await risk_service.get_by_id(session, event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Risk event not found: {event_id}")
    return event


@router.get("", response_model=List[RiskEventResponse])
async def list_risk_events(
    session: Annotated[AsyncSession, Depends(get_session)],
    region_code: str = Query(..., description="区域代码"),
    weather_type: WeatherType = Query(..., description="天气类型"),
    data_type: DataType = Query(..., description="数据类型"),
    time_range_start: datetime = Query(..., description="开始时间(UTC)"),
    time_range_end: datetime = Query(..., description="结束时间(UTC)"),
    prediction_run_id: Optional[str] = Query(None, description="预测批次ID(predicted必须)"),
    product_id: Optional[str] = Query(None, description="产品ID"),
) -> List[RiskEventResponse]:
    """按维度查询风险事件"""
    try:
        return await risk_service.query_events(
            session,
            region_code=region_code,
            weather_type=weather_type,
            data_type=data_type,
            time_range_start=time_range_start,
            time_range_end=time_range_end,
            prediction_run_id=prediction_run_id,
            product_id=product_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
