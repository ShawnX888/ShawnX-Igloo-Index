"""
时间与时区处理工具函数

提供UTC转换、自然边界对齐、扩展窗口计算等工具。

Reference:
- docs/v2/v2实施细则/04-时间与时区口径统一-细则.md
- docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md
- docs/v2/v2复用逻辑摘录/RD-计算窗口与扩展数据.md

硬规则:
- 存储/传输统一UTC
- 业务判断(per day/month)必须按 region_timezone
- 前端展示时转换，但不影响业务计算
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

from app.schemas.time import (
    CalculationRangeUTC,
    EventTimestamp,
    TimeRangeUTC,
    TimeWindowType,
    TimezoneAlignmentMeta,
)

logger = logging.getLogger(__name__)


# ============================================================================
# 时区转换
# ============================================================================

def utc_to_region_tz(
    utc_time: datetime,
    region_timezone: str
) -> datetime:
    """
    将UTC时间转换为区域时区
    
    Args:
        utc_time: UTC时间
        region_timezone: 区域时区(如: 'Asia/Shanghai')
        
    Returns:
        区域时区的datetime对象
    """
    if utc_time.tzinfo is None:
        # 假设naive datetime是UTC
        utc_time = utc_time.replace(tzinfo=timezone.utc)
    
    region_tz = ZoneInfo(region_timezone)
    return utc_time.astimezone(region_tz)


def region_tz_to_utc(
    region_time: datetime,
    region_timezone: str
) -> datetime:
    """
    将区域时区时间转换为UTC
    
    Args:
        region_time: 区域时区时间
        region_timezone: 区域时区(如: 'Asia/Shanghai')
        
    Returns:
        UTC datetime对象
    """
    if region_time.tzinfo is None:
        # 假设naive datetime是region_timezone
        region_tz = ZoneInfo(region_timezone)
        region_time = region_time.replace(tzinfo=region_tz)
    
    return region_time.astimezone(timezone.utc)


# ============================================================================
# 自然边界对齐 (Business Boundary Alignment)
# ============================================================================

def align_to_natural_day_start(
    utc_time: datetime,
    region_timezone: str
) -> datetime:
    """
    对齐到自然日起始(00:00:00)
    
    业务规则: "per day" 的 "day" 基于 region_timezone
    
    Args:
        utc_time: UTC时间
        region_timezone: 区域时区
        
    Returns:
        该自然日起始时间(UTC)
        
    Example:
        utc_time: 2025-01-20 08:30:00 UTC
        region_timezone: Asia/Shanghai (UTC+8)
        → 北京时间: 2025-01-20 16:30:00 CST
        → 自然日起始: 2025-01-20 00:00:00 CST
        → 转回UTC: 2025-01-19 16:00:00 UTC
    """
    # 转换到区域时区
    region_time = utc_to_region_tz(utc_time, region_timezone)
    
    # 对齐到当天00:00:00
    region_day_start = region_time.replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    
    # 转回UTC
    return region_tz_to_utc(region_day_start, region_timezone)


def align_to_natural_day_end(
    utc_time: datetime,
    region_timezone: str
) -> datetime:
    """
    对齐到自然日结束(23:59:59.999999)
    
    Args:
        utc_time: UTC时间
        region_timezone: 区域时区
        
    Returns:
        该自然日结束时间(UTC)
    """
    # 转换到区域时区
    region_time = utc_to_region_tz(utc_time, region_timezone)
    
    # 对齐到当天23:59:59.999999
    region_day_end = region_time.replace(
        hour=23, minute=59, second=59, microsecond=999999
    )
    
    # 转回UTC
    return region_tz_to_utc(region_day_end, region_timezone)


def align_to_natural_month_start(
    utc_time: datetime,
    region_timezone: str
) -> datetime:
    """
    对齐到自然月起始(1日 00:00:00)
    
    业务规则: "per month" 的 "month" 基于 region_timezone
    
    Args:
        utc_time: UTC时间
        region_timezone: 区域时区
        
    Returns:
        该自然月起始时间(UTC)
    """
    # 转换到区域时区
    region_time = utc_to_region_tz(utc_time, region_timezone)
    
    # 对齐到当月1日00:00:00
    region_month_start = region_time.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    
    # 转回UTC
    return region_tz_to_utc(region_month_start, region_timezone)


def get_natural_date(
    utc_time: datetime,
    region_timezone: str
) -> str:
    """
    获取自然日期字符串 (region_tz视角)
    
    Args:
        utc_time: UTC时间
        region_timezone: 区域时区
        
    Returns:
        自然日期字符串(如: '2025-01-20')
    """
    region_time = utc_to_region_tz(utc_time, region_timezone)
    return region_time.strftime("%Y-%m-%d")


def is_same_natural_day(
    utc_time1: datetime,
    utc_time2: datetime,
    region_timezone: str
) -> bool:
    """
    判断两个UTC时间是否属于同一自然日(region_tz视角)
    
    业务规则: "once per day" 的同一天判断
    
    Args:
        utc_time1: UTC时间1
        utc_time2: UTC时间2
        region_timezone: 区域时区
        
    Returns:
        是否同一天
        
    Example:
        utc_time1: 2025-01-20 08:00:00 UTC
        utc_time2: 2025-01-20 20:00:00 UTC
        region_timezone: Asia/Shanghai (UTC+8)
        → 北京时间: 2025-01-20 16:00:00 vs 2025-01-21 04:00:00
        → 不同天! (跨越了北京时间的午夜)
    """
    date1 = get_natural_date(utc_time1, region_timezone)
    date2 = get_natural_date(utc_time2, region_timezone)
    return date1 == date2


def is_same_natural_month(
    utc_time1: datetime,
    utc_time2: datetime,
    region_timezone: str
) -> bool:
    """
    判断两个UTC时间是否属于同一自然月(region_tz视角)
    
    业务规则: "once per month" 的同一月判断
    """
    region_time1 = utc_to_region_tz(utc_time1, region_timezone)
    region_time2 = utc_to_region_tz(utc_time2, region_timezone)
    
    return (
        region_time1.year == region_time2.year and
        region_time1.month == region_time2.month
    )


# ============================================================================
# 扩展窗口计算
# ============================================================================

def calculate_extended_range(
    time_range: TimeRangeUTC,
    window_type: TimeWindowType,
    window_duration: Optional[int] = None
) -> CalculationRangeUTC:
    """
    计算扩展窗口
    
    用途: 为了保证边界完整性，需要回溯更多数据
    
    Reference: RD-计算窗口与扩展数据.md
    
    Args:
        time_range: 展示窗口(UTC)
        window_type: 窗口类型
        window_duration: 窗口持续时间(如: 7天, 4小时)
        
    Returns:
        包含扩展的计算窗口
        
    Example:
        time_range: 2025-01-20 00:00 ~ 2025-01-27 23:59 (UTC)
        window_type: daily, duration: 7天
        → 需要从 2025-01-13 开始(提前7天) 才能计算 2025-01-20 的"过去7天累计"
    """
    if window_duration is None:
        window_duration = 0

    # 确保 start/end 都是 UTC aware（naive 视为 UTC）
    display_start = (
        time_range.start.replace(tzinfo=timezone.utc)
        if time_range.start.tzinfo is None
        else time_range.start
    )
    display_end = (
        time_range.end.replace(tzinfo=timezone.utc)
        if time_range.end.tzinfo is None
        else time_range.end
    )

    if window_type == TimeWindowType.HOURLY:
        # hourly：按 UTC 连续回溯，无需自然边界对齐
        calculation_start = display_start - timedelta(hours=window_duration)
    elif window_type in (TimeWindowType.DAILY, TimeWindowType.WEEKLY):
        # daily/weekly：先按天/周回溯，再对齐到 region_timezone 的自然日边界
        if not time_range.region_timezone:
            raise ValueError("region_timezone is required for daily/weekly extended range")

        if window_type == TimeWindowType.DAILY:
            base_start = display_start - timedelta(days=window_duration)
        else:
            base_start = display_start - timedelta(weeks=window_duration)

        calculation_start = align_to_natural_day_start(base_start, time_range.region_timezone)
    elif window_type == TimeWindowType.MONTHLY:
        # monthly：对齐到 region_timezone 的自然月起始（按月回溯 N 个月）
        if not time_range.region_timezone:
            raise ValueError("region_timezone is required for monthly extended range")

        region_tz = ZoneInfo(time_range.region_timezone)
        region_display_start = utc_to_region_tz(display_start, time_range.region_timezone)
        # 回溯 window_duration 个月，并对齐到目标月 1 日 00:00:00
        total_months = (region_display_start.year * 12 + (region_display_start.month - 1)) - window_duration
        target_year = total_months // 12
        target_month = (total_months % 12) + 1
        region_month_start = datetime(
            year=target_year,
            month=target_month,
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
            tzinfo=region_tz,
        )
        calculation_start = region_tz_to_utc(region_month_start, time_range.region_timezone)
    else:
        calculation_start = display_start

    extension_hours = (display_start - calculation_start).total_seconds() / 3600

    return CalculationRangeUTC(
        calculation_start=calculation_start,
        calculation_end=display_end,
        display_start=display_start,
        display_end=display_end,
        extension_hours=extension_hours,
    )


# ============================================================================
# 时间口径验证
# ============================================================================

def validate_time_boundaries_aligned(
    time_range: TimeRangeUTC,
    window_type: TimeWindowType
) -> Tuple[bool, Optional[str]]:
    """
    验证时间边界是否正确对齐
    
    规则:
    - hourly: 无需对齐
    - daily: 必须对齐到 region_timezone 的自然日边界
    - weekly/monthly: 同理
    
    Args:
        time_range: 时间范围
        window_type: 窗口类型
        
    Returns:
        (是否对齐, 错误信息)
    """
    if window_type == TimeWindowType.HOURLY:
        # hourly不需要自然边界对齐
        return True, None
    
    if not time_range.region_timezone:
        return False, "region_timezone is required for natural boundary alignment"
    
    # 检查start是否对齐到自然日起始
    if window_type in (TimeWindowType.DAILY, TimeWindowType.WEEKLY, TimeWindowType.MONTHLY):
        aligned_start = align_to_natural_day_start(
            time_range.start,
            time_range.region_timezone
        )
        
        if time_range.start != aligned_start:
            return False, (
                f"time_range.start is not aligned to natural day start. "
                f"Expected: {aligned_start.isoformat()}, "
                f"Got: {time_range.start.isoformat()}"
            )
    
    return True, None


# ============================================================================
# Event Timestamp 创建辅助
# ============================================================================

def create_event_timestamp(
    utc_time: datetime,
    region_timezone: str,
    include_display: bool = True
) -> EventTimestamp:
    """
    创建标准的事件时间戳
    
    Args:
        utc_time: UTC时间
        region_timezone: 区域时区
        include_display: 是否包含展示字段
        
    Returns:
        EventTimestamp对象
    """
    natural_date = get_natural_date(utc_time, region_timezone) if include_display else None
    
    natural_datetime_display = None
    if include_display:
        region_time = utc_to_region_tz(utc_time, region_timezone)
        # 格式: 2025-01-20 14:30:00 CST
        tz_abbr = region_time.strftime("%Z")
        natural_datetime_display = f"{region_time.strftime('%Y-%m-%d %H:%M:%S')} {tz_abbr}"
    
    return EventTimestamp(
        event_time_utc=utc_time,
        region_timezone=region_timezone,
        natural_date=natural_date,
        natural_datetime_display=natural_datetime_display
    )


# ============================================================================
# 时区信息获取 (简化版)
# ============================================================================

# 中国省份 → 时区映射 (简化版)
CHINA_PROVINCE_TIMEZONES = {
    "CN-GD": "Asia/Shanghai",  # 广东
    "CN-BJ": "Asia/Shanghai",  # 北京
    "CN-SH": "Asia/Shanghai",  # 上海
    "CN-XJ": "Asia/Urumqi",    # 新疆 (UTC+6)
    "CN-XZ": "Asia/Shanghai",  # 西藏 (虽然实际可能用UTC+6，但官方统一用东八区)
    # TODO: 完善其他省份
}


def get_timezone_for_region(region_code: str) -> str:
    """
    根据区域代码获取时区
    
    简化版: 从静态映射表查询
    未来: 从数据库region表查询或调用地理服务
    
    Args:
        region_code: 区域代码(如: 'CN-GD')
        
    Returns:
        时区字符串(如: 'Asia/Shanghai')
        
    Raises:
        ValueError: 如果区域代码无效
    """
    timezone = CHINA_PROVINCE_TIMEZONES.get(region_code)
    if not timezone:
        # 默认使用东八区
        logger.warning(
            f"Timezone not found for region: {region_code}, using default Asia/Shanghai",
            extra={"region_code": region_code}
        )
        return "Asia/Shanghai"
    
    return timezone


def validate_timezone(timezone_str: str) -> bool:
    """
    验证时区字符串是否有效
    
    Args:
        timezone_str: 时区字符串
        
    Returns:
        是否有效
    """
    try:
        ZoneInfo(timezone_str)
        return True
    except Exception:
        return False


# ============================================================================
# 业务边界计算 (自然日/月窗口)
# ============================================================================

def get_natural_day_range(
    reference_time: datetime,
    region_timezone: str
) -> Tuple[datetime, datetime]:
    """
    获取包含reference_time的自然日范围(UTC)
    
    业务规则: "once per day" 的同一天范围
    
    Args:
        reference_time: 参考时间(UTC)
        region_timezone: 区域时区
        
    Returns:
        (day_start_utc, day_end_utc)
        
    Example:
        reference_time: 2025-01-20 08:30:00 UTC
        region_timezone: Asia/Shanghai
        → 北京时间: 2025-01-20 16:30:00 CST
        → 自然日范围(CST): 2025-01-20 00:00:00 ~ 23:59:59.999999
        → 转回UTC: 2025-01-19 16:00:00 ~ 2025-01-20 15:59:59.999999
    """
    day_start = align_to_natural_day_start(reference_time, region_timezone)
    day_end = align_to_natural_day_end(reference_time, region_timezone)
    
    return day_start, day_end


def get_natural_month_range(
    reference_time: datetime,
    region_timezone: str
) -> Tuple[datetime, datetime]:
    """
    获取包含reference_time的自然月范围(UTC)
    
    业务规则: "once per month" 的同一月范围
    
    Args:
        reference_time: 参考时间(UTC)
        region_timezone: 区域时区
        
    Returns:
        (month_start_utc, month_end_utc)
    """
    month_start = align_to_natural_month_start(reference_time, region_timezone)
    
    # 计算月末: 下个月1日的前一秒
    region_time = utc_to_region_tz(reference_time, region_timezone)
    
    # 下个月1日
    if region_time.month == 12:
        next_month = region_time.replace(year=region_time.year + 1, month=1, day=1)
    else:
        next_month = region_time.replace(month=region_time.month + 1, day=1)
    
    next_month = next_month.replace(hour=0, minute=0, second=0, microsecond=0)
    next_month_utc = region_tz_to_utc(next_month, region_timezone)
    
    # 月末 = 下月1日 - 1微秒
    month_end = next_month_utc - timedelta(microseconds=1)
    
    return month_start, month_end


def align_to_natural_month_start(
    utc_time: datetime,
    region_timezone: str
) -> datetime:
    """对齐到自然月起始(1日 00:00:00)"""
    region_time = utc_to_region_tz(utc_time, region_timezone)
    region_month_start = region_time.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    return region_tz_to_utc(region_month_start, region_timezone)


# ============================================================================
# 扩展窗口辅助
# ============================================================================

def create_timezone_alignment_meta(
    region_timezone: str,
    window_type: TimeWindowType,
    time_range: Optional[TimeRangeUTC] = None
) -> TimezoneAlignmentMeta:
    """
    创建时区对齐元信息
    
    用于在响应Meta/Legend中说明时间口径
    
    Args:
        region_timezone: 区域时区
        window_type: 窗口类型
        time_range: 时间范围(可选)
        
    Returns:
        TimezoneAlignmentMeta对象
    """
    alignment_applied = window_type in (
        TimeWindowType.DAILY,
        TimeWindowType.WEEKLY,
        TimeWindowType.MONTHLY
    )
    
    alignment_details = None
    if alignment_applied and time_range:
        # 生成对齐说明
        region_start = utc_to_region_tz(time_range.start, region_timezone)
        aligned_start = align_to_natural_day_start(time_range.start, region_timezone)
        
        alignment_details = (
            f"自然日边界对齐: "
            f"{region_start.strftime('%Y-%m-%d %H:%M:%S %Z')} → "
            f"{aligned_start.isoformat()}"
        )
    
    return TimezoneAlignmentMeta(
        region_timezone=region_timezone,
        alignment_applied=alignment_applied,
        time_window_type=window_type,
        alignment_details=alignment_details
    )
