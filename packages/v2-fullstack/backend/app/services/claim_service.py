"""
Claim Service

职责:
- 理赔CRUD
- 统计查询 (用于L0/L1数据产品)
- Mode裁剪 (敏感字段/金额)

Reference:
- docs/v2/v2实施细则/30-理赔表与Claim-Service-细则.md

硬规则:
- predicted不生成claims
- Mode裁剪敏感字段
"""

import logging
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim as ClaimModel
from app.schemas.claim import Claim, ClaimCreate, ClaimFilter, ClaimStats
from app.schemas.shared import AccessMode

logger = logging.getLogger(__name__)


class ClaimService:
    """理赔服务"""
    
    async def get_by_id(
        self,
        session: AsyncSession,
        claim_id: str,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> Optional[Claim]:
        """获取理赔详情"""
        result = await session.execute(
            select(ClaimModel).where(ClaimModel.id == claim_id)
        )
        model = result.scalar_one_or_none()
        
        if not model:
            return None
        
        claim = self._model_to_schema(model)
        return self._apply_mode_pruning(claim, access_mode)
    
    async def list_by_policy(
        self,
        session: AsyncSession,
        policy_id: str,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> List[Claim]:
        """按保单查询理赔"""
        result = await session.execute(
            select(ClaimModel)
            .where(ClaimModel.policy_id == policy_id)
            .order_by(ClaimModel.triggered_at.desc())
        )
        models = list(result.scalars().all())
        
        return [
            self._apply_mode_pruning(self._model_to_schema(m), access_mode)
            for m in models
        ]
    
    async def list_by_filter(
        self,
        session: AsyncSession,
        filter: ClaimFilter,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> List[Claim]:
        """按条件查询理赔"""
        query = select(ClaimModel)
        
        if filter.policy_id:
            query = query.where(ClaimModel.policy_id == filter.policy_id)
        if filter.product_id:
            query = query.where(ClaimModel.product_id == filter.product_id)
        if filter.region_code:
            query = query.where(ClaimModel.region_code == filter.region_code)
        if filter.status:
            query = query.where(ClaimModel.status == filter.status)
        if filter.tier_level:
            query = query.where(ClaimModel.tier_level == filter.tier_level)
        if filter.start_time:
            query = query.where(ClaimModel.triggered_at >= filter.start_time)
        if filter.end_time:
            query = query.where(ClaimModel.triggered_at <= filter.end_time)
        
        query = query.order_by(ClaimModel.triggered_at.desc()).limit(filter.limit)
        
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
    ) -> ClaimStats:
        """获取理赔统计"""
        query = select(
            func.count(ClaimModel.id).label("count"),
            func.sum(ClaimModel.payout_amount).label("total_amount")
        ).where(ClaimModel.status != "voided")
        
        if region_code:
            query = query.where(ClaimModel.region_code == region_code)
        if product_id:
            query = query.where(ClaimModel.product_id == product_id)
        
        result = await session.execute(query)
        row = result.first()
        
        stats = ClaimStats(
            claim_count=row.count or 0,
            payout_amount_sum=row.total_amount
        )
        
        # Mode裁剪
        if access_mode == AccessMode.DEMO_PUBLIC:
            stats.payout_amount_sum = None  # 不返回精确总额
        
        return stats
    
    def _model_to_schema(self, model: ClaimModel) -> Claim:
        """转换模型到Schema"""
        return Claim(
            id=model.id,
            policy_id=model.policy_id,
            product_id=model.product_id,
            risk_event_id=model.risk_event_id,
            region_code=model.region_code,
            tier_level=model.tier_level,
            payout_percentage=model.payout_percentage,
            payout_amount=model.payout_amount,
            currency=model.currency,
            triggered_at=model.triggered_at,
            period_start=model.period_start,
            period_end=model.period_end,
            status=model.status,
            product_version=model.product_version,
            rules_hash=model.rules_hash,
            source=model.source,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
    
    def _apply_mode_pruning(self, claim: Claim, mode: AccessMode) -> Claim:
        """应用Mode裁剪"""
        if mode == AccessMode.DEMO_PUBLIC:
            # 脱敏policy_id (摘要化)
            if claim.policy_id:
                claim.policy_id = claim.policy_id[:8] + "***"
            
            # 金额区间化 (简化为万元档)
            if claim.payout_amount:
                amount = float(claim.payout_amount)
                lower = (amount // 10000) * 10000
                claim.payout_amount = Decimal(str(lower))
        
        return claim


claim_service = ClaimService()
