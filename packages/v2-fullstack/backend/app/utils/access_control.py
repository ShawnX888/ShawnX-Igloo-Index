"""
Access Control工具函数

提供Mode验证、裁剪执行、审计日志等工具函数。

Reference:
- docs/v2/v2实施细则/02-Access-Mode裁剪基线-细则.md
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.schemas.access_control import (
    DataProductType,
    FieldPruner,
    ModePruningPolicy,
    PruningPolicyRegistry,
    UnauthorizedAccessResponse,
    UnauthorizedAccessStrategy,
)
from app.schemas.shared import AccessMode, TraceContext

logger = logging.getLogger(__name__)


class AccessControlManager:
    """
    Access Control管理器
    
    职责:
    - 获取Mode裁剪策略
    - 执行字段裁剪
    - 验证能力权限
    - 记录审计日志
    """
    
    def __init__(
        self,
        mode: AccessMode,
        data_product: DataProductType,
        trace_context: Optional[TraceContext] = None
    ):
        """
        初始化Access Control管理器
        
        Args:
            mode: 访问模式
            data_product: 数据产品类型
            trace_context: 追踪上下文(可选)
        """
        self.mode = mode
        self.data_product = data_product
        self.trace_context = trace_context
        
        # 获取裁剪策略
        self.policy = PruningPolicyRegistry.get_policy_or_default(mode, data_product)
        
        # 记录策略获取
        self._log_policy_fetch()
    
    def prune_data(
        self,
        data: Any,
        record_pruned_fields: bool = True
    ) -> tuple[Any, Optional[List[str]]]:
        """
        执行数据裁剪
        
        Args:
            data: 原始数据(dict或list of dict)
            record_pruned_fields: 是否记录被裁剪的字段
            
        Returns:
            (裁剪后的数据, 被裁剪的字段列表)
        """
        pruned_fields = []
        
        if isinstance(data, dict):
            if record_pruned_fields:
                pruned_fields = [
                    field for field in data.keys()
                    if not self.policy.field_pruning.is_field_allowed(field)
                ]
            pruned_data = FieldPruner.prune_dict(data, self.policy.field_pruning)
        elif isinstance(data, list):
            if record_pruned_fields and len(data) > 0:
                # 只记录第一个元素的被裁剪字段(假设列表中所有元素结构相同)
                first_item = data[0] if isinstance(data[0], dict) else {}
                pruned_fields = [
                    field for field in first_item.keys()
                    if not self.policy.field_pruning.is_field_allowed(field)
                ]
            pruned_data = FieldPruner.prune_list(data, self.policy.field_pruning)
        else:
            # 不支持的数据类型,直接返回
            pruned_data = data
        
        if record_pruned_fields and pruned_fields:
            self._log_data_pruning(pruned_fields)
        
        return pruned_data, pruned_fields if record_pruned_fields else None
    
    def check_capability(self, capability: str) -> UnauthorizedAccessResponse:
        """
        检查能力权限
        
        Args:
            capability: 请求的能力(如: 'export', 'compare')
            
        Returns:
            权限检查响应
        """
        allowed = self.policy.capability_pruning.is_capability_allowed(capability)
        
        if allowed:
            self._log_capability_check(capability, allowed=True)
            return UnauthorizedAccessResponse(
                strategy=UnauthorizedAccessStrategy.PRUNE_AND_RETURN,
                allowed=True,
                mode=self.mode,
                requested_capability=capability,
                reason=f"Capability '{capability}' is allowed for mode '{self.mode.value}'"
            )
        else:
            self._log_capability_check(capability, allowed=False)
            return UnauthorizedAccessResponse(
                strategy=UnauthorizedAccessStrategy.REJECT,
                allowed=False,
                mode=self.mode,
                requested_capability=capability,
                reason=f"Capability '{capability}' is not allowed for mode '{self.mode.value}'",
                suggestion="Please contact administrator for higher access level"
            )
    
    def get_default_disclosure(self) -> str:
        """获取默认展开策略"""
        return self.policy.default_disclosure
    
    def should_allow_detail(self) -> bool:
        """是否允许明细级数据"""
        return self.policy.granularity_pruning.allow_detail
    
    def should_force_aggregation(self) -> bool:
        """是否强制聚合"""
        return self.policy.granularity_pruning.force_aggregation
    
    def get_aggregation_level(self) -> Optional[str]:
        """获取聚合级别"""
        return self.policy.granularity_pruning.aggregation_level
    
    def get_value_representation(self) -> Optional[str]:
        """获取数值表示方式"""
        return self.policy.granularity_pruning.value_representation
    
    def _log_policy_fetch(self):
        """记录策略获取"""
        logger.info(
            f"Access control policy fetched: "
            f"mode={self.mode.value}, "
            f"data_product={self.data_product.value}, "
            f"policy_version={self.policy.policy_version}",
            extra={
                "trace_id": self.trace_context.trace_id if self.trace_context else None,
                "access_mode": self.mode.value,
                "data_product": self.data_product.value,
                "policy_version": self.policy.policy_version,
            }
        )
    
    def _log_data_pruning(self, pruned_fields: List[str]):
        """记录数据裁剪"""
        logger.info(
            f"Data pruned: "
            f"mode={self.mode.value}, "
            f"data_product={self.data_product.value}, "
            f"pruned_fields={','.join(pruned_fields)}",
            extra={
                "trace_id": self.trace_context.trace_id if self.trace_context else None,
                "access_mode": self.mode.value,
                "data_product": self.data_product.value,
                "pruned_fields": pruned_fields,
                "pruned_count": len(pruned_fields),
            }
        )
    
    def _log_capability_check(self, capability: str, allowed: bool):
        """记录能力权限检查"""
        logger.info(
            f"Capability check: "
            f"mode={self.mode.value}, "
            f"data_product={self.data_product.value}, "
            f"capability={capability}, "
            f"allowed={allowed}",
            extra={
                "trace_id": self.trace_context.trace_id if self.trace_context else None,
                "access_mode": self.mode.value,
                "data_product": self.data_product.value,
                "capability": capability,
                "allowed": allowed,
            }
        )


def prune_response_data(
    data: Any,
    mode: AccessMode,
    data_product: DataProductType,
    trace_context: Optional[TraceContext] = None
) -> tuple[Any, Optional[List[str]]]:
    """
    便捷函数: 执行响应数据裁剪
    
    Args:
        data: 原始数据
        mode: 访问模式
        data_product: 数据产品类型
        trace_context: 追踪上下文(可选)
        
    Returns:
        (裁剪后的数据, 被裁剪的字段列表)
    """
    manager = AccessControlManager(mode, data_product, trace_context)
    return manager.prune_data(data)


def check_capability_permission(
    capability: str,
    mode: AccessMode,
    data_product: DataProductType,
    trace_context: Optional[TraceContext] = None
) -> UnauthorizedAccessResponse:
    """
    便捷函数: 检查能力权限
    
    Args:
        capability: 请求的能力
        mode: 访问模式
        data_product: 数据产品类型
        trace_context: 追踪上下文(可选)
        
    Returns:
        权限检查响应
    """
    manager = AccessControlManager(mode, data_product, trace_context)
    return manager.check_capability(capability)
