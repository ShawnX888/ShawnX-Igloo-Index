"""
Risk Service (Risk Events read path).

This service is the backend "single source of truth" for persisted risk events.
It provides query primitives that are:
- prediction_run aware (no batch mixing)
- time_range clipped (caller supplies display window)

Note: CPU-bound risk calculations are handled by Risk Calculator + tasks (Step 08/15).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk_event import RiskEvent as RiskEventModel
from app.schemas.risk_event import RiskEventCreate, RiskEventResponse
from app.schemas.shared import DataType, WeatherType

logger = logging.getLogger(__name__)


class RiskService:
    """风险事件服务（查询为主，计算另见 Step 08/15）。"""

    async def get_by_id(
        self,
        session: AsyncSession,
        event_id: str,
    ) -> Optional[RiskEventResponse]:
        """按ID获取风险事件"""
        result = await session.execute(
            select(RiskEventModel).where(RiskEventModel.id == event_id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return RiskEventResponse(
            id=model.id,
            timestamp=model.timestamp,
            region_code=model.region_code,
            product_id=model.product_id,
            product_version=model.product_version,
            weather_type=WeatherType(model.weather_type),
            tier_level=model.tier_level,
            trigger_value=model.trigger_value,
            threshold_value=model.threshold_value,
            data_type=DataType(model.data_type),
            prediction_run_id=model.prediction_run_id,
            created_at=model.created_at,
        )

    async def query_events(
        self,
        session: AsyncSession,
        *,
        region_code: str,
        weather_type: WeatherType,
        data_type: DataType,
        time_range_start: datetime,
        time_range_end: datetime,
        prediction_run_id: Optional[str] = None,
        product_id: Optional[str] = None,
    ) -> List[RiskEventResponse]:
        """
        查询风险事件（严格按 time_range 裁剪）。

        predicted 规则：
        - predicted 必须带 prediction_run_id
        - historical 必须不带 prediction_run_id
        """
        start = self._ensure_utc(time_range_start)
        end = self._ensure_utc(time_range_end)

        if data_type == DataType.PREDICTED and not prediction_run_id:
            raise ValueError("prediction_run_id required for predicted")
        if data_type == DataType.HISTORICAL and prediction_run_id is not None:
            raise ValueError("prediction_run_id must be null for historical")

        query = select(RiskEventModel).where(
            RiskEventModel.region_code == region_code,
            RiskEventModel.weather_type == weather_type.value,
            RiskEventModel.data_type == data_type.value,
            RiskEventModel.timestamp >= start,
            RiskEventModel.timestamp <= end,
        )

        if data_type == DataType.PREDICTED:
            query = query.where(RiskEventModel.prediction_run_id == prediction_run_id)

        if product_id:
            query = query.where(RiskEventModel.product_id == product_id)

        result = await session.execute(query.order_by(RiskEventModel.timestamp))
        models = list(result.scalars().all())

        logger.info(
            "Risk events queried",
            extra={
                "region_code": region_code,
                "weather_type": weather_type.value,
                "data_type": data_type.value,
                "prediction_run_id": prediction_run_id,
                "count": len(models),
            },
        )

        return [
            RiskEventResponse(
                id=m.id,
                timestamp=m.timestamp,
                region_code=m.region_code,
                product_id=m.product_id,
                product_version=m.product_version,
                weather_type=WeatherType(m.weather_type),
                tier_level=m.tier_level,
                trigger_value=m.trigger_value,
                threshold_value=m.threshold_value,
                data_type=DataType(m.data_type),
                prediction_run_id=m.prediction_run_id,
                created_at=m.created_at,
            )
            for m in models
        ]
    
    async def create(
        self,
        session: AsyncSession,
        payload: RiskEventCreate,
    ) -> RiskEventResponse:
        """创建风险事件（内部写入）"""
        model = RiskEventModel(
            id=payload.id,
            timestamp=payload.timestamp,
            region_code=payload.region_code,
            product_id=payload.product_id,
            product_version=payload.product_version,
            weather_type=payload.weather_type.value,
            tier_level=payload.tier_level,
            trigger_value=payload.trigger_value,
            threshold_value=payload.threshold_value,
            data_type=payload.data_type.value,
            prediction_run_id=payload.prediction_run_id,
        )
        session.add(model)
        await session.commit()
        await session.refresh(model)
        return RiskEventResponse(
            id=model.id,
            timestamp=model.timestamp,
            region_code=model.region_code,
            product_id=model.product_id,
            product_version=model.product_version,
            weather_type=WeatherType(model.weather_type),
            tier_level=model.tier_level,
            trigger_value=model.trigger_value,
            threshold_value=model.threshold_value,
            data_type=DataType(model.data_type),
            prediction_run_id=model.prediction_run_id,
            created_at=model.created_at,
        )
    
    async def batch_create(
        self,
        session: AsyncSession,
        payloads: List[RiskEventCreate],
    ) -> List[RiskEventResponse]:
        """批量创建风险事件（内部写入）"""
        models = [
            RiskEventModel(
                id=item.id,
                timestamp=item.timestamp,
                region_code=item.region_code,
                product_id=item.product_id,
                product_version=item.product_version,
                weather_type=item.weather_type.value,
                tier_level=item.tier_level,
                trigger_value=item.trigger_value,
                threshold_value=item.threshold_value,
                data_type=item.data_type.value,
                prediction_run_id=item.prediction_run_id,
            )
            for item in payloads
        ]
        session.add_all(models)
        await session.commit()
        for model in models:
            await session.refresh(model)
        return [
            RiskEventResponse(
                id=m.id,
                timestamp=m.timestamp,
                region_code=m.region_code,
                product_id=m.product_id,
                product_version=m.product_version,
                weather_type=WeatherType(m.weather_type),
                tier_level=m.tier_level,
                trigger_value=m.trigger_value,
                threshold_value=m.threshold_value,
                data_type=DataType(m.data_type),
                prediction_run_id=m.prediction_run_id,
                created_at=m.created_at,
            )
            for m in models
        ]

    def _ensure_utc(self, dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)


risk_service = RiskService()

