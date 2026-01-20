"""
时间与时区统一口径 Schema

本模块定义v2时间三层口径:
- Storage & Transport: UTC (DB TIMESTAMPTZ, API timestamps)
- Business Boundary: region_timezone (自然日/月边界对齐)
- Presentation: user local timezone (UI展示)

Reference:
- docs/v2/v2实施细则/04-时间与时区口径统一-细则.md
- docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md
- docs/v2/v2复用逻辑摘录/RD-计算窗口与扩展数据.md

硬规则:
- 存储/传输统一UTC
- 业务判断(per day/month)必须按 region_timezone
- 前端展示时转换，但不影响业务计算
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# Enums
# ============================================================================

class TimeWindowType(str, Enum):
    """
    时间窗口类型
    
    对应产品规则中的 timeWindow
    Reference: RD-产品库与规则契约.md
    """
    HOURLY = "hourly"      # 小时级: 按UTC连续回溯，无需自然边界
    DAILY = "daily"        # 日级: 边界对齐到 region_timezone 自然日
    WEEKLY = "weekly"      # 周级: 边界对齐到 region_timezone 自然周
    MONTHLY = "monthly"    # 月级: 边界对齐到 region_timezone 自然月


class TimeGranularity(str, Enum):
    """时间粒度"""
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


# ============================================================================
# Time Range (展示窗口)
# ============================================================================

class TimeRangeUTC(BaseModel):
    """
    时间范围 (UTC)
    
    用途: Data Product请求的展示窗口
    
    规则:
    - start/end 都是 UTC
    - end 必须晚于 start
    - 可选包含 region_timezone 用于业务边界对齐
    """
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "start": "2025-01-01T00:00:00Z",
                "end": "2025-01-31T23:59:59Z",
                "region_timezone": "Asia/Shanghai"
            }
        }
    )
    
    start: datetime = Field(
        ...,
        description="起始时间(UTC)"
    )
    end: datetime = Field(
        ...,
        description="结束时间(UTC)"
    )
    region_timezone: Optional[str] = Field(
        None,
        description="区域时区(如Asia/Shanghai,用于业务边界对齐)",
        examples=["Asia/Shanghai", "America/New_York", "Europe/London"]
    )
    
    @field_validator("end")
    @classmethod
    def validate_end_after_start(cls, v: datetime, info) -> datetime:
        if "start" in info.data and v <= info.data["start"]:
            raise ValueError("end must be after start")
        return v
    
    def duration_hours(self) -> float:
        """计算时间范围的小时数"""
        return (self.end - self.start).total_seconds() / 3600
    
    def duration_days(self) -> float:
        """计算时间范围的天数"""
        return (self.end - self.start).total_seconds() / 86400


# ============================================================================
# Calculation Range (计算窗口 - 含扩展)
# ============================================================================

class CalculationRangeUTC(BaseModel):
    """
    计算窗口 (UTC, 包含扩展)
    
    用途: 后端计算时可能需要扩展窗口以保证边界完整性
    
    规则:
    - calculation_start <= time_range.start
    - calculation_end >= time_range.end
    - 输出必须裁剪回 time_range
    
    Reference: RD-计算窗口与扩展数据.md
    """
    model_config = ConfigDict(from_attributes=True)
    
    calculation_start: datetime = Field(
        ...,
        description="计算起始时间(UTC,可能早于展示窗口)"
    )
    calculation_end: datetime = Field(
        ...,
        description="计算结束时间(UTC)"
    )
    display_start: datetime = Field(
        ...,
        description="展示起始时间(UTC,用户请求的time_range.start)"
    )
    display_end: datetime = Field(
        ...,
        description="展示结束时间(UTC,用户请求的time_range.end)"
    )
    extension_hours: Optional[float] = Field(
        None,
        description="起始扩展的小时数"
    )
    
    @field_validator("calculation_start")
    @classmethod
    def validate_calculation_before_display(cls, v: datetime, info) -> datetime:
        if "display_start" in info.data and v > info.data["display_start"]:
            raise ValueError("calculation_start must be <= display_start")
        return v


# ============================================================================
# 时区对齐元信息
# ============================================================================

class TimezoneAlignmentMeta(BaseModel):
    """
    时区对齐元信息
    
    用途: 在Meta/Legend中说明时间口径
    
    包含:
    - region_timezone: 业务边界时区
    - alignment_applied: 是否进行了自然边界对齐
    - alignment_details: 对齐细节(可选,用于排障)
    """
    model_config = ConfigDict(from_attributes=True)
    
    region_timezone: str = Field(
        ...,
        description="区域时区(业务边界)",
        examples=["Asia/Shanghai", "America/New_York"]
    )
    alignment_applied: bool = Field(
        default=False,
        description="是否进行了自然边界对齐(daily/weekly/monthly)"
    )
    time_window_type: Optional[TimeWindowType] = Field(
        None,
        description="时间窗口类型"
    )
    alignment_details: Optional[str] = Field(
        None,
        description="对齐细节(如: '自然日边界: 2025-01-20 00:00 CST → 2025-01-19 16:00 UTC')"
    )


# ============================================================================
# 事件时间标准格式
# ============================================================================

class EventTimestamp(BaseModel):
    """
    事件时间戳 (标准格式)
    
    用途: 统一事件类数据的时间字段
    
    包含:
    - event_time_utc: 权威时间(UTC)
    - region_timezone: 事件发生地时区
    - natural_date: 自然日期(region_tz视角,可选)
    """
    model_config = ConfigDict(from_attributes=True)
    
    event_time_utc: datetime = Field(
        ...,
        description="事件时间(UTC,权威字段)"
    )
    region_timezone: str = Field(
        ...,
        description="事件发生地时区"
    )
    natural_date: Optional[str] = Field(
        None,
        description="自然日期(region_tz视角,如'2025-01-20',用于UI展示)",
        examples=["2025-01-20"]
    )
    natural_datetime_display: Optional[str] = Field(
        None,
        description="自然日期时间(region_tz视角,如'2025-01-20 14:30:00 CST')",
        examples=["2025-01-20 14:30:00 CST"]
    )


# ============================================================================
# 时间口径验证
# ============================================================================

class TimeConsistencyCheck(BaseModel):
    """
    时间口径一致性检查结果
    
    用于验证L0/L1/L2是否使用了一致的时间边界
    """
    model_config = ConfigDict(from_attributes=True)
    
    consistent: bool = Field(..., description="是否一致")
    time_range_utc: TimeRangeUTC = Field(..., description="检查的时间范围")
    region_timezone: str = Field(..., description="区域时区")
    
    # 检查的数据产品及其时间边界
    data_products: dict[str, tuple[datetime, datetime]] = Field(
        ...,
        description="数据产品 → (start, end) 映射"
    )
    
    inconsistent_products: Optional[list[str]] = Field(
        None,
        description="时间边界不一致的数据产品"
    )
    recommendation: Optional[str] = Field(
        None,
        description="修复建议"
    )


# ============================================================================
# Per Day/Month 规则元信息
# ============================================================================

class FrequencyLimitMeta(BaseModel):
    """
    频次限制元信息
    
    用于解释"once per day/month"等规则的时区语义
    
    示例:
    - "once per day per policy" 的 "day" 基于 policy.region_timezone
    """
    model_config = ConfigDict(from_attributes=True)
    
    frequency_type: str = Field(
        ...,
        description="频次类型(如: 'once_per_day', 'once_per_month')",
        examples=["once_per_day", "once_per_week", "once_per_month"]
    )
    period_boundary: str = Field(
        ...,
        description="周期边界(如: 'natural_day', 'natural_month')"
    )
    boundary_timezone: str = Field(
        ...,
        description="边界时区(如: 'Asia/Shanghai')"
    )
    example_explanation: Optional[str] = Field(
        None,
        description="示例说明(如: '北京时间2025-01-20 00:00:00对应UTC 2025-01-19 16:00:00')"
    )
