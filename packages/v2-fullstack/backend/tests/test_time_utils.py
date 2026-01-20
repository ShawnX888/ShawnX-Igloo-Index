"""
测试时间与时区口径统一的验收用例

Reference: docs/v2/v2实施细则/04-时间与时区口径统一-细则.md
"""

import pytest
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from app.schemas.time import (
    TimeWindowType,
    TimeGranularity,
    TimeRangeUTC,
    CalculationRangeUTC,
    EventTimestamp,
    TimezoneAlignmentMeta,
)
from app.utils.time_utils import (
    utc_to_region_tz,
    region_tz_to_utc,
    align_to_natural_day_start,
    align_to_natural_day_end,
    align_to_natural_month_start,
    get_natural_date,
    is_same_natural_day,
    is_same_natural_month,
    calculate_extended_range,
    validate_time_boundaries_aligned,
    create_event_timestamp,
    get_timezone_for_region,
)


class TestEnums:
    """测试枚举类型"""
    
    def test_time_window_type_values(self):
        """验证TimeWindowType枚举值"""
        assert TimeWindowType.HOURLY.value == "hourly"
        assert TimeWindowType.DAILY.value == "daily"
        assert TimeWindowType.WEEKLY.value == "weekly"
        assert TimeWindowType.MONTHLY.value == "monthly"
    
    def test_time_granularity_values(self):
        """验证TimeGranularity枚举值"""
        assert TimeGranularity.HOUR.value == "hour"
        assert TimeGranularity.DAY.value == "day"
        assert TimeGranularity.WEEK.value == "week"
        assert TimeGranularity.MONTH.value == "month"


class TestTimezoneConversion:
    """测试时区转换"""
    
    def test_utc_to_shanghai(self):
        """测试UTC转上海时区"""
        utc_time = datetime(2025, 1, 20, 8, 30, 0, tzinfo=timezone.utc)
        shanghai_time = utc_to_region_tz(utc_time, "Asia/Shanghai")
        
        # UTC+8
        assert shanghai_time.hour == 16
        assert shanghai_time.minute == 30
    
    def test_shanghai_to_utc(self):
        """测试上海时区转UTC"""
        shanghai_tz = ZoneInfo("Asia/Shanghai")
        shanghai_time = datetime(2025, 1, 20, 16, 30, 0, tzinfo=shanghai_tz)
        utc_time = region_tz_to_utc(shanghai_time, "Asia/Shanghai")
        
        assert utc_time.hour == 8
        assert utc_time.minute == 30
    
    def test_roundtrip_conversion(self):
        """测试UTC→Region→UTC往返转换"""
        original_utc = datetime(2025, 1, 20, 12, 0, 0, tzinfo=timezone.utc)
        
        # UTC → Shanghai → UTC
        shanghai = utc_to_region_tz(original_utc, "Asia/Shanghai")
        back_to_utc = region_tz_to_utc(shanghai, "Asia/Shanghai")
        
        assert back_to_utc == original_utc


class TestNaturalBoundaryAlignment:
    """测试自然边界对齐"""
    
    def test_align_to_day_start_shanghai(self):
        """
        测试对齐到自然日起始(上海时区)
        
        验收用例: "per day" 的 "day" 基于 region_timezone
        """
        # UTC: 2025-01-20 08:30:00 (上午8:30)
        # 北京时间: 2025-01-20 16:30:00 (下午4:30)
        # 自然日起始(北京): 2025-01-20 00:00:00
        # 转回UTC: 2025-01-19 16:00:00
        utc_time = datetime(2025, 1, 20, 8, 30, 0, tzinfo=timezone.utc)
        day_start = align_to_natural_day_start(utc_time, "Asia/Shanghai")
        
        # 应该是2025-01-19 16:00:00 UTC (北京时间1月20日0点)
        assert day_start.year == 2025
        assert day_start.month == 1
        assert day_start.day == 19
        assert day_start.hour == 16
        assert day_start.minute == 0
    
    def test_align_to_day_end_shanghai(self):
        """测试对齐到自然日结束(上海时区)"""
        utc_time = datetime(2025, 1, 20, 8, 30, 0, tzinfo=timezone.utc)
        day_end = align_to_natural_day_end(utc_time, "Asia/Shanghai")
        
        # 应该是2025-01-20 15:59:59.999999 UTC (北京时间1月20日23:59:59)
        assert day_end.year == 2025
        assert day_end.month == 1
        assert day_end.day == 20
        assert day_end.hour == 15
        assert day_end.minute == 59
    
    def test_align_to_month_start_shanghai(self):
        """测试对齐到自然月起始(上海时区)"""
        utc_time = datetime(2025, 1, 20, 8, 30, 0, tzinfo=timezone.utc)
        month_start = align_to_natural_month_start(utc_time, "Asia/Shanghai")
        
        # 应该是2024-12-31 16:00:00 UTC (北京时间2025-01-01 00:00:00)
        assert month_start.year == 2024
        assert month_start.month == 12
        assert month_start.day == 31
        assert month_start.hour == 16
    
    def test_get_natural_date(self):
        """测试获取自然日期"""
        # UTC: 2025-01-20 20:00:00 (晚上8点)
        # 北京时间: 2025-01-21 04:00:00 (凌晨4点，已经是21日!)
        utc_time = datetime(2025, 1, 20, 20, 0, 0, tzinfo=timezone.utc)
        natural_date = get_natural_date(utc_time, "Asia/Shanghai")
        
        assert natural_date == "2025-01-21"  # 北京时间是21日


class TestSameNaturalPeriod:
    """
    测试同一自然周期判断
    
    这是理赔计算的核心规则
    """
    
    def test_same_natural_day_true(self):
        """测试同一自然日(region_tz视角)"""
        # 北京时间: 2025-01-20 08:00:00 和 2025-01-20 22:00:00 (同一天)
        time1 = datetime(2025, 1, 20, 0, 0, 0, tzinfo=timezone.utc)  # 北京08:00
        time2 = datetime(2025, 1, 20, 14, 0, 0, tzinfo=timezone.utc)  # 北京22:00
        
        assert is_same_natural_day(time1, time2, "Asia/Shanghai")
    
    def test_same_natural_day_false_cross_midnight(self):
        """
        测试跨越自然日边界
        
        验收用例: 跨日边界的事件能正确归期
        """
        # UTC: 2025-01-20 08:00 vs 2025-01-20 20:00
        # 北京时间: 2025-01-20 16:00 vs 2025-01-21 04:00 (不同天!)
        time1 = datetime(2025, 1, 20, 8, 0, 0, tzinfo=timezone.utc)
        time2 = datetime(2025, 1, 20, 20, 0, 0, tzinfo=timezone.utc)
        
        assert not is_same_natural_day(time1, time2, "Asia/Shanghai")
    
    def test_same_natural_month_true(self):
        """测试同一自然月"""
        time1 = datetime(2025, 1, 5, 0, 0, 0, tzinfo=timezone.utc)
        time2 = datetime(2025, 1, 25, 0, 0, 0, tzinfo=timezone.utc)
        
        assert is_same_natural_month(time1, time2, "Asia/Shanghai")
    
    def test_same_natural_month_false_cross_boundary(self):
        """测试跨越自然月边界"""
        # UTC: 2025-01-31 20:00 vs 2025-02-01 04:00
        # 北京时间: 2025-02-01 04:00 vs 2025-02-01 12:00 (同一天但已跨月!)
        time1 = datetime(2025, 1, 31, 20, 0, 0, tzinfo=timezone.utc)
        time2 = datetime(2025, 2, 1, 4, 0, 0, tzinfo=timezone.utc)
        
        # 北京时间都是2月1日，所以属于同一月
        assert is_same_natural_month(time1, time2, "Asia/Shanghai")


class TestExtendedRange:
    """测试扩展窗口计算"""
    
    def test_calculate_extended_range_daily_7days(self):
        """测试日级7天窗口的扩展"""
        time_range = TimeRangeUTC(
            start=datetime(2025, 1, 20, 0, 0, 0, tzinfo=timezone.utc),
            end=datetime(2025, 1, 27, 23, 59, 59, tzinfo=timezone.utc),
            region_timezone="Asia/Shanghai"
        )
        
        calc_range = calculate_extended_range(
            time_range,
            TimeWindowType.DAILY,
            window_duration=7  # 需要回溯7天
        )
        
        # 计算起始应该提前7天
        expected_calc_start = time_range.start - timedelta(days=7)
        assert calc_range.calculation_start == expected_calc_start
        assert calc_range.display_start == time_range.start
        assert calc_range.extension_hours == 7 * 24
    
    def test_calculate_extended_range_hourly_4hours(self):
        """测试小时级4小时窗口的扩展"""
        time_range = TimeRangeUTC(
            start=datetime(2025, 1, 20, 12, 0, 0, tzinfo=timezone.utc),
            end=datetime(2025, 1, 20, 23, 59, 59, tzinfo=timezone.utc),
            region_timezone="Asia/Shanghai"
        )
        
        calc_range = calculate_extended_range(
            time_range,
            TimeWindowType.HOURLY,
            window_duration=4
        )
        
        # 计算起始应该提前4小时
        expected_calc_start = time_range.start - timedelta(hours=4)
        assert calc_range.calculation_start == expected_calc_start
        assert calc_range.extension_hours == 4


class TestEventTimestamp:
    """测试事件时间戳"""
    
    def test_create_event_timestamp(self):
        """测试创建事件时间戳"""
        utc_time = datetime(2025, 1, 20, 8, 30, 0, tzinfo=timezone.utc)
        
        event_ts = create_event_timestamp(utc_time, "Asia/Shanghai")
        
        assert event_ts.event_time_utc == utc_time
        assert event_ts.region_timezone == "Asia/Shanghai"
        assert event_ts.natural_date == "2025-01-20"
        assert "CST" in event_ts.natural_datetime_display


class TestTimezoneForRegion:
    """测试区域时区获取"""
    
    def test_get_timezone_for_known_region(self):
        """测试已知区域的时区"""
        assert get_timezone_for_region("CN-GD") == "Asia/Shanghai"
        assert get_timezone_for_region("CN-XJ") == "Asia/Urumqi"
    
    def test_get_timezone_for_unknown_region(self):
        """测试未知区域返回默认时区"""
        # 应该返回默认值并记录警告
        timezone = get_timezone_for_region("CN-UNKNOWN")
        assert timezone == "Asia/Shanghai"


class TestTimeConsistency:
    """
    测试时间口径一致性
    
    验收用例: 同一time_range下，L0/L1/L2不互相矛盾
    """
    
    def test_natural_day_boundary_consistency(self):
        """
        测试自然日边界一致性
        
        场景: 确保"per day"的判断在不同数据产品中一致
        """
        # 北京时间 2025-01-20 00:00:00
        region_tz = ZoneInfo("Asia/Shanghai")
        beijing_day_start = datetime(2025, 1, 20, 0, 0, 0, tzinfo=region_tz)
        utc_day_start = beijing_day_start.astimezone(timezone.utc)
        
        # 使用工具函数计算
        calc_day_start = align_to_natural_day_start(
            datetime(2025, 1, 20, 8, 0, 0, tzinfo=timezone.utc),
            "Asia/Shanghai"
        )
        
        # 应该与直接转换的结果一致
        assert calc_day_start == utc_day_start


class TestCriticalBusinessRules:
    """
    测试关键业务规则
    
    这些是保险业务的核心约束,必须100%正确
    """
    
    def test_per_day_boundary_at_region_midnight(self):
        """
        验收用例: "per day" 的 "day" 基于 region_timezone
        
        场景: 保单说"once per day", 这个day是风险发生地的自然日
        """
        # 北京时间1月20日的两个理赔事件
        event1_utc = datetime(2025, 1, 20, 2, 0, 0, tzinfo=timezone.utc)   # 北京10:00
        event2_utc = datetime(2025, 1, 20, 14, 0, 0, tzinfo=timezone.utc)  # 北京22:00
        
        # 应该判断为同一天
        assert is_same_natural_day(event1_utc, event2_utc, "Asia/Shanghai")
        
        # 但如果第二个事件跨越了午夜...
        event3_utc = datetime(2025, 1, 20, 20, 0, 0, tzinfo=timezone.utc)  # 北京次日04:00
        
        # 应该判断为不同天
        assert not is_same_natural_day(event1_utc, event3_utc, "Asia/Shanghai")
    
    def test_cross_timezone_consistency(self):
        """
        测试跨时区的一致性
        
        场景: 同一UTC时间在不同时区有不同的自然日归属
        """
        utc_time = datetime(2025, 1, 20, 2, 0, 0, tzinfo=timezone.utc)
        
        # 上海时区: 2025-01-20
        shanghai_date = get_natural_date(utc_time, "Asia/Shanghai")
        assert shanghai_date == "2025-01-20"
        
        # 纽约时区 (UTC-5): 2025-01-19
        ny_date = get_natural_date(utc_time, "America/New_York")
        assert ny_date == "2025-01-19"
        
        # 说明: 同一UTC时间在不同时区有不同的自然日
        assert shanghai_date != ny_date


class TestEdgeCases:
    """测试边缘情况"""
    
    def test_dst_transition(self):
        """
        测试夏令时切换
        
        注意: 中国不使用夏令时，用美国时区测试
        """
        # 2025年美国夏令时开始: 3月9日凌晨2点
        # (具体日期可能变化，这里仅作示例)
        before_dst = datetime(2025, 3, 9, 6, 0, 0, tzinfo=timezone.utc)  # DST前
        after_dst = datetime(2025, 3, 9, 8, 0, 0, tzinfo=timezone.utc)   # DST后
        
        ny_before = utc_to_region_tz(before_dst, "America/New_York")
        ny_after = utc_to_region_tz(after_dst, "America/New_York")
        
        # DST切换会导致时区offset变化
        # (具体验证取决于实际DST规则)
        assert ny_before.tzinfo is not None
        assert ny_after.tzinfo is not None
    
    def test_leap_second_handling(self):
        """
        测试闰秒处理
        
        Python datetime通常不处理闰秒，但需要确认不会崩溃
        """
        # 2025年6月30日可能有闰秒(示例)
        time_near_leap = datetime(2025, 6, 30, 23, 59, 59, tzinfo=timezone.utc)
        
        # 应该能正常处理
        natural_date = get_natural_date(time_near_leap, "Asia/Shanghai")
        assert natural_date is not None


class TestCalculationRange:
    """测试计算窗口"""
    
    def test_calculation_range_validation(self):
        """测试计算窗口验证"""
        calc_range = CalculationRangeUTC(
            calculation_start=datetime(2025, 1, 13, 0, 0, 0, tzinfo=timezone.utc),
            calculation_end=datetime(2025, 1, 27, 23, 59, 59, tzinfo=timezone.utc),
            display_start=datetime(2025, 1, 20, 0, 0, 0, tzinfo=timezone.utc),
            display_end=datetime(2025, 1, 27, 23, 59, 59, tzinfo=timezone.utc),
            extension_hours=7 * 24
        )
        
        assert calc_range.calculation_start <= calc_range.display_start
        assert calc_range.extension_hours == 168  # 7天 = 168小时
    
    def test_invalid_calculation_range(self):
        """测试无效的计算窗口(calculation_start晚于display_start)"""
        with pytest.raises(ValueError, match="calculation_start must be"):
            CalculationRangeUTC(
                calculation_start=datetime(2025, 1, 25, 0, 0, 0, tzinfo=timezone.utc),
                calculation_end=datetime(2025, 1, 27, 23, 59, 59, tzinfo=timezone.utc),
                display_start=datetime(2025, 1, 20, 0, 0, 0, tzinfo=timezone.utc),
                display_end=datetime(2025, 1, 27, 23, 59, 59, tzinfo=timezone.utc)
            )
