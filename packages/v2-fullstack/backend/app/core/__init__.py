"""
Core Module - v2 Backend Core Utilities

核心工具模块
"""

from app.core.access_control import (
    aggregate_to_summary,
    get_pruning_context,
    limit_ranking,
    prune_dict,
    prune_list,
    prune_response,
    should_include_field,
)
from app.core.masking import (
    mask_address,
    mask_claim_number,
    mask_coordinates,
    mask_email,
    mask_id_number,
    mask_internal_ref,
    mask_name,
    mask_percentage,
    mask_phone,
    mask_policy_number,
    mask_timestamp_to_date,
    mask_timestamp_to_month,
    mask_to_none,
    mask_to_placeholder,
    round_to_k,
    round_to_range,
)
from app.core.pruning_rules import (
    FieldPruningRule,
    ModelPruningRules,
    get_pruning_rules,
    list_registered_models,
    register_pruning_rules,
)

__all__ = [
    # Access Control
    "prune_response",
    "prune_list",
    "prune_dict",
    "limit_ranking",
    "aggregate_to_summary",
    "should_include_field",
    "get_pruning_context",
    # Masking
    "round_to_range",
    "round_to_k",
    "mask_percentage",
    "mask_name",
    "mask_phone",
    "mask_email",
    "mask_id_number",
    "mask_policy_number",
    "mask_claim_number",
    "mask_internal_ref",
    "mask_address",
    "mask_coordinates",
    "mask_timestamp_to_date",
    "mask_timestamp_to_month",
    "mask_to_none",
    "mask_to_placeholder",
    # Pruning Rules
    "FieldPruningRule",
    "ModelPruningRules",
    "register_pruning_rules",
    "get_pruning_rules",
    "list_registered_models",
]
