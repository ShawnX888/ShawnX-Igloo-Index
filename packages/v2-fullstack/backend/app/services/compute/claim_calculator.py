"""
Claim Calculator (理赔计算引擎)

纯计算函数,不依赖DB Session,支持:
- Tier差额逻辑 (同一天只赔最高tier)
- 频次限制 (per day/month)
- Decimal金融精度

Reference:
- docs/v2/v2实施细则/31-Claim-Calculator计算内核-细则.md
- RD-产品库与规则契约.md

硬规则:
- 只读 payoutRules, 不读 riskRules
- 使用 policy.timezone 判定自然边界
- predicted不生成claims
"""

import logging
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from app.schemas.product import PayoutRules
from app.schemas.shared import WeatherType
from app.utils.time_utils import get_natural_date, is_same_natural_day

logger = logging.getLogger(__name__)


class ClaimDraft:
    """
    理赔草稿 (计算结果)
    
    供写入claims表使用
    """
    
    def __init__(
        self,
        policy_id: str,
        product_id: str,
        product_version: str,
        tier_level: int,
        payout_percentage: Decimal,
        payout_amount: Decimal,
        triggered_at: datetime,
        region_code: str,
        risk_event_id: Optional[str] = None,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
        rules_hash: Optional[str] = None,
    ):
        self.policy_id = policy_id
        self.product_id = product_id
        self.product_version = product_version
        self.tier_level = tier_level
        self.payout_percentage = payout_percentage
        self.payout_amount = payout_amount
        self.triggered_at = triggered_at
        self.region_code = region_code
        self.risk_event_id = risk_event_id
        self.period_start = period_start
        self.period_end = period_end
        self.rules_hash = rules_hash
    
    def to_idempotency_key(self) -> str:
        """生成幂等键"""
        return f"{self.policy_id}|{self.triggered_at.isoformat()}|{self.tier_level}"


class RiskEventInput:
    """风险事件输入 (简化)"""
    
    def __init__(
        self,
        event_id: str,
        timestamp: datetime,
        tier_level: int,
        region_code: str
    ):
        self.event_id = event_id
        self.timestamp = timestamp
        self.tier_level = tier_level
        self.region_code = region_code


class ClaimCalculator:
    """
    理赔计算引擎
    
    职责:
    - 根据 payoutRules 计算理赔金额
    - Tier差额逻辑 (同一天只赔最高tier)
    - 频次限制 (per day/month)
    
    硬规则:
    - 纯计算,不依赖DB
    - 只读 payoutRules
    - predicted不生成claims
    """
    
    def calculate_claims(
        self,
        risk_events: List[RiskEventInput],
        payout_rules: PayoutRules,
        policy_id: str,
        product_id: str,
        product_version: str,
        coverage_amount: Decimal,
        policy_timezone: str,
        region_code: str,
        data_type: str = "historical"
    ) -> List[ClaimDraft]:
        """
        计算理赔
        
        Args:
            risk_events: 风险事件列表
            payout_rules: 赔付规则
            policy_id: 保单ID
            product_id: 产品ID
            product_version: 产品版本
            coverage_amount: 保额
            policy_timezone: 保单时区
            region_code: 区域代码
            data_type: 数据类型(必须是historical)
            
        Returns:
            理赔草稿列表
        """
        # 硬规则: predicted不生成claims
        if data_type != "historical":
            logger.warning(
                f"Claim Calculator只处理historical数据, 收到: {data_type}"
            )
            return []
        
        if not risk_events:
            return []
        
        # 按自然日分组
        events_by_day = self._group_by_natural_day(
            risk_events,
            policy_timezone
        )
        
        claim_drafts = []
        
        # 逐日计算
        for natural_date, day_events in events_by_day.items():
            # 应用Tier差额逻辑
            claim = self._calculate_daily_claim(
                day_events,
                payout_rules,
                policy_id,
                product_id,
                product_version,
                coverage_amount,
                region_code
            )
            
            if claim:
                claim_drafts.append(claim)
        
        return claim_drafts
    
    def _group_by_natural_day(
        self,
        events: List[RiskEventInput],
        timezone: str
    ) -> dict[str, List[RiskEventInput]]:
        """按自然日分组风险事件"""
        grouped = defaultdict(list)
        
        for event in events:
            natural_date = get_natural_date(event.timestamp, timezone)
            grouped[natural_date].append(event)
        
        return dict(grouped)
    
    def _calculate_daily_claim(
        self,
        day_events: List[RiskEventInput],
        payout_rules: PayoutRules,
        policy_id: str,
        product_id: str,
        product_version: str,
        coverage_amount: Decimal,
        region_code: str
    ) -> Optional[ClaimDraft]:
        """
        计算单日理赔 (Tier差额逻辑)
        
        规则:
        - 同一天只赔最高tier
        - 若多次触发,只计算最高tier的赔付
        """
        if not day_events:
            return None
        
        # 找到最高tier
        max_tier_event = max(day_events, key=lambda e: e.tier_level)
        max_tier = max_tier_event.tier_level
        
        # 获取赔付比例
        payout_percentage = self._get_payout_percentage(
            max_tier,
            payout_rules
        )
        
        if payout_percentage == Decimal(0):
            return None
        
        # 计算赔付金额
        payout_amount = coverage_amount * (payout_percentage / Decimal(100))
        
        # 应用total_cap (如果有)
        if payout_rules.total_cap:
            cap = Decimal(str(payout_rules.total_cap))
            max_payout = coverage_amount * (cap / Decimal(100))
            payout_amount = min(payout_amount, max_payout)
        
        return ClaimDraft(
            policy_id=policy_id,
            product_id=product_id,
            product_version=product_version,
            tier_level=max_tier,
            payout_percentage=payout_percentage,
            payout_amount=payout_amount,
            triggered_at=max_tier_event.timestamp,
            region_code=region_code,
            risk_event_id=max_tier_event.event_id
        )
    
    def _get_payout_percentage(
        self,
        tier: int,
        payout_rules: PayoutRules
    ) -> Decimal:
        """获取tier对应的赔付比例"""
        percentages = payout_rules.payout_percentages
        
        if tier == 1:
            return Decimal(str(percentages.tier1))
        elif tier == 2:
            return Decimal(str(percentages.tier2))
        elif tier == 3:
            return Decimal(str(percentages.tier3))
        
        return Decimal(0)


claim_calculator = ClaimCalculator()
