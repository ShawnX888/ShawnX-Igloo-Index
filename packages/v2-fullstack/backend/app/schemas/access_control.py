"""
Access Mode 裁剪策略定义

本模块定义了Access Mode的三档裁剪规则:
- Demo/Public: 路演默认，少数字强可视化，敏感字段范围化/聚合
- Partner: 合作伙伴，更深KPI，明细字段脱敏(可配置)
- Admin/Internal: 内部，全量字段与明细(仍需审计)

Reference:
- docs/v2/v2实施细则/02-Access-Mode裁剪基线-细则.md
- docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md

硬规则:
- 前端隐藏不是权限，后端必须执行裁剪
- Mode 必须影响 AI (说什么、建议什么、能执行什么)
- 缓存 key 必含 access_mode (否则会串数据)
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.shared import AccessMode


# ============================================================================
# 裁剪维度枚举
# ============================================================================

class PruningDimension(str, Enum):
    """裁剪维度"""
    FIELD = "field"          # 字段级裁剪: 敏感字段不可下发
    GRANULARITY = "granularity"  # 粒度级裁剪: 明细→摘要、精确值→区间
    CAPABILITY = "capability"    # 能力级裁剪: Compare/导出/分享等动作集合


class DataProductType(str, Enum):
    """数据产品类型"""
    L0_DASHBOARD = "l0_dashboard"
    L1_REGION_INTELLIGENCE = "l1_region_intelligence"
    L2_EVIDENCE = "l2_evidence"
    MAP_OVERLAYS = "map_overlays"
    AI_INSIGHTS = "ai_insights"


# ============================================================================
# 裁剪策略配置
# ============================================================================

class FieldPruningRule(BaseModel):
    """
    字段级裁剪规则
    
    用途: 定义某个Mode下允许输出的字段集合
    """
    model_config = ConfigDict(from_attributes=True)
    
    allowed_fields: Set[str] = Field(
        ...,
        description="允许输出的字段集合(allowlist)"
    )
    masked_fields: Optional[Dict[str, str]] = Field(
        None,
        description="需要脱敏的字段及其脱敏规则(如: {'amount': 'range', 'phone': 'mask'})"
    )
    
    def is_field_allowed(self, field_name: str) -> bool:
        """判断字段是否允许输出"""
        return field_name in self.allowed_fields
    
    def should_mask_field(self, field_name: str) -> Optional[str]:
        """判断字段是否需要脱敏，返回脱敏规则"""
        if self.masked_fields:
            return self.masked_fields.get(field_name)
        return None


class GranularityPruningRule(BaseModel):
    """
    粒度级裁剪规则
    
    用途: 定义数据聚合/摘要的粒度策略
    """
    model_config = ConfigDict(from_attributes=True)
    
    allow_detail: bool = Field(
        ...,
        description="是否允许明细级数据"
    )
    force_aggregation: bool = Field(
        default=False,
        description="是否强制聚合(True时即使请求明细也返回聚合)"
    )
    aggregation_level: Optional[str] = Field(
        None,
        description="聚合级别(如: 'summary', 'district', 'province')",
        examples=["summary", "district", "province"]
    )
    value_representation: Optional[str] = Field(
        None,
        description="数值表示方式(如: 'exact', 'range', 'relative')",
        examples=["exact", "range", "relative"]
    )


class CapabilityPruningRule(BaseModel):
    """
    能力级裁剪规则
    
    用途: 定义某个Mode下允许的动作集合
    """
    model_config = ConfigDict(from_attributes=True)
    
    allowed_capabilities: Set[str] = Field(
        ...,
        description="允许的能力集合(如: 'view', 'compare', 'export', 'share')"
    )
    
    def is_capability_allowed(self, capability: str) -> bool:
        """判断能力是否允许"""
        return capability in self.allowed_capabilities


class ModePruningPolicy(BaseModel):
    """
    Mode完整裁剪策略
    
    包含: 字段级 + 粒度级 + 能力级裁剪规则
    """
    model_config = ConfigDict(from_attributes=True)
    
    mode: AccessMode = Field(..., description="访问模式")
    data_product: DataProductType = Field(..., description="数据产品类型")
    
    field_pruning: FieldPruningRule = Field(..., description="字段级裁剪规则")
    granularity_pruning: GranularityPruningRule = Field(..., description="粒度级裁剪规则")
    capability_pruning: CapabilityPruningRule = Field(..., description="能力级裁剪规则")
    
    default_disclosure: str = Field(
        default="collapsed",
        description="默认展开策略(collapsed/peek/half/full)",
        examples=["collapsed", "peek", "half", "full"]
    )
    
    policy_version: str = Field(
        default="v1.0.0",
        description="策略版本(用于审计与回滚)"
    )


# ============================================================================
# 预定义裁剪策略矩阵
# ============================================================================

class PruningPolicyRegistry:
    """
    裁剪策略注册表
    
    用途: 提供预定义的Mode×DataProduct裁剪策略矩阵
    """
    
    # L0 Dashboard 策略
    L0_DEMO_PUBLIC = ModePruningPolicy(
        mode=AccessMode.DEMO_PUBLIC,
        data_product=DataProductType.L0_DASHBOARD,
        field_pruning=FieldPruningRule(
            allowed_fields={
                "region_code", "region_name", "rank", 
                "policy_count", "claim_count", "claim_rate",
                # 隐藏: policy_amount_total, claim_amount_total (精确金额)
            },
            masked_fields={
                "policy_amount_total": "range",  # 转为区间
                "claim_amount_total": "range",
            }
        ),
        granularity_pruning=GranularityPruningRule(
            allow_detail=False,
            force_aggregation=True,
            aggregation_level="province",
            value_representation="range"  # 金额用区间表示
        ),
        capability_pruning=CapabilityPruningRule(
            allowed_capabilities={"view", "refresh"}
            # 禁止: compare, export, share
        ),
        default_disclosure="half"
    )
    
    L0_PARTNER = ModePruningPolicy(
        mode=AccessMode.PARTNER,
        data_product=DataProductType.L0_DASHBOARD,
        field_pruning=FieldPruningRule(
            allowed_fields={
                "region_code", "region_name", "rank",
                "policy_count", "claim_count", "claim_rate",
                "policy_amount_total", "claim_amount_total",  # 允许金额
                # 仍隐藏: internal_id, debug_info
            }
        ),
        granularity_pruning=GranularityPruningRule(
            allow_detail=True,
            force_aggregation=False,
            aggregation_level="district",  # 可到区级
            value_representation="exact"
        ),
        capability_pruning=CapabilityPruningRule(
            allowed_capabilities={"view", "refresh", "compare"}
            # 禁止: export, share
        ),
        default_disclosure="half"
    )
    
    L0_ADMIN = ModePruningPolicy(
        mode=AccessMode.ADMIN_INTERNAL,
        data_product=DataProductType.L0_DASHBOARD,
        field_pruning=FieldPruningRule(
            allowed_fields={
                "region_code", "region_name", "rank",
                "policy_count", "claim_count", "claim_rate",
                "policy_amount_total", "claim_amount_total",
                "internal_id", "debug_info", "created_at", "updated_at"
            }
        ),
        granularity_pruning=GranularityPruningRule(
            allow_detail=True,
            force_aggregation=False,
            value_representation="exact"
        ),
        capability_pruning=CapabilityPruningRule(
            allowed_capabilities={"view", "refresh", "compare", "export", "share", "configure"}
        ),
        default_disclosure="full"
    )
    
    # L2 Evidence 策略
    L2_DEMO_PUBLIC = ModePruningPolicy(
        mode=AccessMode.DEMO_PUBLIC,
        data_product=DataProductType.L2_EVIDENCE,
        field_pruning=FieldPruningRule(
            allowed_fields={
                "event_count", "claim_count", "summary"
                # 完全隐藏明细: event_id, claim_id, amounts, timestamps
            }
        ),
        granularity_pruning=GranularityPruningRule(
            allow_detail=False,
            force_aggregation=True,
            aggregation_level="summary",  # 只提供摘要
            value_representation="relative"
        ),
        capability_pruning=CapabilityPruningRule(
            allowed_capabilities={"view"}
            # 禁止所有其他能力
        ),
        default_disclosure="collapsed"  # 默认不展开
    )
    
    L2_PARTNER = ModePruningPolicy(
        mode=AccessMode.PARTNER,
        data_product=DataProductType.L2_EVIDENCE,
        field_pruning=FieldPruningRule(
            allowed_fields={
                "event_id", "event_type", "timestamp",
                "tier_level", "trigger_value", "threshold_value",
                "claim_id", "claim_amount",
                # 隐藏: policy_holder_name, internal_id
            },
            masked_fields={
                "policy_holder_name": "mask",
                "internal_id": "mask"
            }
        ),
        granularity_pruning=GranularityPruningRule(
            allow_detail=True,
            force_aggregation=False,
            aggregation_level="detail",
            value_representation="exact"
        ),
        capability_pruning=CapabilityPruningRule(
            allowed_capabilities={"view", "refresh"}
        ),
        default_disclosure="peek"
    )
    
    L2_ADMIN = ModePruningPolicy(
        mode=AccessMode.ADMIN_INTERNAL,
        data_product=DataProductType.L2_EVIDENCE,
        field_pruning=FieldPruningRule(
            allowed_fields={
                "event_id", "event_type", "timestamp",
                "tier_level", "trigger_value", "threshold_value",
                "claim_id", "claim_amount", "policy_holder_name",
                "internal_id", "debug_info", "audit_trail"
            }
        ),
        granularity_pruning=GranularityPruningRule(
            allow_detail=True,
            force_aggregation=False,
            value_representation="exact"
        ),
        capability_pruning=CapabilityPruningRule(
            allowed_capabilities={
                "view", "refresh", "compare", "export", "share", 
                "audit", "configure"
            }
        ),
        default_disclosure="half"
    )
    
    # 策略查找表
    _POLICIES: Dict[tuple[AccessMode, DataProductType], ModePruningPolicy] = {
        (AccessMode.DEMO_PUBLIC, DataProductType.L0_DASHBOARD): L0_DEMO_PUBLIC,
        (AccessMode.PARTNER, DataProductType.L0_DASHBOARD): L0_PARTNER,
        (AccessMode.ADMIN_INTERNAL, DataProductType.L0_DASHBOARD): L0_ADMIN,
        
        (AccessMode.DEMO_PUBLIC, DataProductType.L2_EVIDENCE): L2_DEMO_PUBLIC,
        (AccessMode.PARTNER, DataProductType.L2_EVIDENCE): L2_PARTNER,
        (AccessMode.ADMIN_INTERNAL, DataProductType.L2_EVIDENCE): L2_ADMIN,
        
        # TODO: 添加其他数据产品的策略
        # - L1_REGION_INTELLIGENCE
        # - MAP_OVERLAYS
        # - AI_INSIGHTS
    }
    
    @classmethod
    def get_policy(
        cls,
        mode: AccessMode,
        data_product: DataProductType
    ) -> Optional[ModePruningPolicy]:
        """
        获取裁剪策略
        
        Args:
            mode: 访问模式
            data_product: 数据产品类型
            
        Returns:
            对应的裁剪策略，如果未定义则返回None
        """
        return cls._POLICIES.get((mode, data_product))
    
    @classmethod
    def get_policy_or_default(
        cls,
        mode: AccessMode,
        data_product: DataProductType
    ) -> ModePruningPolicy:
        """
        获取裁剪策略，如果未定义则返回最保守策略(DEMO_PUBLIC)
        
        Args:
            mode: 访问模式
            data_product: 数据产品类型
            
        Returns:
            对应的裁剪策略
        """
        policy = cls.get_policy(mode, data_product)
        if policy is None:
            # 如果未定义，回退到最保守策略
            policy = cls.get_policy(AccessMode.DEMO_PUBLIC, data_product)
            if policy is None:
                # 如果连DEMO_PUBLIC都未定义，返回最严格的默认策略
                return cls._create_strictest_default(data_product)
        return policy
    
    @classmethod
    def _create_strictest_default(cls, data_product: DataProductType) -> ModePruningPolicy:
        """创建最严格的默认策略"""
        return ModePruningPolicy(
            mode=AccessMode.DEMO_PUBLIC,
            data_product=data_product,
            field_pruning=FieldPruningRule(
                allowed_fields=set()  # 不允许任何字段
            ),
            granularity_pruning=GranularityPruningRule(
                allow_detail=False,
                force_aggregation=True,
                aggregation_level="summary",
                value_representation="relative"
            ),
            capability_pruning=CapabilityPruningRule(
                allowed_capabilities={"view"}
            ),
            default_disclosure="collapsed"
        )


# ============================================================================
# 裁剪执行器
# ============================================================================

class FieldPruner:
    """字段裁剪执行器"""
    
    @staticmethod
    def prune_dict(
        data: Dict[str, Any],
        policy: FieldPruningRule
    ) -> Dict[str, Any]:
        """
        裁剪字典中的字段
        
        Args:
            data: 原始数据字典
            policy: 字段裁剪规则
            
        Returns:
            裁剪后的数据字典
        """
        pruned = {}
        for field, value in data.items():
            if policy.is_field_allowed(field):
                # 检查是否需要脱敏
                mask_rule = policy.should_mask_field(field)
                if mask_rule:
                    pruned[field] = FieldPruner._mask_value(value, mask_rule)
                else:
                    pruned[field] = value
        return pruned
    
    @staticmethod
    def prune_list(
        data: List[Dict[str, Any]],
        policy: FieldPruningRule
    ) -> List[Dict[str, Any]]:
        """裁剪列表中每个字典的字段"""
        return [FieldPruner.prune_dict(item, policy) for item in data]
    
    @staticmethod
    def _mask_value(value: Any, mask_rule: str) -> Any:
        """
        脱敏值
        
        Args:
            value: 原始值
            mask_rule: 脱敏规则(range/mask/hash)
            
        Returns:
            脱敏后的值
        """
        if mask_rule == "range":
            # 转为区间表示
            if isinstance(value, (int, float)):
                # 简单示例: 转为10的倍数区间
                lower = (value // 10) * 10
                upper = lower + 10
                return f"[{lower}, {upper})"
            return value
        elif mask_rule == "mask":
            # 字符串脱敏
            if isinstance(value, str) and len(value) > 4:
                return value[:2] + "***" + value[-2:]
            return "***"
        elif mask_rule == "hash":
            # 哈希脱敏
            import hashlib
            return hashlib.sha256(str(value).encode()).hexdigest()[:8]
        return value


# ============================================================================
# 越权响应策略
# ============================================================================

class UnauthorizedAccessStrategy(str, Enum):
    """越权访问处理策略"""
    PRUNE_AND_RETURN = "prune_and_return"  # 方案A: 返回裁剪后结果
    REJECT = "reject"  # 方案B: 直接拒绝(403)


class UnauthorizedAccessResponse(BaseModel):
    """越权访问响应"""
    model_config = ConfigDict(from_attributes=True)
    
    strategy: UnauthorizedAccessStrategy
    allowed: bool = Field(default=False, description="是否允许访问")
    mode: AccessMode = Field(..., description="当前访问模式")
    requested_capability: Optional[str] = Field(None, description="请求的能力")
    reason: str = Field(..., description="原因说明")
    suggestion: Optional[str] = Field(None, description="建议(如何获得权限)")
