"""
L2 Evidence Service

职责:
- 组装风险事件、理赔、天气证据
- Mode裁剪敏感字段
- 按需加载(不预取)

Reference:
- docs/v2/v2实施细则/33-L2-Evidence数据产品-细则.md
"""

import hashlib
import json
import logging
from datetime import timedelta
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim as ClaimModel
from app.schemas.l2_evidence import (
    L2Claim,
    L2EvidenceRequest,
    L2EvidenceMeta,
    L2EvidenceResponse,
    L2RiskEvent,
    L2Summary,
    L2WeatherEvidence,
)
from app.schemas.shared import AccessMode, DataType
from app.schemas.weather import WeatherQueryRequest
from app.services.risk_service import risk_service
from app.services.product_service import product_service
from app.services.weather_service import weather_service
from app.utils.access_control import AccessControlManager
from app.schemas.access_control import DataProductType
from app.utils.time_utils import get_timezone_for_region

logger = logging.getLogger(__name__)


class L2EvidenceService:
    """L2证据链服务"""
    
    async def get_evidence(
        self,
        session: AsyncSession,
        request: L2EvidenceRequest,
    ) -> L2EvidenceResponse:
        """获取证据链"""
        access_mode = request.access_mode
        manager = AccessControlManager(
            mode=access_mode,
            data_product=DataProductType.L2_EVIDENCE,
        )

        # 查询风险事件
        risk_events = await self._query_risk_events(session, request)

        # 查询理赔 (只查historical)
        claims: List[L2Claim] = []
        if request.data_type == DataType.HISTORICAL:
            claims = await self._query_claims(session, request)

        # 计算摘要
        summary = self._build_summary(risk_events, claims, access_mode)

        # Mode裁剪/粒度控制
        if manager.should_force_aggregation() and not manager.should_allow_detail():
            pruned_risk_events: List[L2RiskEvent] = []
            pruned_claims: List[L2Claim] = []
            weather_evidence: List[L2WeatherEvidence] = []
        else:
            pruned_risk_events = [
                self._prune_risk_event(e, access_mode) for e in risk_events
            ]
            pruned_claims = [
                self._prune_claim(c, access_mode) for c in claims
            ]
            weather_evidence = await self._build_weather_evidence(
                session,
                request,
                risk_events,
                claims,
            )

        meta = await self._build_meta(session, request)
        return L2EvidenceResponse(
            meta=meta,
            summary=summary,
            risk_events=pruned_risk_events,
            claims=pruned_claims,
            weather_evidence=weather_evidence,
            map_ref={"region_code": request.region_code},
            timeline_ref={
                "start": request.time_range.start,
                "end": request.time_range.end,
                "focus_type": request.focus_type,
                "focus_id": request.focus_id,
            },
        )
    
    async def _query_risk_events(
        self,
        session: AsyncSession,
        request: L2EvidenceRequest
    ) -> List[L2RiskEvent]:
        """查询风险事件"""
        if request.focus_type == "risk_event" and request.focus_id:
            event = await risk_service.get_by_id(session, request.focus_id)
            if not event:
                return []
            events = [event]
        else:
            events = await risk_service.query_events(
                session,
                region_code=request.region_code,
                weather_type=request.weather_type,
                data_type=request.data_type,
                time_range_start=request.time_range.start,
                time_range_end=request.time_range.end,
                prediction_run_id=request.prediction_run_id,
                product_id=request.product_id,
            )

        offset = request.cursor or 0
        limit = request.page_size
        events = events[offset: offset + limit]

        return [
            L2RiskEvent(
                id=e.id,
                timestamp=e.timestamp,
                tier_level=e.tier_level,
                trigger_value=e.trigger_value,
                threshold_value=e.threshold_value,
                weather_type=e.weather_type,
                data_type=e.data_type,
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
        if request.focus_type == "claim" and request.focus_id:
            query = select(ClaimModel).where(ClaimModel.id == request.focus_id)
        else:
            query = select(ClaimModel).where(
                ClaimModel.region_code == request.region_code,
                ClaimModel.triggered_at >= request.time_range.start,
                ClaimModel.triggered_at <= request.time_range.end,
            )
        
        if request.product_id:
            query = query.where(ClaimModel.product_id == request.product_id)

        offset = request.cursor or 0
        limit = request.page_size
        query = query.order_by(ClaimModel.triggered_at).offset(offset).limit(limit)

        result = await session.execute(query)
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

    async def _build_weather_evidence(
        self,
        session: AsyncSession,
        request: L2EvidenceRequest,
        risk_events: List[L2RiskEvent],
        claims: List[L2Claim],
    ) -> List[L2WeatherEvidence]:
        anchor = self._resolve_anchor_time(request, risk_events, claims)
        if not anchor:
            return []

        start_time = anchor - timedelta(hours=3)
        end_time = anchor + timedelta(hours=3)
        weather_request = WeatherQueryRequest(
            region_code=request.region_code,
            weather_type=request.weather_type,
            start_time=start_time,
            end_time=end_time,
            data_type=request.data_type,
            prediction_run_id=request.prediction_run_id,
        )
        weather_points = await weather_service.query_time_series(session, weather_request)
        return [
            L2WeatherEvidence(
                timestamp=point.timestamp,
                value=point.value,
                unit=point.unit,
                weather_type=point.weather_type,
            )
            for point in weather_points
        ]

    def _resolve_anchor_time(
        self,
        request: L2EvidenceRequest,
        risk_events: List[L2RiskEvent],
        claims: List[L2Claim],
    ) -> Optional[datetime]:
        if request.focus_type == "risk_event" and request.focus_id:
            for event in risk_events:
                if event.id == request.focus_id:
                    return event.timestamp
        if request.focus_type == "claim" and request.focus_id:
            for claim in claims:
                if claim.id == request.focus_id:
                    return claim.triggered_at
        if request.focus_type == "time_cursor" and request.cursor_time_utc:
            return request.cursor_time_utc
        if risk_events:
            return risk_events[0].timestamp
        if claims:
            return claims[0].triggered_at
        return None

    async def _build_meta(
        self,
        session: AsyncSession,
        request: L2EvidenceRequest,
    ) -> L2EvidenceMeta:
        product_version = None
        rules_hash = None
        if request.product_id:
            product = await product_service.get_by_id(
                session,
                request.product_id,
                access_mode=AccessMode.ADMIN_INTERNAL,
            )
            if product:
                product_version = product.version
                payload = product.risk_rules.model_dump()
                serialized = json.dumps(payload, sort_keys=True, default=str)
                rules_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        region_timezone = get_timezone_for_region(request.region_code)
        time_range = request.time_range
        if time_range and not time_range.region_timezone:
            time_range = time_range.model_copy(
                update={"region_timezone": region_timezone}
            )

        return L2EvidenceMeta(
            region_scope=request.region_scope,
            region_code=request.region_code,
            time_range=time_range,
            data_type=request.data_type,
            weather_type=request.weather_type,
            access_mode=request.access_mode,
            product_id=request.product_id,
            prediction_run_id=request.prediction_run_id,
            region_timezone=region_timezone,
            product_version=product_version,
            rules_hash=rules_hash,
            calculation_range=None,
        )


l2_evidence_service = L2EvidenceService()
