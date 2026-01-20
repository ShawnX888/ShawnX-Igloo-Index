"""
测试Claim Calculator

验收用例:
- 只读 payoutRules, 不读 riskRules
- Tier差额逻辑 (同一天只赔最高tier)
- Decimal金融精度
- predicted不生成claims

Reference: docs/v2/v2实施细则/31-Claim-Calculator计算内核-细则.md
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.product import PayoutPercentages, PayoutRules
from app.services.compute.claim_calculator import (
    ClaimCalculator, 
    RiskEventInput
)


class TestClaimCalculator:
    """测试理赔计算引擎"""
    
    def test_single_tier_claim(self):
        """测试单次触发理赔计算"""
        calculator = ClaimCalculator()
        
        # 准备风险事件
        events = [
            RiskEventInput(
                event_id="evt-001",
                timestamp=datetime(2025, 1, 20, 10, 0, tzinfo=timezone.utc),
                tier_level=2,
                region_code="CN-GD"
            )
        ]
        
        # 定义赔付规则(只使用payoutRules)
        payout_rules = PayoutRules(
            frequency_limit="once_per_day_per_policy",
            payout_percentages=PayoutPercentages(
                tier1=Decimal("20.0"),
                tier2=Decimal("50.0"),
                tier3=Decimal("100.0")
            ),
            total_cap=Decimal("100.0")
        )
        
        # 计算理赔
        claims = calculator.calculate_claims(
            risk_events=events,
            payout_rules=payout_rules,
            policy_id="pol-001",
            product_id="daily_rainfall",
            product_version="v1.0.0",
            coverage_amount=Decimal("50000.00"),
            policy_timezone="Asia/Shanghai",
            region_code="CN-GD",
            data_type="historical"
        )
        
        assert len(claims) == 1
        assert claims[0].tier_level == 2
        assert claims[0].payout_percentage == Decimal("50.0")
        # 50000 * 50% = 25000
        assert claims[0].payout_amount == Decimal("25000.00")
    
    def test_tier_differential_logic(self):
        """
        验收用例: Tier差额逻辑
        
        同一天触发tier1和tier2,只赔最高tier(tier2)
        """
        calculator = ClaimCalculator()
        
        # 同一天触发tier1和tier2
        events = [
            RiskEventInput(
                event_id="evt-001",
                timestamp=datetime(2025, 1, 20, 8, 0, tzinfo=timezone.utc),  # 16:00北京时间
                tier_level=1,
                region_code="CN-GD"
            ),
            RiskEventInput(
                event_id="evt-002",
                timestamp=datetime(2025, 1, 20, 12, 0, tzinfo=timezone.utc), # 20:00北京时间
                tier_level=2,
                region_code="CN-GD"
            )
        ]
        
        payout_rules = PayoutRules(
            frequency_limit="once_per_day_per_policy",
            payout_percentages=PayoutPercentages(
                tier1=Decimal("20.0"),
                tier2=Decimal("50.0"),
                tier3=Decimal("100.0")
            ),
            total_cap=Decimal("100.0")
        )
        
        claims = calculator.calculate_claims(
            risk_events=events,
            payout_rules=payout_rules,
            policy_id="pol-001",
            product_id="daily_rainfall",
            product_version="v1.0.0",
            coverage_amount=Decimal("50000.00"),
            policy_timezone="Asia/Shanghai",
            region_code="CN-GD",
            data_type="historical"
        )
        
        # 只生成1个claim (同一天)
        assert len(claims) == 1
        # 只赔最高tier
        assert claims[0].tier_level == 2
        assert claims[0].payout_percentage == Decimal("50.0")
    
    def test_decimal_precision(self):
        """验收用例: Decimal金融精度(不使用float)"""
        calculator = ClaimCalculator()
        
        events = [
            RiskEventInput(
                event_id="evt-001",
                timestamp=datetime(2025, 1, 20, 10, 0, tzinfo=timezone.utc),
                tier_level=2,
                region_code="CN-GD"
            )
        ]
        
        payout_rules = PayoutRules(
            frequency_limit="once_per_day_per_policy",
            payout_percentages=PayoutPercentages(
                tier1=Decimal("20.0"),
                tier2=Decimal("50.0"),
                tier3=Decimal("100.0")
            ),
            total_cap=Decimal("100.0")
        )
        
        # 使用精确保额测试
        claims = calculator.calculate_claims(
            risk_events=events,
            payout_rules=payout_rules,
            policy_id="pol-001",
            product_id="daily_rainfall",
            product_version="v1.0.0",
            coverage_amount=Decimal("33333.33"),  # 精确小数
            policy_timezone="Asia/Shanghai",
            region_code="CN-GD",
            data_type="historical"
        )
        
        assert len(claims) == 1
        # 33333.33 * 50% = 16666.665, 应该保持Decimal精度
        assert claims[0].payout_amount == Decimal("33333.33") * Decimal("0.5")
        assert isinstance(claims[0].payout_amount, Decimal)
    
    def test_predicted_not_generate_claims(self):
        """
        验收用例: predicted不生成claims
        
        硬规则: data_type=predicted时返回空列表
        """
        calculator = ClaimCalculator()
        
        events = [
            RiskEventInput(
                event_id="evt-001",
                timestamp=datetime(2025, 1, 20, 10, 0, tzinfo=timezone.utc),
                tier_level=2,
                region_code="CN-GD"
            )
        ]
        
        payout_rules = PayoutRules(
            frequency_limit="once_per_day_per_policy",
            payout_percentages=PayoutPercentages(
                tier1=Decimal("20.0"),
                tier2=Decimal("50.0"),
                tier3=Decimal("100.0")
            ),
            total_cap=Decimal("100.0")
        )
        
        # data_type=predicted应该返回空
        claims = calculator.calculate_claims(
            risk_events=events,
            payout_rules=payout_rules,
            policy_id="pol-001",
            product_id="daily_rainfall",
            product_version="v1.0.0",
            coverage_amount=Decimal("50000.00"),
            policy_timezone="Asia/Shanghai",
            region_code="CN-GD",
            data_type="predicted"  # predicted!
        )
        
        # 不生成claims
        assert len(claims) == 0
    
    def test_total_cap_enforcement(self):
        """验收用例: total_cap上限强制执行"""
        calculator = ClaimCalculator()
        
        events = [
            RiskEventInput(
                event_id="evt-001",
                timestamp=datetime(2025, 1, 20, 10, 0, tzinfo=timezone.utc),
                tier_level=3,  # tier3=100%
                region_code="CN-GD"
            )
        ]
        
        payout_rules = PayoutRules(
            frequency_limit="once_per_day_per_policy",
            payout_percentages=PayoutPercentages(
                tier1=Decimal("20.0"),
                tier2=Decimal("50.0"),
                tier3=Decimal("100.0")
            ),
            total_cap=Decimal("100.0")  # 总上限100%
        )
        
        claims = calculator.calculate_claims(
            risk_events=events,
            payout_rules=payout_rules,
            policy_id="pol-001",
            product_id="daily_rainfall",
            product_version="v1.0.0",
            coverage_amount=Decimal("50000.00"),
            policy_timezone="Asia/Shanghai",
            region_code="CN-GD",
            data_type="historical"
        )
        
        assert len(claims) == 1
        # tier3=100%, 但total_cap=100%, 所以赔付100%
        assert claims[0].payout_amount <= Decimal("50000.00")
        assert claims[0].payout_amount == Decimal("50000.00")  # 100% * 50000
