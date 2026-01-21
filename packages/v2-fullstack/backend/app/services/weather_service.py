"""
Weather Service

职责:
- 查询天气数据(historical/predicted)
- 统计聚合
- 支持扩展窗口查询

Reference:
- docs/v2/v2实施细则/07-天气数据表与Weather-Service-细则.md
"""

import logging
from typing import List

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.weather import WeatherData as WeatherModel
from app.schemas.weather import WeatherDataPoint, WeatherQueryRequest, WeatherStats
from app.schemas.shared import DataType

logger = logging.getLogger(__name__)


class WeatherService:
    """天气数据服务"""
    
    async def query_time_series(
        self,
        session: AsyncSession,
        request: WeatherQueryRequest
    ) -> List[WeatherDataPoint]:
        """查询时间序列"""
        query = select(WeatherModel).where(
            WeatherModel.region_code == request.region_code,
            WeatherModel.weather_type == request.weather_type.value,
            WeatherModel.data_type == request.data_type.value,
            WeatherModel.timestamp >= request.start_time,
            WeatherModel.timestamp <= request.end_time
        )
        
        if request.data_type == DataType.PREDICTED:
            if not request.prediction_run_id:
                raise ValueError("prediction_run_id required for predicted data")
            query = query.where(
                WeatherModel.prediction_run_id == request.prediction_run_id
            )
        
        query = query.order_by(WeatherModel.timestamp)
        
        result = await session.execute(query)
        models = list(result.scalars().all())
        
        return [self._model_to_schema(m) for m in models]

    async def query_stats(
        self,
        session: AsyncSession,
        request: WeatherQueryRequest,
    ) -> WeatherStats:
        """
        查询窗口内的聚合统计（sum/avg/max/min/count）。

        注意：
        - 统计窗口按 request.start_time/end_time（UTC）裁剪
        - predicted 必须显式绑定 prediction_run_id
        """
        query = select(
            func.sum(WeatherModel.value),
            func.avg(WeatherModel.value),
            func.max(WeatherModel.value),
            func.min(WeatherModel.value),
            func.count(),
        ).where(
            WeatherModel.region_code == request.region_code,
            WeatherModel.weather_type == request.weather_type.value,
            WeatherModel.data_type == request.data_type.value,
            WeatherModel.timestamp >= request.start_time,
            WeatherModel.timestamp <= request.end_time,
        )

        if request.data_type == DataType.PREDICTED:
            if not request.prediction_run_id:
                raise ValueError("prediction_run_id required for predicted data")
            query = query.where(WeatherModel.prediction_run_id == request.prediction_run_id)

        result = await session.execute(query)
        row = result.one()

        return WeatherStats(
            sum=row[0],
            avg=row[1],
            max=row[2],
            min=row[3],
            count=int(row[4]),
        )
    
    def _model_to_schema(self, model: WeatherModel) -> WeatherDataPoint:
        """转换模型到Schema"""
        return WeatherDataPoint(
            timestamp=model.timestamp,
            region_code=model.region_code,
            weather_type=model.weather_type,
            value=model.value,
            unit=model.unit,
            data_type=model.data_type,
            prediction_run_id=model.prediction_run_id,
        )


weather_service = WeatherService()
