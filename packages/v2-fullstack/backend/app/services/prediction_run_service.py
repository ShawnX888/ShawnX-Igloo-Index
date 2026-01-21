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
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prediction_run import PredictionRun as PredictionRunModel
from app.schemas.prediction import (
    ActiveRunSwitchRecord,
    ActiveRunSwitchRequest,
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

    async def create(
        self,
        session: AsyncSession,
        run_id: str,
        payload: PredictionRunCreate,
        *,
        weather_type: Optional[str] = None,
        product_id: Optional[str] = None,
        region_scope: Optional[str] = None,
    ) -> PredictionRun:
        """
        创建 PredictionRun 记录（MVP）。

        注意：run_id 由上游生成（见 utils.generate_run_id），服务层只负责落库与可审计字段。
        """
        model = PredictionRunModel(
            id=run_id,
            status=payload.status.value,
            source=payload.source.value,
            note=payload.note,
            weather_type=weather_type,
            product_id=product_id,
            region_scope=region_scope,
        )

        session.add(model)
        await session.commit()
        await session.refresh(model)
        if model.created_at is None:
            # Fallback for environments where DB defaults are not applied (e.g., mocked sessions)
            model.created_at = datetime.now(timezone.utc)

        logger.info(
            "Prediction run created",
            extra={
                "run_id": run_id,
                "status": payload.status.value,
                "source": payload.source.value,
            },
        )

        return self._model_to_schema(model)

    async def switch_active_run(
        self,
        session: AsyncSession,
        request: ActiveRunSwitchRequest,
    ) -> ActiveRunSwitchRecord:
        """
        切换 active_run（状态切换，不覆盖历史数据）。

        - 当前 active → archived
        - 目标 run → active
        """
        # 1) 目标 run 必须存在
        target = await self.get_by_id(session, request.new_active_run_id)
        if not target:
            raise ValueError(f"PredictionRun not found: {request.new_active_run_id}")

        # 2) 获取当前 active（如果有）
        current = await self.get_active_run(session)
        from_run_id = current.id if current else "none"

        # 3) 状态切换（DB model 层）
        # 重新取 model，确保可写
        current_model = None
        if current:
            result = await session.execute(
                select(PredictionRunModel).where(PredictionRunModel.id == current.id)
            )
            current_model = result.scalar_one_or_none()

        result = await session.execute(
            select(PredictionRunModel).where(PredictionRunModel.id == request.new_active_run_id)
        )
        target_model = result.scalar_one_or_none()
        if not target_model:
            raise ValueError(f"PredictionRun not found: {request.new_active_run_id}")

        if current_model and current_model.id != target_model.id:
            current_model.status = PredictionRunStatus.ARCHIVED.value
        target_model.status = PredictionRunStatus.ACTIVE.value

        await session.commit()

        record = ActiveRunSwitchRecord(
            from_run_id=from_run_id,
            to_run_id=request.new_active_run_id,
            switched_at=datetime.now(timezone.utc),
            reason=request.reason,
            operator=request.operator,
            scope=request.scope or "global",
            affected_cache_keys=None,  # 缓存失效在 Phase 1/后续步骤接入
            affected_data_products=None,
        )

        logger.warning(
            "Active run switched",
            extra={
                "from_run_id": record.from_run_id,
                "to_run_id": record.to_run_id,
                "operator": record.operator,
                "scope": record.scope,
            },
        )

        return record
    
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

    async def rollback_to_previous_run(
        self,
        session: AsyncSession,
        *,
        reason: str,
        operator: Optional[str] = None,
    ) -> Optional[ActiveRunSwitchRecord]:
        """
        回滚到最近一个 archived 批次（MVP：全局）。
        """
        current = await self.get_active_run(session)
        if not current:
            return None

        result = await session.execute(
            select(PredictionRunModel)
            .where(PredictionRunModel.status == PredictionRunStatus.ARCHIVED.value)
            .order_by(PredictionRunModel.created_at.desc())
            .limit(1)
        )
        prev = result.scalar_one_or_none()
        if not prev:
            return None

        return await self.switch_active_run(
            session,
            ActiveRunSwitchRequest(
                new_active_run_id=prev.id,
                reason=f"ROLLBACK: {reason}",
                operator=operator,
                scope="global",
            ),
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
