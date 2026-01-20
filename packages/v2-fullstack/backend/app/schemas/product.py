"""
Product Schemas (产品配置)

定义产品相关的Pydantic schemas:
- ProductBase: 基础信息
- ProductCreate: 创建请求
- Product: 完整产品信息
- ProductList: 产品列表(用于Product Selector)

Reference:
- docs/v2/v2实施细则/05-产品表与Product-Service-细则.md
- docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md

硬规则:
- riskRules 与 payoutRules 职责隔离
- weather_type 必须与 riskRules 一致
- 规则必须可追溯版本
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.shared import WeatherType


# ============================================================================
# Risk Rules (风险规则)
# ============================================================================

class TimeWindow(BaseModel):
    """
    时间窗口配置
    
    定义风险计算的时间窗口参数
    """
    model_config = ConfigDict(from_attributes=True)
    
    type: str = Field(
        ...,
        description="窗口类型 (hourly/daily/weekly/monthly)",
        examples=["hourly", "daily", "weekly", "monthly"]
    )
    size: int = Field(
        ...,
        ge=1,
        description="窗口大小 (如: 7表示7天)"
    )
    step: Optional[int] = Field(
        None,
        ge=1,
        description="滑动步长 (可选, 用于滑动窗口)"
    )


class Thresholds(BaseModel):
    """
    阈值配置
    
    定义三档风险阈值
    
    注意: 阈值的顺序由operator决定
    - operator ">=" 时, thresholds应递增 (如: 50, 100, 150)
    - operator "<=" 时, thresholds应递减 (如: 10, 5, 0)
    
    validator在ProductCreate层面根据operator验证
    """
    model_config = ConfigDict(from_attributes=True)
    
    tier1: Decimal = Field(..., description="一级阈值")
    tier2: Decimal = Field(..., description="二级阈值")
    tier3: Decimal = Field(..., description="三级阈值")


class Calculation(BaseModel):
    """
    计算规则配置
    
    定义如何聚合和比较天气数据
    """
    model_config = ConfigDict(from_attributes=True)
    
    aggregation: str = Field(
        ...,
        description="聚合方式 (sum/avg/max/min)",
        examples=["sum", "avg", "max", "min"]
    )
    operator: str = Field(
        ...,
        description="比较运算符 (>=, >, <=, <, ==)",
        examples=[">=", ">", "<=", "<", "=="]
    )
    unit: str = Field(
        ...,
        description="单位 (mm/celsius/km_h)",
        examples=["mm", "celsius", "km_h"]
    )


class RiskRules(BaseModel):
    """
    风险规则 (产品级)
    
    用于风险事件计算与可视化
    
    硬规则:
    - 只用于 risk_events 触发
    - 不包含赔付金额信息
    """
    model_config = ConfigDict(from_attributes=True)
    
    time_window: TimeWindow = Field(..., description="时间窗口配置")
    thresholds: Thresholds = Field(..., description="阈值配置")
    calculation: Calculation = Field(..., description="计算规则配置")
    weather_type: WeatherType = Field(..., description="天气类型 (必须与products.weather_type一致)")


# ============================================================================
# Payout Rules (赔付规则)
# ============================================================================

class PayoutPercentages(BaseModel):
    """赔付百分比配置"""
    model_config = ConfigDict(from_attributes=True)
    
    tier1: Decimal = Field(..., ge=0, le=100, description="一级赔付百分比 (%)")
    tier2: Decimal = Field(..., ge=0, le=100, description="二级赔付百分比 (%)")
    tier3: Decimal = Field(..., ge=0, le=100, description="三级赔付百分比 (%)")
    
    @field_validator("tier2")
    @classmethod
    def validate_tier2_greater_than_tier1(cls, v: Decimal, info) -> Decimal:
        if "tier1" in info.data and v <= info.data["tier1"]:
            raise ValueError("tier2 payout must be greater than tier1")
        return v
    
    @field_validator("tier3")
    @classmethod
    def validate_tier3_greater_than_tier2(cls, v: Decimal, info) -> Decimal:
        if "tier2" in info.data and v <= info.data["tier2"]:
            raise ValueError("tier3 payout must be greater than tier2")
        return v


class PayoutRules(BaseModel):
    """
    赔付规则 (保单级)
    
    用于理赔计算
    
    硬规则:
    - 赔付频次限制按 policy.region_timezone 判断
    - predicted 不生成正式 claims
    """
    model_config = ConfigDict(from_attributes=True)
    
    frequency_limit: str = Field(
        ...,
        description="赔付频次限制 (如: once_per_day_per_policy, once_per_month_per_policy)",
        examples=["once_per_day_per_policy", "once_per_month_per_policy"]
    )
    payout_percentages: PayoutPercentages = Field(..., description="赔付百分比配置")
    total_cap: Decimal = Field(
        ...,
        ge=0,
        le=100,
        description="总赔付上限 (%)"
    )


# ============================================================================
# Product Schemas
# ============================================================================

class ProductBase(BaseModel):
    """产品基础信息"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="产品ID",
        examples=["daily_rainfall", "weekly_wind"]
    )
    name: str = Field(..., min_length=1, max_length=100, description="产品名称")
    type: str = Field(..., description="产品类型", examples=["daily", "weekly", "monthly"])
    weather_type: WeatherType = Field(..., description="天气类型")
    description: Optional[str] = Field(None, description="产品描述")
    icon: Optional[str] = Field(None, description="产品图标标识")
    version: str = Field(default="v1.0.0", description="产品配置版本")
    is_active: bool = Field(default=True, description="是否启用")


class ProductCreate(ProductBase):
    """创建产品的请求"""
    risk_rules: RiskRules = Field(..., description="风险规则")
    payout_rules: PayoutRules = Field(..., description="赔付规则")
    
    @field_validator("risk_rules")
    @classmethod
    def validate_risk_rules_weather_type(cls, v: RiskRules, info) -> RiskRules:
        """验证 riskRules.weatherType 与 products.weather_type 一致"""
        if "weather_type" in info.data:
            product_weather_type = info.data["weather_type"]
            if v.weather_type.value != product_weather_type.value:
                raise ValueError(
                    f"riskRules.weatherType ({v.weather_type.value}) must match "
                    f"products.weather_type ({product_weather_type.value})"
                )
        return v


class ProductUpdate(BaseModel):
    """更新产品"""
    model_config = ConfigDict(from_attributes=True)
    
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    risk_rules: Optional[RiskRules] = None
    payout_rules: Optional[PayoutRules] = None
    version: Optional[str] = None
    is_active: Optional[bool] = None


class Product(ProductBase):
    """
    完整产品信息
    
    包含 riskRules 和 payoutRules
    
    注意: payoutRules 可能根据 access_mode 被裁剪
    """
    risk_rules: RiskRules = Field(..., description="风险规则")
    payout_rules: Optional[PayoutRules] = Field(
        None,
        description="赔付规则 (可能根据access_mode被裁剪)"
    )
    created_at: datetime = Field(..., description="创建时间(UTC)")
    updated_at: datetime = Field(..., description="更新时间(UTC)")


class ProductListItem(BaseModel):
    """
    产品列表项 (简化版, 用于 Product Selector)
    
    不包含完整的 rules，只包含展示必要信息
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: str = Field(..., description="产品ID")
    name: str = Field(..., description="产品名称")
    type: str = Field(..., description="产品类型")
    weather_type: WeatherType = Field(..., description="天气类型")
    icon: Optional[str] = Field(None, description="产品图标")
    description: Optional[str] = Field(None, description="产品描述")
    version: str = Field(..., description="产品配置版本")
    is_active: bool = Field(..., description="是否启用")
    
    # 简化的阈值信息 (用于快速展示)
    thresholds_summary: Optional[Dict[str, Decimal]] = Field(
        None,
        description="阈值摘要 (如: {'tier1': 50, 'tier2': 100, 'tier3': 150})"
    )


class ProductListResponse(BaseModel):
    """产品列表响应"""
    model_config = ConfigDict(from_attributes=True)
    
    products: List[ProductListItem] = Field(..., description="产品列表")
    total: int = Field(..., description="总数")
    filtered_by_weather_type: Optional[WeatherType] = Field(
        None,
        description="按天气类型过滤 (如有)"
    )


# ============================================================================
# Product Query Filter
# ============================================================================

class ProductFilter(BaseModel):
    """产品查询过滤器"""
    model_config = ConfigDict(from_attributes=True)
    
    weather_type: Optional[WeatherType] = Field(None, description="按天气类型过滤")
    type: Optional[str] = Field(None, description="按产品类型过滤")
    is_active: Optional[bool] = Field(
        True,
        description="是否只返回启用的产品 (默认true)"
    )
