"""
Shared Schemas - v2 Shared Contract

这些 Pydantic Schema 必须与前端 TypeScript 类型保持严格一致
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# Enumerations
# ============================================================================


class DataType(str, Enum):
    """
    数据类型
    
    historical - 历史数据（不可变）
    predicted  - 预测数据（易变，需批次管理）
    """
    HISTORICAL = "historical"
    PREDICTED = "predicted"


class WeatherType(str, Enum):
    """
    天气类型
    
    rainfall     - 降雨
    wind         - 风
    temperature  - 温度
    humidity     - 湿度
    pressure     - 气压
    """
    RAINFALL = "rainfall"
    WIND = "wind"
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    PRESSURE = "pressure"


class AccessMode(str, Enum):
    """
    访问模式（Access Mode）
    
    demo     - Demo/Public（路演默认，数据脱敏）
    partner  - Partner（合作伙伴，部分脱敏）
    admin    - Admin/Internal（内部，全量数据）
    """
    DEMO = "demo"
    PARTNER = "partner"
    ADMIN = "admin"


class RegionScope(str, Enum):
    """
    区域层级（Region Scope）
    
    province - 省级
    district - 区/县级
    """
    PROVINCE = "province"
    DISTRICT = "district"


class Granularity(str, Enum):
    """
    数据粒度（Granularity）
    
    hourly  - 小时级
    daily   - 日级
    weekly  - 周级
    monthly - 月级
    """
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TierLevel(str, Enum):
    """
    风险等级（Tier Level）
    
    tier1 - 一级风险
    tier2 - 二级风险
    tier3 - 三级风险
    """
    TIER1 = "tier1"
    TIER2 = "tier2"
    TIER3 = "tier3"


# ============================================================================
# Common Types
# ============================================================================


class TimeRange(BaseModel):
    """
    时间范围（Time Range）
    
    时间必须使用 UTC ISO 8601 格式
    """
    model_config = ConfigDict(from_attributes=True)
    
    start: datetime = Field(..., description="开始时间（UTC）")
    end: datetime = Field(..., description="结束时间（UTC）")
    
    @field_validator("end")
    @classmethod
    def validate_end_after_start(cls, v: datetime, info) -> datetime:
        if "start" in info.data and v <= info.data["start"]:
            raise ValueError("end must be after start")
        return v


class Region(BaseModel):
    """
    区域（Region）
    
    统一区域编码格式：{country}-{province}[-{district}]
    例如: "CN-11-0101" (中国-北京市-东城区)
    """
    model_config = ConfigDict(from_attributes=True)
    
    code: str = Field(..., description="统一区域编码", min_length=1)
    scope: RegionScope = Field(..., description="区域层级")
    name: str = Field(..., description="区域名称")
    timezone: str = Field(..., description="时区（IANA Time Zone）")
    geometry: Optional[Dict[str, Any]] = Field(None, description="几何边界（GeoJSON）")


class ResponseMetadata(BaseModel):
    """
    响应元数据（Response Metadata）
    
    所有 Data Product 响应必须包含的元数据
    """
    model_config = ConfigDict(from_attributes=True)
    
    trace_id: str = Field(..., description="请求追踪ID")
    correlation_id: Optional[str] = Field(None, description="关联ID")
    access_mode: AccessMode = Field(..., description="访问模式")
    prediction_run_id: Optional[str] = Field(None, description="预测批次ID")
    cache_hit: bool = Field(..., description="是否命中缓存")
    generated_at: datetime = Field(..., description="响应生成时间（UTC）")


class BaseQueryParams(BaseModel):
    """
    统一输入维度（Unified Input Dimensions）
    
    所有 Data Product 请求的必需参数
    """
    model_config = ConfigDict(from_attributes=True)
    
    region_code: str = Field(..., description="统一区域编码", min_length=1)
    time_range: TimeRange = Field(..., description="时间范围（UTC）")
    data_type: DataType = Field(..., description="数据类型")
    weather_type: WeatherType = Field(..., description="天气类型")
    product_id: Optional[str] = Field(None, description="产品ID")
    access_mode: AccessMode = Field(..., description="访问模式")
    prediction_run_id: Optional[str] = Field(None, description="预测批次ID")
    
    @field_validator("prediction_run_id")
    @classmethod
    def validate_prediction_run_id_for_predicted(
        cls, v: Optional[str], info
    ) -> Optional[str]:
        if "data_type" in info.data:
            if info.data["data_type"] == DataType.PREDICTED and not v:
                raise ValueError(
                    "prediction_run_id is required when data_type is 'predicted'"
                )
        return v


class ExtendedQueryParams(BaseQueryParams):
    """
    扩展查询参数（Optional Query Extensions）
    """
    model_config = ConfigDict(from_attributes=True)
    
    region_scope: Optional[RegionScope] = Field(None, description="区域层级")
    region_timezone: Optional[str] = Field(None, description="区域时区")
    granularity: Optional[Granularity] = Field(None, description="数据粒度")
    layer_id: Optional[str] = Field(None, description="地图图层ID")


class ObservabilityContext(BaseModel):
    """
    可观测性字段（Observability Fields）
    """
    model_config = ConfigDict(from_attributes=True)
    
    trace_id: str = Field(..., description="请求追踪ID")
    correlation_id: Optional[str] = Field(None, description="关联ID")
    request_timestamp: datetime = Field(..., description="请求时间（UTC）")


class PaginationParams(BaseModel):
    """
    分页参数（Pagination Params）
    """
    model_config = ConfigDict(from_attributes=True)
    
    page: int = Field(1, ge=1, description="页码（从1开始）")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """
    分页响应（Paginated Response）
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: List[T] = Field(..., description="数据列表")
    total: int = Field(..., ge=0, description="总记录数")
    page: int = Field(..., ge=1, description="当前页码")
    page_size: int = Field(..., ge=1, description="每页数量")
    total_pages: int = Field(..., ge=0, description="总页数")
    has_next: bool = Field(..., description="是否有下一页")
    has_previous: bool = Field(..., description="是否有上一页")
    metadata: ResponseMetadata = Field(..., description="响应元数据")


class ErrorResponse(BaseModel):
    """
    API 错误响应（Error Response）
    """
    model_config = ConfigDict(from_attributes=True)
    
    error_code: str = Field(..., description="错误代码")
    message: str = Field(..., description="错误消息")
    details: Optional[Dict[str, Any]] = Field(None, description="详细信息")
    trace_id: str = Field(..., description="请求追踪ID")
    timestamp: datetime = Field(..., description="时间戳（UTC）")


# ============================================================================
# Series（时间序列）
# ============================================================================


class SeriesDataPoint(BaseModel):
    """
    时间序列数据点
    """
    model_config = ConfigDict(from_attributes=True)
    
    timestamp: datetime = Field(..., description="时间戳（UTC）")
    value: Decimal = Field(..., description="数值")
    unit: str = Field(..., description="单位")


class SeriesResponse(BaseModel):
    """
    时间序列响应
    """
    model_config = ConfigDict(from_attributes=True)
    
    data_type: DataType = Field(..., description="数据类型")
    weather_type: Optional[WeatherType] = Field(None, description="天气类型")
    series: List[SeriesDataPoint] = Field(..., description="时间序列数据")
    metadata: ResponseMetadata = Field(..., description="响应元数据")


class MultiSeriesResponse(BaseModel):
    """
    多序列响应（用于 Timeline 三泳道）
    """
    model_config = ConfigDict(from_attributes=True)
    
    data_type: DataType = Field(..., description="数据类型")
    series: Dict[str, List[SeriesDataPoint]] = Field(
        ..., description="序列数据（按名称分组）"
    )
    metadata: ResponseMetadata = Field(..., description="响应元数据")


# ============================================================================
# Events（事件列表）
# ============================================================================


class EventBase(BaseModel):
    """
    事件基础结构
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: str = Field(..., description="事件ID")
    timestamp: datetime = Field(..., description="事件时间（UTC）")
    region_code: str = Field(..., description="区域编码")
    data_type: DataType = Field(..., description="数据类型")


class RiskEvent(EventBase):
    """
    风险事件（Risk Event）
    """
    model_config = ConfigDict(from_attributes=True)
    
    product_id: str = Field(..., description="产品ID")
    weather_type: WeatherType = Field(..., description="天气类型")
    tier_level: TierLevel = Field(..., description="风险等级")
    trigger_value: Decimal = Field(..., description="触发值")
    threshold_value: Decimal = Field(..., description="阈值")
    unit: str = Field(..., description="单位")
    prediction_run_id: Optional[str] = Field(None, description="预测批次ID")
    rules_hash: Optional[str] = Field(None, description="规则版本或哈希")


class ClaimEvent(EventBase):
    """
    理赔事件（Claim Event）
    """
    model_config = ConfigDict(from_attributes=True)
    
    claim_number: str = Field(..., description="理赔单号")
    policy_id: str = Field(..., description="保单ID")
    risk_event_id: Optional[str] = Field(None, description="关联的风险事件ID")
    tier_level: TierLevel = Field(..., description="风险等级")
    payout_percentage: Decimal = Field(..., description="赔付百分比")
    payout_amount: Optional[Decimal] = Field(None, description="赔付金额")
    status: str = Field(..., description="状态")


class EventsResponse(BaseModel, Generic[T]):
    """
    事件列表响应
    """
    model_config = ConfigDict(from_attributes=True)
    
    events: List[T] = Field(..., description="事件列表")
    total: int = Field(..., ge=0, description="总数")
    metadata: ResponseMetadata = Field(..., description="响应元数据")


# ============================================================================
# Aggregations（聚合结果）
# ============================================================================


class AggregationDimension(BaseModel):
    """
    聚合维度
    """
    model_config = ConfigDict(from_attributes=True)
    
    name: str = Field(..., description="维度名称")
    values: List[str] = Field(..., description="维度值列表")


class KPIMetric(BaseModel):
    """
    KPI 指标
    """
    model_config = ConfigDict(from_attributes=True)
    
    name: str = Field(..., description="指标名称")
    value: Decimal = Field(..., description="当前值")
    unit: Optional[str] = Field(None, description="单位")
    change_percent: Optional[Decimal] = Field(None, description="与上期对比")
    trend: Optional[str] = Field(None, description="趋势方向")


class RankingItem(BaseModel):
    """
    排名项
    """
    model_config = ConfigDict(from_attributes=True)
    
    rank: int = Field(..., ge=1, description="排名")
    entity_id: str = Field(..., description="实体ID")
    entity_name: str = Field(..., description="实体名称")
    value: Decimal = Field(..., description="指标值")
    unit: Optional[str] = Field(None, description="单位")
    percentage: Optional[Decimal] = Field(None, description="占比")


class AggregationResponse(BaseModel):
    """
    聚合响应
    """
    model_config = ConfigDict(from_attributes=True)
    
    dimensions: List[AggregationDimension] = Field(..., description="聚合维度")
    metrics: Dict[str, Decimal] = Field(..., description="指标数据")
    aggregation_scope: str = Field(..., description="聚合范围说明")
    metadata: ResponseMetadata = Field(..., description="响应元数据")


class KPIResponse(BaseModel):
    """
    KPI 响应
    """
    model_config = ConfigDict(from_attributes=True)
    
    kpis: List[KPIMetric] = Field(..., description="KPI 指标列表")
    metadata: ResponseMetadata = Field(..., description="响应元数据")


class RankingResponse(BaseModel):
    """
    排名响应
    """
    model_config = ConfigDict(from_attributes=True)
    
    rankings: List[RankingItem] = Field(..., description="排名列表")
    total: int = Field(..., ge=0, description="总数")
    metadata: ResponseMetadata = Field(..., description="响应元数据")


# ============================================================================
# Data Product 特化类型
# ============================================================================


class L0DashboardResponse(BaseModel):
    """
    L0 Dashboard 响应（省级态势）
    """
    model_config = ConfigDict(from_attributes=True)
    
    kpis: List[KPIMetric] = Field(..., description="KPI 指标")
    rankings: Dict[str, List[RankingItem]] = Field(
        ..., description="Top5 排名（Combined/Policies/Claims）"
    )
    metadata: ResponseMetadata = Field(..., description="响应元数据")


class TimelineLanes(BaseModel):
    """
    统一时间轴（三泳道）
    """
    model_config = ConfigDict(from_attributes=True)
    
    weather: List[SeriesDataPoint] = Field(..., description="天气泳道")
    risk: List[SeriesDataPoint] = Field(..., description="风险泳道")
    claims: List[SeriesDataPoint] = Field(..., description="理赔泳道")


class L1RegionIntelligenceResponse(BaseModel):
    """
    L1 Region Intelligence 响应（区域情报）
    """
    model_config = ConfigDict(from_attributes=True)
    
    overview: List[KPIMetric] = Field(..., description="概览 KPI")
    timeline: TimelineLanes = Field(..., description="统一时间轴（三泳道）")
    trends: Optional[Dict[str, List[SeriesDataPoint]]] = Field(
        None, description="趋势分析"
    )
    metadata: ResponseMetadata = Field(..., description="响应元数据")


class L2EvidenceResponse(BaseModel):
    """
    L2 Evidence 响应（证据链）
    """
    model_config = ConfigDict(from_attributes=True)
    
    risk_events: List[RiskEvent] = Field(..., description="风险事件列表")
    claim_events: List[ClaimEvent] = Field(..., description="理赔事件列表")
    associations: Dict[str, List[str]] = Field(
        ..., description="事件关联（risk_event_id -> claim_event_ids）"
    )
    total: int = Field(..., ge=0, description="总数")
    metadata: ResponseMetadata = Field(..., description="响应元数据")


class LegendInfo(BaseModel):
    """
    图例信息
    """
    model_config = ConfigDict(from_attributes=True)
    
    type: str = Field(..., description="图例类型")
    unit: str = Field(..., description="单位")
    thresholds: Optional[List[Decimal]] = Field(None, description="阈值列表")
    colors: Optional[List[str]] = Field(None, description="颜色列表")


class MapOverlaysResponse(BaseModel):
    """
    Map Overlays 响应（地图叠加层）
    """
    model_config = ConfigDict(from_attributes=True)
    
    layers: Dict[str, Any] = Field(..., description="渲染数据（按图层分组）")
    legend: LegendInfo = Field(..., description="图例信息")
    metadata: ResponseMetadata = Field(..., description="响应元数据")
