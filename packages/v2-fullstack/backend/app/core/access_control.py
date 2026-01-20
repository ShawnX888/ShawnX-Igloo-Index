"""
Access Control - v2 Access Mode Pruning

根据 Access Mode 裁剪响应数据，防止权限旁路
"""

import logging
from typing import Any, Dict, List, Optional, TypeVar

from pydantic import BaseModel

from app.schemas.shared import AccessMode

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def prune_response(
    data: T,
    access_mode: AccessMode,
    model_name: Optional[str] = None
) -> T:
    """
    根据 Access Mode 裁剪响应数据
    
    Args:
        data: Pydantic 模型实例
        access_mode: 访问模式
        model_name: 模型名称（可选，自动推导）
    
    Returns:
        裁剪后的数据
    
    Raises:
        ValueError: 未找到裁剪规则（如果strict=True）
    
    Examples:
        >>> claim = ClaimEvent(...)
        >>> pruned = prune_response(claim, AccessMode.DEMO)
        >>> assert pruned.payout_amount is None  # Demo 模式裁剪金额
    """
    if access_mode == AccessMode.ADMIN:
        # Admin 模式不裁剪
        return data
    
    model_name = model_name or data.__class__.__name__
    
    # 导入裁剪规则（延迟导入避免循环依赖）
    from app.core.pruning_rules import get_pruning_rules
    
    rules = get_pruning_rules(model_name)
    
    if not rules:
        # 无规则时，记录警告（在生产环境应该抛出异常）
        logger.warning(
            f"No pruning rules found for model: {model_name}. "
            f"Data may contain sensitive information!"
        )
        return data
    
    # 转换为字典以便修改
    data_dict = data.model_dump()
    
    # 应用字段级裁剪
    for field_rule in rules.field_rules:
        if access_mode in field_rule.prune_for:
            field_value = data_dict.get(field_rule.field_name)
            
            if field_rule.prune_func:
                # 自定义裁剪函数
                data_dict[field_rule.field_name] = field_rule.prune_func(
                    field_value
                )
            else:
                # 完全裁剪（设为None）
                data_dict[field_rule.field_name] = None
    
    # 应用自定义裁剪逻辑（模型级）
    if rules.custom_prune_func:
        data_dict = rules.custom_prune_func(data_dict, access_mode)
    
    # 重新验证并返回
    return data.__class__.model_validate(data_dict)


def prune_list(
    items: List[T],
    access_mode: AccessMode,
    model_name: Optional[str] = None
) -> List[T]:
    """
    批量裁剪列表数据
    
    Args:
        items: Pydantic 模型实例列表
        access_mode: 访问模式
        model_name: 模型名称（可选，自动推导）
    
    Returns:
        裁剪后的列表
    
    Examples:
        >>> claims = [ClaimEvent(...), ClaimEvent(...)]
        >>> pruned_list = prune_list(claims, AccessMode.DEMO)
    """
    if not items:
        return items
    
    return [prune_response(item, access_mode, model_name) for item in items]


def prune_dict(
    data_dict: Dict[str, Any],
    access_mode: AccessMode,
    pruning_map: Dict[str, Optional[callable]]
) -> Dict[str, Any]:
    """
    根据映射裁剪字典数据
    
    Args:
        data_dict: 待裁剪的字典
        access_mode: 访问模式
        pruning_map: 裁剪映射（字段名 -> 裁剪函数，None表示完全裁剪）
    
    Returns:
        裁剪后的字典
    
    Examples:
        >>> data = {"amount": 50000, "name": "李明"}
        >>> pruned = prune_dict(
        ...     data, 
        ...     AccessMode.DEMO,
        ...     {"amount": None, "name": mask_name}
        ... )
        >>> assert pruned["amount"] is None
        >>> assert pruned["name"] == "李*"
    """
    if access_mode == AccessMode.ADMIN:
        return data_dict
    
    result = data_dict.copy()
    
    for field_name, prune_func in pruning_map.items():
        if field_name in result:
            if prune_func:
                result[field_name] = prune_func(result[field_name])
            else:
                result[field_name] = None
    
    return result


def limit_ranking(
    rankings: List[T],
    access_mode: AccessMode,
    demo_limit: int = 5,
    partner_limit: int = 20
) -> List[T]:
    """
    根据 Access Mode 限制排名列表长度
    
    Args:
        rankings: 排名列表
        access_mode: 访问模式
        demo_limit: Demo 模式限制数量
        partner_limit: Partner 模式限制数量
    
    Returns:
        限制后的列表
    
    Examples:
        >>> rankings = [RankingItem(...) for _ in range(100)]
        >>> demo_rankings = limit_ranking(rankings, AccessMode.DEMO)
        >>> assert len(demo_rankings) == 5
    """
    if access_mode == AccessMode.ADMIN:
        return rankings
    elif access_mode == AccessMode.DEMO:
        return rankings[:demo_limit]
    elif access_mode == AccessMode.PARTNER:
        return rankings[:partner_limit]
    
    return rankings


def aggregate_to_summary(
    details: List[T],
    access_mode: AccessMode,
    summary_func: callable
) -> Optional[Any]:
    """
    根据 Access Mode 将明细聚合为摘要
    
    Args:
        details: 明细列表
        access_mode: 访问模式
        summary_func: 聚合函数
    
    Returns:
        摘要结果（Demo模式）或原始明细（其他模式）
    
    Examples:
        >>> details = [ClaimEvent(...), ClaimEvent(...)]
        >>> summary = aggregate_to_summary(
        ...     details, 
        ...     AccessMode.DEMO,
        ...     lambda items: {"count": len(items), "total": sum(...)}
        ... )
    """
    if access_mode == AccessMode.DEMO:
        return summary_func(details)
    
    # Partner 和 Admin 返回原始明细
    return details


def should_include_field(
    field_name: str,
    access_mode: AccessMode,
    admin_only_fields: Optional[List[str]] = None,
    partner_plus_fields: Optional[List[str]] = None
) -> bool:
    """
    判断字段是否应该包含在响应中
    
    Args:
        field_name: 字段名
        access_mode: 访问模式
        admin_only_fields: 仅 Admin 可见字段列表
        partner_plus_fields: Partner 及以上可见字段列表
    
    Returns:
        是否应该包含该字段
    
    Examples:
        >>> should_include_field("debug_info", AccessMode.DEMO, admin_only=["debug_info"])
        False
        >>> should_include_field("debug_info", AccessMode.ADMIN, admin_only=["debug_info"])
        True
    """
    admin_only_fields = admin_only_fields or []
    partner_plus_fields = partner_plus_fields or []
    
    if field_name in admin_only_fields:
        return access_mode == AccessMode.ADMIN
    
    if field_name in partner_plus_fields:
        return access_mode in [AccessMode.PARTNER, AccessMode.ADMIN]
    
    # 默认所有模式可见
    return True


def get_pruning_context(
    access_mode: AccessMode,
    **kwargs
) -> Dict[str, Any]:
    """
    获取裁剪上下文信息
    
    用于在裁剪函数中获取必要的上下文信息
    
    Args:
        access_mode: 访问模式
        **kwargs: 额外的上下文信息
    
    Returns:
        裁剪上下文字典
    """
    return {
        "access_mode": access_mode,
        "is_demo": access_mode == AccessMode.DEMO,
        "is_partner": access_mode == AccessMode.PARTNER,
        "is_admin": access_mode == AccessMode.ADMIN,
        **kwargs
    }
