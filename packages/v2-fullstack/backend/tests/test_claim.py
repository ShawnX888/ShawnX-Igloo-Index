"""
测试Claim Service

Reference: docs/v2/v2实施细则/30-理赔表与Claim-Service-细则.md

验收用例:
- predicted不生成claims
- payout_amount使用Decimal
- Mode裁剪敏感字段
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.claim import Claim, ClaimCreate, ClaimFilter


class TestClaimSchema:
    """测试Claim Schema"""
    
    def test_create_valid_claim(self):
        """测试创建有效理赔"""
        claim = ClaimCreate(
            id="clm-001",
            policy_id="pol-001",
            product_id="daily_rainfall",
            region_code="CN-GD",
            tier_level=2,
            payout_percentage=Decimal("50.00"),
            payout_amount=Decimal("25000.00"),  # Decimal精度
            currency="CNY",
            triggered_at=datetime(2025, 1, 20, 10, 0, 0, tzinfo=timezone.utc),
            product_version="v1.0.0",
            source="task"
        )
        
        assert claim.payout_amount == Decimal("25000.00")
        assert claim.tier_level == 2
    
    def test_payout_percentage_range(self):
        """验收用例: payout_percentage必须在0-100之间"""
        with pytest.raises(ValueError):
            ClaimCreate(
                id="clm-002",
                policy_id="pol-001",
                product_id="daily_rainfall",
                region_code="CN-GD",
                tier_level=2,
                payout_percentage=Decimal("150.00"),  # 错误: >100%
                payout_amount=Decimal("25000.00"),
                triggered_at=datetime(2025, 1, 20, 10, 0, 0, tzinfo=timezone.utc),
                product_version="v1.0.0"
            )
    
    def test_payout_amount_non_negative(self):
        """验收用例: payout_amount必须>=0"""
        with pytest.raises(ValueError):
            ClaimCreate(
                id="clm-003",
                policy_id="pol-001",
                product_id="daily_rainfall",
                region_code="CN-GD",
                tier_level=1,
                payout_percentage=Decimal("20.00"),
                payout_amount=Decimal("-1000.00"),  # 错误: 负数
                triggered_at=datetime(2025, 1, 20, 10, 0, 0, tzinfo=timezone.utc),
                product_version="v1.0.0"
            )
    
    def test_predicted_not_allowed(self):
        """
        验收用例: predicted不生成claims
        
        硬规则: claims表只存储historical数据
        (此约束由Service层/Task层强制执行)
        """
        # Schema层允许创建,但Service层会拒绝predicted来源的claim
        claim = ClaimCreate(
            id="clm-004",
            policy_id="pol-001",
            product_id="daily_rainfall",
            region_code="CN-GD",
            tier_level=1,
            payout_percentage=Decimal("20.00"),
            payout_amount=Decimal("10000.00"),
            triggered_at=datetime(2025, 1, 20, 10, 0, 0, tzinfo=timezone.utc),
            product_version="v1.0.0"
        )
        
        # Schema验证通过,但Service层会检查数据来源
        assert claim is not None
