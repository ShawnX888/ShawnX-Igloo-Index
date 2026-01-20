"""
Unit Tests for Access Control

Access Control 单元测试
"""

import pytest
from decimal import Decimal
from datetime import datetime

from app.schemas.shared import (
    AccessMode,
    DataType,
    TierLevel,
    ClaimEvent,
    RankingItem,
)
from app.core.access_control import (
    prune_response,
    prune_list,
    limit_ranking,
    should_include_field,
)


# ============================================================================
# ClaimEvent 裁剪测试
# ============================================================================


def test_prune_claim_event_demo():
    """Demo 模式裁剪测试"""
    claim = ClaimEvent(
        id="claim-1",
        timestamp=datetime(2025, 1, 20, 0, 0, 0),
        region_code="CN-11-0101",
        data_type=DataType.HISTORICAL,
        claim_number="CLM-2025-001234",
        policy_id="POL-001",
        tier_level=TierLevel.TIER1,
        payout_percentage=Decimal("20.00"),
        payout_amount=Decimal("50000.00"),
        status="approved"
    )
    
    pruned = prune_response(claim, AccessMode.DEMO)
    
    # Demo 模式：金额裁剪
    assert pruned.payout_amount is None
    
    # Demo 模式：理赔单号脱敏
    assert pruned.claim_number == "CLM-****-**234"
    
    # 其他字段保留
    assert pruned.payout_percentage == Decimal("20.00")
    assert pruned.policy_id == "POL-001"


def test_prune_claim_event_partner():
    """Partner 模式裁剪测试"""
    claim = ClaimEvent(
        id="claim-1",
        timestamp=datetime(2025, 1, 20, 0, 0, 0),
        region_code="CN-11-0101",
        data_type=DataType.HISTORICAL,
        claim_number="CLM-2025-001234",
        policy_id="POL-001",
        tier_level=TierLevel.TIER1,
        payout_percentage=Decimal("20.00"),
        payout_amount=Decimal("50000.00"),
        status="approved"
    )
    
    pruned = prune_response(claim, AccessMode.PARTNER)
    
    # Partner 模式：金额范围化
    assert pruned.payout_amount == "0-100K"
    
    # Partner 模式：理赔单号不脱敏
    assert pruned.claim_number == "CLM-2025-001234"


def test_prune_claim_event_admin():
    """Admin 模式不裁剪测试"""
    claim = ClaimEvent(
        id="claim-1",
        timestamp=datetime(2025, 1, 20, 0, 0, 0),
        region_code="CN-11-0101",
        data_type=DataType.HISTORICAL,
        claim_number="CLM-2025-001234",
        policy_id="POL-001",
        tier_level=TierLevel.TIER1,
        payout_percentage=Decimal("20.00"),
        payout_amount=Decimal("50000.00"),
        status="approved"
    )
    
    pruned = prune_response(claim, AccessMode.ADMIN)
    
    # Admin 模式：完全不裁剪
    assert pruned.payout_amount == Decimal("50000.00")
    assert pruned.claim_number == "CLM-2025-001234"


# ============================================================================
# 批量裁剪测试
# ============================================================================


def test_prune_list():
    """批量裁剪测试"""
    claims = [
        ClaimEvent(
            id=f"claim-{i}",
            timestamp=datetime(2025, 1, 20, 0, 0, 0),
            region_code="CN-11-0101",
            data_type=DataType.HISTORICAL,
            claim_number=f"CLM-2025-{i:06d}",
            policy_id="POL-001",
            tier_level=TierLevel.TIER1,
            payout_percentage=Decimal("20.00"),
            payout_amount=Decimal("50000.00"),
            status="approved"
        )
        for i in range(3)
    ]
    
    pruned_list = prune_list(claims, AccessMode.DEMO)
    
    assert len(pruned_list) == 3
    
    for pruned in pruned_list:
        assert pruned.payout_amount is None


# ============================================================================
# 排名限制测试
# ============================================================================


def test_limit_ranking_demo():
    """Demo 模式排名限制测试"""
    rankings = [
        RankingItem(
            rank=i + 1,
            entity_id=f"region-{i}",
            entity_name=f"Region {i}",
            value=Decimal(1000 - i * 100)
        )
        for i in range(20)
    ]
    
    limited = limit_ranking(rankings, AccessMode.DEMO)
    
    # Demo 模式：限制为 Top5
    assert len(limited) == 5


def test_limit_ranking_partner():
    """Partner 模式排名限制测试"""
    rankings = [
        RankingItem(
            rank=i + 1,
            entity_id=f"region-{i}",
            entity_name=f"Region {i}",
            value=Decimal(1000 - i * 100)
        )
        for i in range(30)
    ]
    
    limited = limit_ranking(rankings, AccessMode.PARTNER)
    
    # Partner 模式：限制为 Top20
    assert len(limited) == 20


def test_limit_ranking_admin():
    """Admin 模式排名不限制测试"""
    rankings = [
        RankingItem(
            rank=i + 1,
            entity_id=f"region-{i}",
            entity_name=f"Region {i}",
            value=Decimal(1000 - i * 100)
        )
        for i in range(30)
    ]
    
    limited = limit_ranking(rankings, AccessMode.ADMIN)
    
    # Admin 模式：不限制
    assert len(limited) == 30


# ============================================================================
# 字段包含判断测试
# ============================================================================


def test_should_include_field():
    """字段包含判断测试"""
    admin_only = ["debug_info", "internal_ref"]
    partner_plus = ["detailed_stats"]
    
    # Demo 模式
    assert should_include_field(
        "basic_info", AccessMode.DEMO, admin_only, partner_plus
    )
    assert not should_include_field(
        "debug_info", AccessMode.DEMO, admin_only, partner_plus
    )
    assert not should_include_field(
        "detailed_stats", AccessMode.DEMO, admin_only, partner_plus
    )
    
    # Partner 模式
    assert should_include_field(
        "detailed_stats", AccessMode.PARTNER, admin_only, partner_plus
    )
    assert not should_include_field(
        "debug_info", AccessMode.PARTNER, admin_only, partner_plus
    )
    
    # Admin 模式
    assert should_include_field(
        "debug_info", AccessMode.ADMIN, admin_only, partner_plus
    )
    assert should_include_field(
        "detailed_stats", AccessMode.ADMIN, admin_only, partner_plus
    )


# ============================================================================
# 边界情况测试
# ============================================================================


def test_prune_empty_list():
    """空列表裁剪测试"""
    result = prune_list([], AccessMode.DEMO)
    assert result == []


def test_prune_none_value():
    """None值裁剪测试"""
    claim = ClaimEvent(
        id="claim-1",
        timestamp=datetime(2025, 1, 20, 0, 0, 0),
        region_code="CN-11-0101",
        data_type=DataType.HISTORICAL,
        claim_number="CLM-2025-001234",
        policy_id="POL-001",
        tier_level=TierLevel.TIER1,
        payout_percentage=Decimal("20.00"),
        payout_amount=None,  # 已经是 None
        status="approved"
    )
    
    pruned = prune_response(claim, AccessMode.DEMO)
    
    # None 值应该保持 None
    assert pruned.payout_amount is None
