"""
Prediction Run Service

完善Phase 0 Step 03的数据库层实现

职责:
- CRUD prediction_runs
- 管理active_run切换
- 批次查询与过滤

Reference:
- docs/v2/v2实施细则/10-预测批次表与Service-细则.md
- Phase 0 Step 03: app/utils/prediction_run.py
"""

import logging
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prediction_run import PredictionRun as PredictionRunModel
from app.schemas.prediction import (
    PredictionRun,
    PredictionRunCreate,
    PredictionRunFilter,
    PredictionRunListResponse,
    PredictionRunStatus,
)

logger = logging.getLogger(__name__)


class PredictionRunService:
    """预测批次服务"""
    
    async def get_by_id(
        self,
        session: AsyncSession,
        run_id: str
    ) -> Optional[PredictionRun]:
        """根据ID获取批次"""
        result = await session.execute(
            select(PredictionRunModel).where(PredictionRunModel.id == run_id)
        )
        model = result.scalar_one_or_none()
        
        return self._model_to_schema(model) if model else None
    
    async def get_active_run(
        self,
        session: AsyncSession
    ) -> Optional[PredictionRun]:
        """获取当前active批次"""
        result = await session.execute(
            select(PredictionRunModel)
            .where(PredictionRunModel.status == PredictionRunStatus.ACTIVE.value)
            .order_by(PredictionRunModel.created_at.desc())
            .limit(1)
        )
        model = result.scalar_one_or_none()
        
        return self._model_to_schema(model) if model else None
    
    async def list_runs(
        self,
        session: AsyncSession,
        filter: PredictionRunFilter
    ) -> PredictionRunListResponse:
        """查询批次列表"""
        query = select(PredictionRunModel)
        
        if filter.status:
            query = query.where(PredictionRunModel.status == filter.status.value)
        if filter.source:
            query = query.where(PredictionRunModel.source == filter.source.value)
        if filter.weather_type:
            query = query.where(PredictionRunModel.weather_type == filter.weather_type)
        
        query = query.order_by(PredictionRunModel.created_at.desc()).limit(filter.limit)
        
        result = await session.execute(query)
        models = list(result.scalars().all())
        
        # 获取active_run
        active_run_model = await self.get_active_run(session)
        
        return PredictionRunListResponse(
            runs=[self._model_to_schema(m) for m in models],
            total=len(models),
            active_run=active_run_model
        )
    
    def _model_to_schema(self, model: PredictionRunModel) -> PredictionRun:
        """转换模型到Schema"""
        from app.schemas.prediction import PredictionRunStatus, PredictionRunSource
        
        return PredictionRun(
            id=model.id,
            status=PredictionRunStatus(model.status),
            source=PredictionRunSource(model.source),
            note=model.note,
            weather_type=model.weather_type,
            product_id=model.product_id,
            region_scope=model.region_scope,
            created_at=model.created_at,
        )


prediction_run_service = PredictionRunService()
