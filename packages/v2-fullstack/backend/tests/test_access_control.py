"""
测试Access Mode裁剪基线的验收用例

Reference: docs/v2/v2实施细则/02-Access-Mode裁剪基线-细则.md
"""

from decimal import Decimal

import pytest

from app.schemas.access_control import (
    CapabilityPruningRule,
    DataProductType,
    FieldPruner,
    FieldPruningRule,
    GranularityPruningRule,
    ModePruningPolicy,
    PruningPolicyRegistry,
    UnauthorizedAccessStrategy,
)
from app.schemas.shared import AccessMode
from app.utils.access_control import (
    AccessControlManager,
    check_capability_permission,
    prune_response_data,
)


class TestFieldPruning:
    """测试字段级裁剪"""
    
    def test_field_allowlist(self):
        """测试字段白名单"""
        rule = FieldPruningRule(
            allowed_fields={"field1", "field2", "field3"}
        )
        
        assert rule.is_field_allowed("field1")
        assert rule.is_field_allowed("field2")
        assert not rule.is_field_allowed("sensitive_field")
    
    def test_prune_dict(self):
        """测试字典裁剪"""
        rule = FieldPruningRule(
            allowed_fields={"name", "age"}
        )
        
        data = {
            "name": "John",
            "age": 30,
            "ssn": "123-45-6789",  # 敏感字段
            "internal_id": "abc123"
        }
        
        pruned = FieldPruner.prune_dict(data, rule)
        
        assert "name" in pruned
        assert "age" in pruned
        assert "ssn" not in pruned
        assert "internal_id" not in pruned
    
    def test_prune_list(self):
        """测试列表裁剪"""
        rule = FieldPruningRule(
            allowed_fields={"name", "score"}
        )
        
        data = [
            {"name": "Alice", "score": 95, "email": "alice@example.com"},
            {"name": "Bob", "score": 87, "email": "bob@example.com"},
        ]
        
        pruned = FieldPruner.prune_list(data, rule)
        
        assert len(pruned) == 2
        assert "name" in pruned[0]
        assert "score" in pruned[0]
        assert "email" not in pruned[0]
    
    def test_field_masking_range(self):
        """测试字段脱敏: 区间化"""
        rule = FieldPruningRule(
            allowed_fields={"amount"},
            masked_fields={"amount": "range"}
        )
        
        data = {"amount": 12345}
        pruned = FieldPruner.prune_dict(data, rule)
        
        assert "amount" in pruned
        # 应该被转换为区间
        assert isinstance(pruned["amount"], str)
        assert "[" in pruned["amount"]
    
    def test_field_masking_range_decimal(self):
        """测试字段脱敏: 区间化(Decimal金额)"""
        rule = FieldPruningRule(
            allowed_fields={"amount"},
            masked_fields={"amount": "range"}
        )
        
        data = {"amount": Decimal("12345")}
        pruned = FieldPruner.prune_dict(data, rule)
        
        assert "amount" in pruned
        assert isinstance(pruned["amount"], str)
        assert "[" in pruned["amount"]
    
    def test_field_masking_mask(self):
        """测试字段脱敏: 字符串掩码"""
        rule = FieldPruningRule(
            allowed_fields={"phone"},
            masked_fields={"phone": "mask"}
        )
        
        data = {"phone": "13800138000"}
        pruned = FieldPruner.prune_dict(data, rule)
        
        assert "phone" in pruned
        assert "***" in pruned["phone"]
        assert len(pruned["phone"]) < len(data["phone"])


class TestCapabilityPruning:
    """测试能力级裁剪"""
    
    def test_capability_allowlist(self):
        """测试能力白名单"""
        rule = CapabilityPruningRule(
            allowed_capabilities={"view", "refresh"}
        )
        
        assert rule.is_capability_allowed("view")
        assert rule.is_capability_allowed("refresh")
        assert not rule.is_capability_allowed("export")
        assert not rule.is_capability_allowed("compare")


class TestGranularityPruning:
    """测试粒度级裁剪"""
    
    def test_force_aggregation(self):
        """测试强制聚合"""
        rule = GranularityPruningRule(
            allow_detail=False,
            force_aggregation=True,
            aggregation_level="summary"
        )
        
        assert not rule.allow_detail
        assert rule.force_aggregation
        assert rule.aggregation_level == "summary"


class TestPruningPolicyRegistry:
    """测试裁剪策略注册表"""
    
    def test_get_l0_demo_public_policy(self):
        """测试获取L0 Dashboard的Demo/Public策略"""
        policy = PruningPolicyRegistry.get_policy(
            AccessMode.DEMO_PUBLIC,
            DataProductType.L0_DASHBOARD
        )
        
        assert policy is not None
        assert policy.mode == AccessMode.DEMO_PUBLIC
        assert policy.data_product == DataProductType.L0_DASHBOARD
        
        # Demo/Public下应该不允许明细
        assert not policy.granularity_pruning.allow_detail
        
        # Demo/Public下应该不允许export
        assert not policy.capability_pruning.is_capability_allowed("export")
        
        # Demo/Public下金额字段必须允许输出，但会被强制区间化
        assert policy.field_pruning.is_field_allowed("policy_amount_total")
        assert policy.field_pruning.is_field_allowed("claim_amount_total")
        assert policy.field_pruning.should_mask_field("policy_amount_total") == "range"
        assert policy.field_pruning.should_mask_field("claim_amount_total") == "range"
    
    def test_get_l0_partner_policy(self):
        """测试获取L0 Dashboard的Partner策略"""
        policy = PruningPolicyRegistry.get_policy(
            AccessMode.PARTNER,
            DataProductType.L0_DASHBOARD
        )
        
        assert policy is not None
        assert policy.mode == AccessMode.PARTNER
        
        # Partner允许明细
        assert policy.granularity_pruning.allow_detail
        
        # Partner允许compare但不允许export
        assert policy.capability_pruning.is_capability_allowed("compare")
        assert not policy.capability_pruning.is_capability_allowed("export")
    
    def test_get_l0_admin_policy(self):
        """测试获取L0 Dashboard的Admin策略"""
        policy = PruningPolicyRegistry.get_policy(
            AccessMode.ADMIN_INTERNAL,
            DataProductType.L0_DASHBOARD
        )
        
        assert policy is not None
        assert policy.mode == AccessMode.ADMIN_INTERNAL
        
        # Admin允许明细
        assert policy.granularity_pruning.allow_detail
        
        # Admin允许所有能力
        assert policy.capability_pruning.is_capability_allowed("export")
        assert policy.capability_pruning.is_capability_allowed("compare")
        assert policy.capability_pruning.is_capability_allowed("configure")
    
    def test_get_l2_demo_public_policy(self):
        """测试获取L2 Evidence的Demo/Public策略"""
        policy = PruningPolicyRegistry.get_policy(
            AccessMode.DEMO_PUBLIC,
            DataProductType.L2_EVIDENCE
        )
        
        assert policy is not None
        assert policy.mode == AccessMode.DEMO_PUBLIC
        assert policy.data_product == DataProductType.L2_EVIDENCE
        
        # L2 Demo/Public: 完全不允许明细
        assert not policy.granularity_pruning.allow_detail
        assert policy.granularity_pruning.force_aggregation
        
        # L2 Demo/Public: 只允许view
        assert policy.capability_pruning.is_capability_allowed("view")
        assert not policy.capability_pruning.is_capability_allowed("refresh")
    
    def test_get_l2_partner_policy(self):
        """测试获取L2 Evidence的Partner策略"""
        policy = PruningPolicyRegistry.get_policy(
            AccessMode.PARTNER,
            DataProductType.L2_EVIDENCE
        )
        
        assert policy is not None
        
        # L2 Partner: 允许明细但字段脱敏
        assert policy.granularity_pruning.allow_detail
        assert policy.field_pruning.masked_fields is not None
    
    def test_get_policy_or_default(self):
        """测试获取策略(带默认策略回退)"""
        # 未定义的组合应该回退到最保守策略
        policy = PruningPolicyRegistry.get_policy_or_default(
            AccessMode.DEMO_PUBLIC,
            DataProductType.L1_REGION_INTELLIGENCE  # 未定义
        )
        
        assert policy is not None
        # 应该回退到严格策略
        assert not policy.granularity_pruning.allow_detail


class TestAccessControlManager:
    """测试Access Control管理器"""
    
    def test_prune_data_demo_public(self):
        """测试Demo/Public模式的数据裁剪"""
        manager = AccessControlManager(
            mode=AccessMode.DEMO_PUBLIC,
            data_product=DataProductType.L0_DASHBOARD
        )
        
        data = {
            "region_code": "CN-GD",
            "policy_count": 100,
            "policy_amount_total": 1000000,  # 敏感字段
            "internal_id": "abc123"  # 敏感字段
        }
        
        pruned_data, pruned_fields = manager.prune_data(data)
        
        assert "region_code" in pruned_data
        assert "policy_count" in pruned_data
        # policy_amount_total 应该被脱敏(转为区间)
        if "policy_amount_total" in pruned_data:
            assert isinstance(pruned_data["policy_amount_total"], str)
        # internal_id 不应该出现
        assert "internal_id" not in pruned_data
        
        # 记录了被裁剪的字段
        assert pruned_fields is not None
    
    def test_check_capability_allowed(self):
        """测试能力权限检查: 允许的能力"""
        manager = AccessControlManager(
            mode=AccessMode.DEMO_PUBLIC,
            data_product=DataProductType.L0_DASHBOARD
        )
        
        response = manager.check_capability("view")
        
        assert response.allowed
        assert response.mode == AccessMode.DEMO_PUBLIC
    
    def test_check_capability_denied(self):
        """测试能力权限检查: 拒绝的能力"""
        manager = AccessControlManager(
            mode=AccessMode.DEMO_PUBLIC,
            data_product=DataProductType.L0_DASHBOARD
        )
        
        response = manager.check_capability("export")
        
        assert not response.allowed
        assert response.strategy == UnauthorizedAccessStrategy.REJECT
        assert "not allowed" in response.reason.lower()
    
    def test_get_default_disclosure(self):
        """测试获取默认展开策略"""
        manager_demo = AccessControlManager(
            mode=AccessMode.DEMO_PUBLIC,
            data_product=DataProductType.L2_EVIDENCE
        )
        assert manager_demo.get_default_disclosure() == "collapsed"
        
        manager_admin = AccessControlManager(
            mode=AccessMode.ADMIN_INTERNAL,
            data_product=DataProductType.L0_DASHBOARD
        )
        assert manager_admin.get_default_disclosure() == "full"


class TestUtilityFunctions:
    """测试工具函数"""
    
    def test_prune_response_data(self):
        """测试prune_response_data便捷函数"""
        data = {
            "public_field": "value1",
            "sensitive_field": "value2"
        }
        
        pruned_data, _ = prune_response_data(
            data,
            AccessMode.DEMO_PUBLIC,
            DataProductType.L0_DASHBOARD
        )
        
        assert isinstance(pruned_data, dict)
    
    def test_check_capability_permission(self):
        """测试check_capability_permission便捷函数"""
        response = check_capability_permission(
            "export",
            AccessMode.DEMO_PUBLIC,
            DataProductType.L0_DASHBOARD
        )
        
        assert not response.allowed


class TestSecurityValidation:
    """测试安全性验证"""
    
    def test_demo_public_cannot_access_sensitive_fields(self):
        """
        验收用例: Demo/Public下无法获取敏感字段
        
        这是P0安全要求
        """
        manager = AccessControlManager(
            mode=AccessMode.DEMO_PUBLIC,
            data_product=DataProductType.L2_EVIDENCE
        )
        
        sensitive_data = {
            "event_id": "evt001",
            "policy_holder_name": "John Doe",  # 敏感
            "internal_id": "abc123",  # 敏感
            "debug_info": {"key": "value"}  # 敏感
        }
        
        pruned_data, pruned_fields = manager.prune_data(sensitive_data)
        
        # 敏感字段不应该出现
        assert "policy_holder_name" not in pruned_data
        assert "internal_id" not in pruned_data
        assert "debug_info" not in pruned_data
        
        # 验证裁剪日志
        assert pruned_fields is not None
        assert len(pruned_fields) > 0
    
    def test_mode_consistency_across_data_products(self):
        """
        验收用例: 同一Mode下不同数据产品的裁剪策略一致
        
        确保不会出现"L0隐藏但L2暴露"的口径漂移
        """
        manager_l0 = AccessControlManager(
            mode=AccessMode.DEMO_PUBLIC,
            data_product=DataProductType.L0_DASHBOARD
        )
        manager_l2 = AccessControlManager(
            mode=AccessMode.DEMO_PUBLIC,
            data_product=DataProductType.L2_EVIDENCE
        )
        
        # Demo/Public下，L0和L2都不应该允许export
        assert not manager_l0.policy.capability_pruning.is_capability_allowed("export")
        assert not manager_l2.policy.capability_pruning.is_capability_allowed("export")
        
        # Demo/Public下，L0和L2都不应该允许明细(或强制聚合)
        assert not manager_l0.should_allow_detail() or manager_l0.should_force_aggregation()
        assert not manager_l2.should_allow_detail() or manager_l2.should_force_aggregation()
