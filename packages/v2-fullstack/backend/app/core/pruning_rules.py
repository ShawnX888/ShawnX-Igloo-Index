"""
Pruning Rules Configuration - v2 Access Mode

裁剪规则配置（字段级、模型级）
"""

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from app.schemas.shared import AccessMode
from app.core.masking import (
    mask_claim_number,
    mask_internal_ref,
    mask_name,
    mask_to_none,
    round_to_range,
)


@dataclass
class FieldPruningRule:
    """
    字段裁剪规则
    
    Attributes:
        field_name: 字段名
        prune_for: 需要裁剪的访问模式列表
        prune_func: 裁剪函数（None表示完全裁剪）
    """
    field_name: str
    prune_for: List[AccessMode]
    prune_func: Optional[Callable] = None


@dataclass
class ModelPruningRules:
    """
    模型裁剪规则集
    
    Attributes:
        model_name: 模型名称
        field_rules: 字段级裁剪规则列表
        custom_prune_func: 自定义裁剪函数（模型级）
    """
    model_name: str
    field_rules: List[FieldPruningRule] = field(default_factory=list)
    custom_prune_func: Optional[Callable] = None


# ============================================================================
# ClaimEvent 裁剪规则
# ============================================================================


CLAIM_EVENT_RULES = ModelPruningRules(
    model_name="ClaimEvent",
    field_rules=[
        # 金额字段 - Demo 完全隐藏，Partner 范围化
        FieldPruningRule(
            field_name="payout_amount",
            prune_for=[AccessMode.DEMO],
            prune_func=None  # 完全裁剪
        ),
        FieldPruningRule(
            field_name="payout_amount",
            prune_for=[AccessMode.PARTNER],
            prune_func=round_to_range  # 范围化
        ),
        # 理赔单号 - Demo 脱敏
        FieldPruningRule(
            field_name="claim_number",
            prune_for=[AccessMode.DEMO],
            prune_func=mask_claim_number
        ),
        # 内部字段 - Demo 和 Partner 隐藏
        FieldPruningRule(
            field_name="internal_ref",
            prune_for=[AccessMode.DEMO, AccessMode.PARTNER],
            prune_func=mask_to_none
        ),
    ]
)


# ============================================================================
# PolicyResponse 裁剪规则
# ============================================================================


POLICY_RESPONSE_RULES = ModelPruningRules(
    model_name="PolicyResponse",
    field_rules=[
        # 保额 - Demo 隐藏，Partner 范围化
        FieldPruningRule(
            field_name="coverage_amount",
            prune_for=[AccessMode.DEMO],
            prune_func=None
        ),
        FieldPruningRule(
            field_name="coverage_amount",
            prune_for=[AccessMode.PARTNER],
            prune_func=round_to_range
        ),
        # 投保人姓名 - Demo 和 Partner 脱敏
        FieldPruningRule(
            field_name="holder_name",
            prune_for=[AccessMode.DEMO, AccessMode.PARTNER],
            prune_func=mask_name
        ),
        # 内部参考 - 非 Admin 隐藏
        FieldPruningRule(
            field_name="internal_ref",
            prune_for=[AccessMode.DEMO, AccessMode.PARTNER],
            prune_func=mask_internal_ref
        ),
    ]
)


# ============================================================================
# RiskEvent 裁剪规则
# ============================================================================


RISK_EVENT_RULES = ModelPruningRules(
    model_name="RiskEvent",
    field_rules=[
        # 规则哈希 - Demo 隐藏
        FieldPruningRule(
            field_name="rules_hash",
            prune_for=[AccessMode.DEMO],
            prune_func=None
        ),
    ]
)


# ============================================================================
# L2EvidenceResponse 自定义裁剪
# ============================================================================


def prune_l2_evidence(data_dict: dict, access_mode: AccessMode) -> dict:
    """
    L2 证据链自定义裁剪逻辑
    
    Args:
        data_dict: 数据字典
        access_mode: 访问模式
    
    Returns:
        裁剪后的数据字典
    """
    if access_mode == AccessMode.DEMO:
        # Demo 模式：只返回聚合摘要，不返回明细
        data_dict["risk_events"] = []
        data_dict["claim_events"] = []
        data_dict["associations"] = {}
        # 可以添加摘要字段
        data_dict["summary"] = {
            "risk_count": data_dict.get("total", 0),
            "claim_count": 0  # Demo 不显示理赔数量
        }
    elif access_mode == AccessMode.PARTNER:
        # Partner 模式：限制明细数量
        max_items = 10
        data_dict["risk_events"] = data_dict["risk_events"][:max_items]
        data_dict["claim_events"] = data_dict["claim_events"][:max_items]
    
    return data_dict


L2_EVIDENCE_RULES = ModelPruningRules(
    model_name="L2EvidenceResponse",
    field_rules=[],
    custom_prune_func=prune_l2_evidence
)


# ============================================================================
# RankingResponse 自定义裁剪
# ============================================================================


def prune_ranking(data_dict: dict, access_mode: AccessMode) -> dict:
    """
    排名响应自定义裁剪逻辑
    
    Args:
        data_dict: 数据字典
        access_mode: 访问模式
    
    Returns:
        裁剪后的数据字典
    """
    if access_mode == AccessMode.DEMO:
        # Demo 模式：只返回 Top5
        data_dict["rankings"] = data_dict["rankings"][:5]
        data_dict["total"] = min(data_dict["total"], 5)
    elif access_mode == AccessMode.PARTNER:
        # Partner 模式：返回 Top20
        data_dict["rankings"] = data_dict["rankings"][:20]
        data_dict["total"] = min(data_dict["total"], 20)
    
    return data_dict


RANKING_RESPONSE_RULES = ModelPruningRules(
    model_name="RankingResponse",
    field_rules=[],
    custom_prune_func=prune_ranking
)


# ============================================================================
# 全局裁剪规则注册表
# ============================================================================


_PRUNING_RULES_REGISTRY: Dict[str, ModelPruningRules] = {
    "ClaimEvent": CLAIM_EVENT_RULES,
    "PolicyResponse": POLICY_RESPONSE_RULES,
    "RiskEvent": RISK_EVENT_RULES,
    "L2EvidenceResponse": L2_EVIDENCE_RULES,
    "RankingResponse": RANKING_RESPONSE_RULES,
}


def register_pruning_rules(rules: ModelPruningRules) -> None:
    """
    注册裁剪规则
    
    Args:
        rules: 裁剪规则
    
    Examples:
        >>> custom_rules = ModelPruningRules(model_name="MyModel", ...)
        >>> register_pruning_rules(custom_rules)
    """
    _PRUNING_RULES_REGISTRY[rules.model_name] = rules


def get_pruning_rules(model_name: str) -> Optional[ModelPruningRules]:
    """
    获取裁剪规则
    
    Args:
        model_name: 模型名称
    
    Returns:
        裁剪规则（如果存在）
    
    Examples:
        >>> rules = get_pruning_rules("ClaimEvent")
        >>> assert rules is not None
    """
    return _PRUNING_RULES_REGISTRY.get(model_name)


def list_registered_models() -> List[str]:
    """
    列出所有已注册的模型名称
    
    Returns:
        模型名称列表
    
    Examples:
        >>> models = list_registered_models()
        >>> assert "ClaimEvent" in models
    """
    return list(_PRUNING_RULES_REGISTRY.keys())
