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
from app.schemas.risk_event import RiskEventResponse
from app.schemas.shared import DataType, WeatherType

logger = logging.getLogger(__name__)


class RiskService:
    """风险事件服务（查询为主，计算另见 Step 08/15）。"""

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

    def _ensure_utc(self, dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)


risk_service = RiskService()

