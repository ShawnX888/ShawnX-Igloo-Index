"""
Prediction Run 批次管理 Schema

本模块定义预测批次版本化的核心数据结构:
- PredictionRun: 批次元信息
- PredictionRunStatus: 批次状态
- ActiveRunManager: active_run切换与回滚

Reference:
- docs/v2/v2实施细则/03-Prediction-Run基线-细则.md
- docs/v2/v2架构升级-全栈方案.md Section 2.1.6 (预测批次表)

硬规则:
- predicted场景下所有数据必须绑定 prediction_run_id
- 同一请求链路不得混用不同批次
- 缓存key必须包含 prediction_run_id
- 回滚只能通过切换 active_run (不覆盖历史数据)
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Enums
# ============================================================================

class PredictionRunStatus(str, Enum):
    """
    预测批次状态
    
    说明:
    - ACTIVE: 当前对外展示的批次(全局或按维度仅有一个active)
    - ARCHIVED: 已归档的历史批次(可用于回滚)
    - FAILED: 失败的批次(计算错误/数据不完整等)
    - PROCESSING: 正在计算中(临时状态)
    """
    ACTIVE = "active"
    ARCHIVED = "archived"
    FAILED = "failed"
    PROCESSING = "processing"


class PredictionRunSource(str, Enum):
    """
    预测批次来源
    
    用于审计与排障
    """
    EXTERNAL_SYNC = "external_sync"      # 外部数据同步触发
    MANUAL_BACKFILL = "manual_backfill"  # 手动回填
    SCHEDULED_RERUN = "scheduled_rerun"  # 定时重算
    ROLLBACK = "rollback"                # 回滚操作


# ============================================================================
# Prediction Run Schema
# ============================================================================

class PredictionRunBase(BaseModel):
    """Prediction Run基础信息"""
    model_config = ConfigDict(from_attributes=True)
    
    status: PredictionRunStatus = Field(..., description="批次状态")
    source: PredictionRunSource = Field(..., description="批次来源")
    note: Optional[str] = Field(None, description="备注(如回滚原因)")


class PredictionRunCreate(PredictionRunBase):
    """创建Prediction Run的请求"""
    pass


class PredictionRun(PredictionRunBase):
    """
    Prediction Run完整信息
    
    对应数据库 prediction_runs 表
    """
    id: str = Field(
        ...,
        description="批次ID(如: run-2025-01-20-001)",
        examples=["run-2025-01-20-001", "run-2025-01-20-002"]
    )
    created_at: datetime = Field(..., description="批次创建时间(UTC)")
    
    # 可选: 批次维度范围(MVP可先做"全局单一active_run")
    weather_type: Optional[str] = Field(
        None,
        description="天气类型维度(可选,未来扩展)"
    )
    product_id: Optional[str] = Field(
        None,
        description="产品ID维度(可选,未来扩展)"
    )
    region_scope: Optional[str] = Field(
        None,
        description="区域范围维度(可选,未来扩展)"
    )


class PredictionRunUpdate(BaseModel):
    """更新Prediction Run"""
    model_config = ConfigDict(from_attributes=True)
    
    status: Optional[PredictionRunStatus] = None
    note: Optional[str] = None


# ============================================================================
# Active Run 管理
# ============================================================================

class ActiveRunInfo(BaseModel):
    """
    Active Run 信息
    
    用于响应中标注当前使用的批次
    """
    model_config = ConfigDict(from_attributes=True)
    
    active_run_id: str = Field(..., description="当前active批次ID")
    generated_at: datetime = Field(..., description="批次生成时间(UTC)")
    source: PredictionRunSource = Field(..., description="批次来源")
    
    # 可选: 维度范围
    scope_description: Optional[str] = Field(
        None,
        description="批次适用范围说明(如: '全局' 或 '降雨产品专用')"
    )


class ActiveRunSwitchRequest(BaseModel):
    """
    切换 Active Run 的请求
    
    用于回滚或切换到新批次
    """
    model_config = ConfigDict(from_attributes=True)
    
    new_active_run_id: str = Field(..., description="新的active批次ID")
    reason: str = Field(..., description="切换原因")
    operator: Optional[str] = Field(None, description="操作者")
    
    # 可选: 维度范围(MVP可先全局切换)
    scope: Optional[str] = Field(
        None,
        description="切换范围(如: 'global' 或 'weather_type:rainfall')"
    )


class ActiveRunSwitchRecord(BaseModel):
    """
    Active Run 切换记录
    
    用于审计
    """
    model_config = ConfigDict(from_attributes=True)
    
    from_run_id: str = Field(..., description="切换前的active批次")
    to_run_id: str = Field(..., description="切换后的active批次")
    switched_at: datetime = Field(..., description="切换时间(UTC)")
    reason: str = Field(..., description="切换原因")
    operator: Optional[str] = Field(None, description="操作者")
    scope: str = Field(default="global", description="切换范围")
    
    # 影响统计(可选)
    affected_cache_keys: Optional[int] = Field(
        None,
        description="失效的缓存key数量"
    )
    affected_data_products: Optional[list[str]] = Field(
        None,
        description="受影响的数据产品列表"
    )


# ============================================================================
# Prediction Run 一致性验证
# ============================================================================

class PredictionConsistencyCheck(BaseModel):
    """
    预测一致性检查结果
    
    用于验证同一链路中是否混用了不同批次
    """
    model_config = ConfigDict(from_attributes=True)
    
    consistent: bool = Field(..., description="是否一致")
    prediction_run_ids: list[str] = Field(
        ...,
        description="检测到的所有批次ID"
    )
    active_run_id: Optional[str] = Field(
        None,
        description="期望的active批次ID"
    )
    inconsistent_sources: Optional[list[str]] = Field(
        None,
        description="不一致的数据来源(如: ['l0_dashboard', 'map_overlays'])"
    )
    recommendation: Optional[str] = Field(
        None,
        description="修复建议"
    )


# ============================================================================
# 批次查询过滤器
# ============================================================================

class PredictionRunFilter(BaseModel):
    """
    Prediction Run 查询过滤器
    """
    model_config = ConfigDict(from_attributes=True)
    
    status: Optional[PredictionRunStatus] = Field(
        None,
        description="按状态过滤"
    )
    source: Optional[PredictionRunSource] = Field(
        None,
        description="按来源过滤"
    )
    weather_type: Optional[str] = Field(
        None,
        description="按天气类型过滤(如有维度)"
    )
    created_after: Optional[datetime] = Field(
        None,
        description="创建时间晚于(UTC)"
    )
    created_before: Optional[datetime] = Field(
        None,
        description="创建时间早于(UTC)"
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=100,
        description="返回数量限制"
    )


class PredictionRunListResponse(BaseModel):
    """
    Prediction Run 列表响应
    """
    model_config = ConfigDict(from_attributes=True)
    
    runs: list[PredictionRun] = Field(..., description="批次列表")
    total: int = Field(..., description="总数")
    active_run: Optional[PredictionRun] = Field(
        None,
        description="当前active批次(如有)"
    )
