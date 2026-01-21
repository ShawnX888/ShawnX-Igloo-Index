"""
Shared Contract: 统一维度、DTO分类、枚举定义

本模块定义了v2全栈架构的核心契约,确保前后端使用一致的:
- 输入维度命名与语义
- 输出DTO分类
- 时间口径
- Mode裁剪规则
- predicted批次一致性规则

Reference:
- docs/v2/v2实施细则/01-Shared-Contract基线-细则.md
- docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# Enums (枚举类型 - 必须与前端保持一致)
# ============================================================================

class RegionScope(str, Enum):
    """区域范围级别"""
    PROVINCE = "province"
    DISTRICT = "district"
    # 可扩展: CITY = "city", GRID = "grid"


class DataType(str, Enum):
    """数据类型"""
    HISTORICAL = "historical"
    PREDICTED = "predicted"


class WeatherType(str, Enum):
    """天气类型 - 参考 RD-多天气类型扩展.md"""
    RAINFALL = "rainfall"
    WIND = "wind"
    TEMPERATURE = "temperature"
    # 未来扩展: HUMIDITY = "humidity", PRESSURE = "pressure"


class AccessMode(str, Enum):
    """访问模式 - 影响数据裁剪、默认展开、可用动作"""
    DEMO_PUBLIC = "demo_public"      # Demo/Public: 路演默认,少数字强可视化
    PARTNER = "partner"              # Partner: 合作伙伴,更深KPI与对比
    ADMIN_INTERNAL = "admin_internal"  # Admin/Internal: 内部,全量明细


# ============================================================================
# Input Dimensions (输入维度 - 最小集合)
# ============================================================================

class TimeRange(BaseModel):
    """
    时间范围
    
    规则:
    - 存储与传输使用UTC
    - 业务边界对齐使用region_timezone
    - 展示时区仅用于UI渲染
    
    Reference: RD-时间与时区口径统一.md
    """
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "start": "2025-01-01T00:00:00Z",
                "end": "2025-01-31T23:59:59Z"
            }
        }
    )
    
    start: datetime = Field(
        ...,
        description="起始时间(UTC)",
    )
    end: datetime = Field(
        ...,
        description="结束时间(UTC)",
    )
    
    @field_validator("end")
    @classmethod
    def validate_end_after_start(cls, v: datetime, info) -> datetime:
        if "start" in info.data and v <= info.data["start"]:
            raise ValueError("end must be after start")
        return v


class SharedDimensions(BaseModel):
    """
    共享输入维度 - 所有Data Product请求的最小集合
    
    硬规则:
    - region_code/time_range/data_type/weather_type/access_mode 为必须
    - predicted场景下 prediction_run_id 为必须
    - 任何新增维度必须先入契约再入实现
    
    缓存key维度: 至少包含 access_mode; predicted 额外包含 prediction_run_id
    """
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "region_scope": "province",
                "region_code": "CN-GD",
                "time_range": {
                    "start": "2025-01-01T00:00:00Z",
                    "end": "2025-01-31T23:59:59Z"
                },
                "data_type": "historical",
                "weather_type": "rainfall",
                "product_id": "daily_rainfall",
                "access_mode": "demo_public",
                "prediction_run_id": None
            }
        }
    )
    
    # 必须维度
    region_scope: RegionScope = Field(
        ...,
        description="区域范围级别"
    )
    region_code: str = Field(
        ...,
        description="区域代码(统一编码,如CN-GD表示广东省)",
        min_length=2,
        max_length=20
    )
    time_range: TimeRange = Field(
        ...,
        description="时间范围(UTC)"
    )
    data_type: DataType = Field(
        ...,
        description="数据类型"
    )
    weather_type: WeatherType = Field(
        ...,
        description="天气类型"
    )
    access_mode: AccessMode = Field(
        ...,
        description="访问模式(影响输出裁剪)"
    )
    
    # 可选维度
    product_id: Optional[str] = Field(
        None,
        description="产品ID(可选,但一旦使用必须入缓存key)"
    )
    prediction_run_id: Optional[str] = Field(
        None,
        description="预测批次ID(predicted场景必须)"
    )
    region_timezone: Optional[str] = Field(
        None,
        description="区域时区(如Asia/Shanghai,用于业务边界对齐)",
        examples=["Asia/Shanghai", "America/New_York"]
    )
    
    @field_validator("prediction_run_id")
    @classmethod
    def validate_prediction_run_id(cls, v: Optional[str], info) -> Optional[str]:
        """predicted场景下必须提供prediction_run_id"""
        if "data_type" in info.data:
            data_type = info.data["data_type"]
            if data_type == DataType.PREDICTED and not v:
                raise ValueError("prediction_run_id is required when data_type is predicted")
            if data_type == DataType.HISTORICAL and v:
                raise ValueError("prediction_run_id must be None when data_type is historical")
        return v
    
    def to_cache_key(self) -> str:
        """
        生成缓存key
        
        硬规则:
        - 至少包含: region_scope, region_code, time_range, data_type, weather_type, access_mode
        - predicted场景额外包含: prediction_run_id
        """
        parts = [
            f"region:{self.region_scope.value}:{self.region_code}",
            f"time:{self.time_range.start.isoformat()}:{self.time_range.end.isoformat()}",
            f"dtype:{self.data_type.value}",
            f"weather:{self.weather_type.value}",
            f"mode:{self.access_mode.value}",
        ]
        
        if self.product_id:
            parts.append(f"product:{self.product_id}")
        
        if self.data_type == DataType.PREDICTED and self.prediction_run_id:
            parts.append(f"run:{self.prediction_run_id}")
        
        return "|".join(parts)


# ============================================================================
# Output DTOs (输出DTO分类 - 避免混用)
# ============================================================================

class SeriesData(BaseModel):
    """
    时间序列数据
    
    用途: Timeline三泳道(Weather/Risk/Claims)、趋势图
    """
    model_config = ConfigDict(from_attributes=True)
    
    timestamps: List[datetime] = Field(
        ...,
        description="时间点列表(UTC)"
    )
    values: List[Union[float, Decimal, int]] = Field(
        ...,
        description="数值列表"
    )
    unit: str = Field(
        ...,
        description="单位(如mm, km/h, celsius)",
        examples=["mm", "km/h", "celsius", "CNY"]
    )


class EventData(BaseModel):
    """
    事件数据
    
    用途: risk_events, claim_events
    
    硬规则:
    - predicted事件必须包含 prediction_run_id
    - 必须包含 rule_version 或 rules_hash (支持审计与回溯)
    """
    model_config = ConfigDict(from_attributes=True)
    
    event_id: str = Field(..., description="事件ID")
    timestamp: datetime = Field(..., description="事件时间(UTC)")
    event_type: str = Field(..., description="事件类型(risk/claim)")
    
    # 可选字段(根据事件类型动态填充)
    tier_level: Optional[int] = Field(None, description="风险等级(1/2/3)")
    trigger_value: Optional[Decimal] = Field(None, description="触发值")
    threshold_value: Optional[Decimal] = Field(None, description="阈值")
    amount: Optional[Decimal] = Field(None, description="金额(理赔)")
    
    # 审计字段
    data_type: DataType = Field(..., description="数据类型")
    prediction_run_id: Optional[str] = Field(
        None,
        description="预测批次ID(predicted事件必须)"
    )
    rule_version: Optional[str] = Field(
        None,
        description="规则版本(支持审计)"
    )


class AggregationData(BaseModel):
    """
    聚合数据
    
    用途: L0 KPI/Pareto（TopN）, Map Overlays 区域聚合
    
    硬规则:
    - 必须标注聚合维度(aggregation_key)与口径(aggregation_method)
    """
    model_config = ConfigDict(from_attributes=True)
    
    aggregation_key: str = Field(
        ...,
        description="聚合维度(如region_code, product_id)"
    )
    aggregation_method: str = Field(
        ...,
        description="聚合方法(sum/avg/count/max/min)",
        examples=["sum", "avg", "count", "max", "min"]
    )
    value: Union[float, Decimal, int] = Field(
        ...,
        description="聚合值"
    )
    unit: Optional[str] = Field(
        None,
        description="单位(可选)"
    )
    label: Optional[str] = Field(
        None,
        description="展示标签(可选)"
    )


class LegendMeta(BaseModel):
    """
    图例与元信息
    
    用途: 解释数据口径、单位、阈值、tiers等
    
    硬规则:
    - predicted数据必须包含 prediction_run_id
    - 必须标注 data_type 与 weather_type
    """
    model_config = ConfigDict(from_attributes=True)
    
    data_type: DataType = Field(..., description="数据类型")
    weather_type: WeatherType = Field(..., description="天气类型")
    unit: str = Field(..., description="单位")
    
    # 阈值/tiers(可选)
    thresholds: Optional[Dict[str, Union[float, Decimal]]] = Field(
        None,
        description="阈值字典(如 {'tier1': 50, 'tier2': 100, 'tier3': 150})",
        examples=[{"tier1": 50.0, "tier2": 100.0, "tier3": 150.0}]
    )
    
    # predicted元信息
    prediction_run_id: Optional[str] = Field(
        None,
        description="预测批次ID(predicted必须)"
    )
    prediction_generated_at: Optional[datetime] = Field(
        None,
        description="预测生成时间(UTC)"
    )
    
    # 口径说明(Mode-aware)
    description: Optional[str] = Field(
        None,
        description="口径说明(根据access_mode裁剪)"
    )


class DataProductResponse(BaseModel):
    """
    Data Product统一响应格式
    
    包含:
    - series: 时间序列(可选)
    - events: 事件列表(可选)
    - aggregations: 聚合数据(可选)
    - legend: 图例与元信息(必须)
    - meta: 响应元数据(可观测性)
    """
    model_config = ConfigDict(from_attributes=True)
    
    series: Optional[List[SeriesData]] = Field(
        None,
        description="时间序列数据"
    )
    events: Optional[List[EventData]] = Field(
        None,
        description="事件数据"
    )
    aggregations: Optional[List[AggregationData]] = Field(
        None,
        description="聚合数据"
    )
    legend: LegendMeta = Field(
        ...,
        description="图例与元信息"
    )
    meta: "ResponseMeta" = Field(
        ...,
        description="响应元数据"
    )


# ============================================================================
# Observability (可观测性)
# ============================================================================

class TraceContext(BaseModel):
    """
    追踪上下文 - 支撑全链路可追溯
    
    必带字段:
    - trace_id/correlation_id
    - 关键维度(access_mode, region_code, data_type, weather_type, product_id, prediction_run_id)
    """
    model_config = ConfigDict(from_attributes=True)
    
    trace_id: str = Field(
        ...,
        description="追踪ID(全链路唯一)"
    )
    correlation_id: Optional[str] = Field(
        None,
        description="关联ID(可选,用于跨服务关联)"
    )
    
    # 关键维度(用于排障)
    access_mode: AccessMode
    region_code: Optional[str] = None
    time_range_start: Optional[datetime] = None
    time_range_end: Optional[datetime] = None
    data_type: Optional[DataType] = None
    weather_type: Optional[WeatherType] = None
    product_id: Optional[str] = None
    prediction_run_id: Optional[str] = None
    
    # 时间戳
    request_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="请求时间(UTC)"
    )


class ResponseMeta(BaseModel):
    """
    响应元数据
    
    用途: 可观测性、缓存状态、警告信息
    """
    model_config = ConfigDict(from_attributes=True)
    
    trace_context: TraceContext = Field(
        ...,
        description="追踪上下文"
    )
    cached: bool = Field(
        default=False,
        description="是否命中缓存"
    )
    cache_key: Optional[str] = Field(
        None,
        description="缓存key(用于排障)"
    )
    warnings: Optional[List[str]] = Field(
        None,
        description="警告信息(如数据不完整、降级处理等)"
    )
    response_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="响应时间(UTC)"
    )


# Forward reference resolution
DataProductResponse.model_rebuild()
