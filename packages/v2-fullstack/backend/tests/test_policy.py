"""
测试Policy Service

Reference: docs/v2/v2实施细则/06-保单表与Policy-Service-细则.md
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.policy import Policy, PolicyCreate


class TestPolicySchema:
    """测试Policy Schema"""
    
    def test_create_valid_policy(self):
        """测试创建有效保单"""
        policy = PolicyCreate(
            id="pol-001",
            policy_number="POL-2025-001",
            product_id="daily_rainfall",
            coverage_region="CN-GD",
            coverage_amount=Decimal("50000.00"),
            timezone="Asia/Shanghai",  # 必须
            coverage_start=datetime(2025, 1, 1, tzinfo=timezone.utc),
            coverage_end=datetime(2025, 12, 31, tzinfo=timezone.utc),
            holder_name="张三",
            is_active=True
        )
        
        assert policy.timezone == "Asia/Shanghai"
        assert policy.coverage_amount == Decimal("50000.00")
    
    def test_validate_coverage_end_after_start(self):
        """验收用例: coverage_end 必须晚于 coverage_start"""
        with pytest.raises(ValueError, match="coverage_end must be after"):
            PolicyCreate(
                id="pol-002",
                policy_number="POL-2025-002",
                product_id="daily_rainfall",
                coverage_region="CN-GD",
                coverage_amount=Decimal("50000.00"),
                timezone="Asia/Shanghai",
                coverage_start=datetime(2025, 12, 31, tzinfo=timezone.utc),
                coverage_end=datetime(2025, 1, 1, tzinfo=timezone.utc),  # 错误!
                is_active=True
            )
    
    def test_timezone_field_required(self):
        """验收用例: timezone 字段必须"""
        # Pydantic会自动验证必填字段
        with pytest.raises(ValueError):
            PolicyCreate(
                id="pol-003",
                policy_number="POL-2025-003",
                product_id="daily_rainfall",
                coverage_region="CN-GD",
                coverage_amount=Decimal("50000.00"),
                # timezone 缺失!
                coverage_start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                coverage_end=datetime(2025, 12, 31, tzinfo=timezone.utc),
                is_active=True
            )
