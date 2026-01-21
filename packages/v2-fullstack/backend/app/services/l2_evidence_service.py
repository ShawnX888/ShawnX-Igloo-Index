"""
L2 Evidence Service

职责:
- 组装风险事件、理赔、天气证据
- Mode裁剪敏感字段
- 按需加载(不预取)

Reference:
- docs/v2/v2实施细则/33-L2-Evidence数据产品-细则.md
"""

import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim as ClaimModel
from app.schemas.l2_evidence import (
    L2Claim,
    L2EvidenceRequest,
    L2EvidenceResponse,
    L2RiskEvent,
    L2Summary,
)
from app.schemas.shared import AccessMode, DataType
from app.services.risk_service import risk_service

logger = logging.getLogger(__name__)


class L2EvidenceService:
    """L2证据链服务"""
    
    async def get_evidence(
        self,
        session: AsyncSession,
        request: L2EvidenceRequest,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> L2EvidenceResponse:
        """获取证据链"""
        # 查询风险事件
        risk_events = await self._query_risk_events(session, request)
        
        # 查询理赔 (只查historical)
        claims = []
        if request.data_type == DataType.HISTORICAL:
            claims = await self._query_claims(session, request)
        
        # 计算摘要
        summary = self._build_summary(risk_events, claims, access_mode)
        
        # 应用Mode裁剪
        pruned_risk_events = [
            self._prune_risk_event(e, access_mode) for e in risk_events
        ]
        pruned_claims = [
            self._prune_claim(c, access_mode) for c in claims
        ]
        
        return L2EvidenceResponse(
            summary=summary,
            risk_events=pruned_risk_events,
            claims=pruned_claims,
            weather_evidence=[],  # TODO: 查询天气证据
            map_ref={"region_code": request.region_code},
            timeline_ref={"start": request.time_range_start, "end": request.time_range_end}
        )
    
    async def _query_risk_events(
        self,
        session: AsyncSession,
        request: L2EvidenceRequest
    ) -> List[L2RiskEvent]:
        """查询风险事件"""
        events = await risk_service.query_events(
            session,
            region_code=request.region_code,
            weather_type=request.weather_type,
            data_type=request.data_type,
            time_range_start=request.time_range_start,
            time_range_end=request.time_range_end,
            prediction_run_id=request.prediction_run_id,
            product_id=request.product_id,
        )

        return [
            L2RiskEvent(
                id=e.id,
                timestamp=e.timestamp,
                tier_level=e.tier_level,
                trigger_value=e.trigger_value,
                threshold_value=e.threshold_value,
                weather_type=e.weather_type.value,
                data_type=e.data_type.value,
                prediction_run_id=e.prediction_run_id,
            )
            for e in events
        ]
    
    async def _query_claims(
        self,
        session: AsyncSession,
        request: L2EvidenceRequest
    ) -> List[L2Claim]:
        """查询理赔 (只查historical)"""
        query = select(ClaimModel).where(
            ClaimModel.region_code == request.region_code,
            ClaimModel.triggered_at >= request.time_range_start,
            ClaimModel.triggered_at <= request.time_range_end
        )
        
        if request.product_id:
            query = query.where(ClaimModel.product_id == request.product_id)
        
        result = await session.execute(query.order_by(ClaimModel.triggered_at))
        models = list(result.scalars().all())
        
        return [
            L2Claim(
                id=m.id,
                policy_id=m.policy_id,
                tier_level=m.tier_level,
                payout_percentage=m.payout_percentage,
                payout_amount=m.payout_amount,
                triggered_at=m.triggered_at,
                status=m.status
            )
            for m in models
        ]
    
    def _build_summary(
        self,
        risk_events: List[L2RiskEvent],
        claims: List[L2Claim],
        access_mode: AccessMode
    ) -> L2Summary:
        """构建摘要"""
        total_payout = None
        if claims and access_mode != AccessMode.DEMO_PUBLIC:
            total_payout = sum(c.payout_amount for c in claims if c.payout_amount)
        
        max_tier = max((e.tier_level for e in risk_events), default=0)
        
        return L2Summary(
            risk_event_count=len(risk_events),
            claim_count=len(claims),
            total_payout=total_payout,
            max_tier=max_tier
        )
    
    def _prune_risk_event(
        self,
        event: L2RiskEvent,
        mode: AccessMode
    ) -> L2RiskEvent:
        """裁剪风险事件"""
        # Risk events通常不含敏感字段,暂不裁剪
        return event
    
    def _prune_claim(
        self,
        claim: L2Claim,
        mode: AccessMode
    ) -> L2Claim:
        """裁剪理赔"""
        if mode == AccessMode.DEMO_PUBLIC:
            # 脱敏policy_id
            claim.policy_id = claim.policy_id[:8] + "***"
            # 不返回精确金额
            claim.payout_amount = None
        
        return claim


l2_evidence_service = L2EvidenceService()
