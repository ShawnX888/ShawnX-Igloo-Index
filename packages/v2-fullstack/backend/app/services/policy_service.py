"""
Policy Service

职责:
- 保单CRUD
- 统计查询 (用于L0/L1数据产品)
- Mode裁剪 (敏感字段/金额)

Reference:
- docs/v2/v2实施细则/06-保单表与Policy-Service-细则.md
"""

import logging
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.policy import Policy as PolicyModel
from app.schemas.policy import Policy, PolicyCreate, PolicyStats, PolicyUpdate
from app.schemas.shared import AccessMode

logger = logging.getLogger(__name__)


class PolicyService:
    """保单服务"""
    
    async def create(
        self,
        session: AsyncSession,
        payload: PolicyCreate,
    ) -> Policy:
        """创建保单"""
        model = PolicyModel(
            id=payload.id,
            policy_number=payload.policy_number,
            product_id=payload.product_id,
            coverage_region=payload.coverage_region,
            coverage_amount=payload.coverage_amount,
            timezone=payload.timezone,
            coverage_start=payload.coverage_start,
            coverage_end=payload.coverage_end,
            holder_name=payload.holder_name,
            is_active=payload.is_active,
        )
        session.add(model)
        await session.commit()
        await session.refresh(model)
        return self._model_to_schema(model)
    
    async def update(
        self,
        session: AsyncSession,
        policy_id: str,
        payload: PolicyUpdate,
    ) -> Optional[Policy]:
        """更新保单"""
        result = await session.execute(
            select(PolicyModel).where(PolicyModel.id == policy_id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        
        if payload.coverage_amount is not None:
            model.coverage_amount = payload.coverage_amount
        if payload.coverage_end is not None:
            model.coverage_end = payload.coverage_end
        if payload.holder_name is not None:
            model.holder_name = payload.holder_name
        if payload.is_active is not None:
            model.is_active = payload.is_active
        
        await session.commit()
        await session.refresh(model)
        return self._model_to_schema(model)
    
    async def delete(
        self,
        session: AsyncSession,
        policy_id: str,
    ) -> bool:
        """删除保单"""
        result = await session.execute(
            select(PolicyModel).where(PolicyModel.id == policy_id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return False
        await session.delete(model)
        await session.commit()
        return True
    
    async def get_by_id(
        self,
        session: AsyncSession,
        policy_id: str,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> Optional[Policy]:
        """获取保单详情"""
        result = await session.execute(
            select(PolicyModel).where(PolicyModel.id == policy_id)
        )
        model = result.scalar_one_or_none()
        
        if not model:
            return None
        
        policy = self._model_to_schema(model)
        return self._apply_mode_pruning(policy, access_mode)
    
    async def list_by_region(
        self,
        session: AsyncSession,
        region_code: str,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> List[Policy]:
        """按区域查询保单"""
        result = await session.execute(
            select(PolicyModel)
            .where(PolicyModel.coverage_region == region_code)
            .where(PolicyModel.is_active == True)
        )
        models = list(result.scalars().all())
        
        return [
            self._apply_mode_pruning(self._model_to_schema(m), access_mode)
            for m in models
        ]
    
    async def list_by_filter(
        self,
        session: AsyncSession,
        *,
        region_code: Optional[str] = None,
        product_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 100,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC,
    ) -> List[Policy]:
        """按条件查询保单"""
        query = select(PolicyModel)
        
        if region_code:
            query = query.where(PolicyModel.coverage_region == region_code)
        if product_id:
            query = query.where(PolicyModel.product_id == product_id)
        if is_active is not None:
            query = query.where(PolicyModel.is_active == is_active)
        
        query = query.limit(limit)
        
        result = await session.execute(query)
        models = list(result.scalars().all())
        
        return [
            self._apply_mode_pruning(self._model_to_schema(m), access_mode)
            for m in models
        ]
    
    async def get_stats(
        self,
        session: AsyncSession,
        region_code: Optional[str] = None,
        product_id: Optional[str] = None,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> PolicyStats:
        """获取保单统计"""
        query = select(
            func.count(PolicyModel.id).label("count"),
            func.sum(PolicyModel.coverage_amount).label("total_amount")
        ).where(PolicyModel.is_active == True)
        
        if region_code:
            query = query.where(PolicyModel.coverage_region == region_code)
        if product_id:
            query = query.where(PolicyModel.product_id == product_id)
        
        result = await session.execute(query)
        row = result.first()
        
        stats = PolicyStats(
            policy_count=row.count or 0,
            coverage_amount_sum=row.total_amount
        )
        
        # Mode裁剪
        if access_mode == AccessMode.DEMO_PUBLIC:
            stats.coverage_amount_sum = None  # 不返回精确总额
        
        return stats
    
    def _model_to_schema(self, model: PolicyModel) -> Policy:
        """转换模型到Schema"""
        return Policy(
            id=model.id,
            policy_number=model.policy_number,
            product_id=model.product_id,
            coverage_region=model.coverage_region,
            coverage_amount=model.coverage_amount,
            timezone=model.timezone,
            coverage_start=model.coverage_start,
            coverage_end=model.coverage_end,
            holder_name=model.holder_name,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
    
    def _apply_mode_pruning(self, policy: Policy, mode: AccessMode) -> Policy:
        """应用Mode裁剪"""
        if mode == AccessMode.DEMO_PUBLIC:
            # 脱敏持有人信息
            if policy.holder_name:
                policy.holder_name = policy.holder_name[:1] + "***"
            # 金额区间化
            policy.coverage_amount = self._mask_decimal_range(policy.coverage_amount)
        
        return policy
    
    def _mask_decimal_range(self, value: Decimal) -> Decimal:
        abs_value = abs(value)
        if abs_value == 0:
            step = Decimal("10")
        else:
            step_exp = max(abs_value.adjusted() - 1, 1)
            step = Decimal(10) ** step_exp
        return (value // step) * step


policy_service = PolicyService()
