"""
Risk Calculator (风险计算引擎)

纯计算函数,不依赖DB Session,支持:
- 时间窗口聚合(hourly/daily/weekly/monthly)
- 阈值比较(tier1/2/3判断)
- 扩展窗口计算

Reference:
- docs/v2/v2实施细则/08-Risk-Calculator-细则.md
- docs/v2/v2复用逻辑摘录/RD-风险计算引擎核心与策略.md

硬规则:
- 只读 riskRules, 不读 payoutRules
- 使用 region_timezone 做自然边界对齐
- 输出严格裁剪回 time_range（扩展窗口仅用于计算）
- 返回 risk_event 数据(不含赔付金额)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Sequence

from app.schemas.product import RiskRules
from app.schemas.shared import DataType, WeatherType
from app.schemas.weather import WeatherDataPoint
from app.utils.time_utils import (
    align_to_natural_day_start,
    align_to_natural_month_start,
    region_tz_to_utc,
    utc_to_region_tz,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class RiskEvent:
    """
    风险事件 (计算结果)

    纯数据类,用于传递计算结果
    """

    timestamp: datetime
    region_code: str
    weather_type: WeatherType
    tier_level: int
    trigger_value: Decimal
    threshold_value: Decimal
    product_id: str
    product_version: str
    data_type: DataType
    prediction_run_id: Optional[str] = None


class RiskCalculator:
    """
    风险计算引擎
    
    职责:
    - 根据 riskRules 计算风险事件
    - 支持滑动窗口/固定窗口
    - 支持多种聚合方式
    
    硬规则:
    - 纯计算,不依赖DB
    - 只读 riskRules
    """
    
    def calculate_risk_events(
        self,
        weather_data: List[WeatherDataPoint],
        risk_rules: RiskRules,
        product_id: str,
        product_version: str,
        region_timezone: str,
        time_range_start: Optional[datetime] = None,
        time_range_end: Optional[datetime] = None,
    ) -> List[RiskEvent]:
        """
        计算风险事件
        
        Args:
            weather_data: 天气数据(已扩展窗口 / calculation_range 覆盖)
            risk_rules: 风险规则
            product_id: 产品ID
            product_version: 产品版本
            region_timezone: 区域时区
            time_range_start: 展示窗起始(UTC)。提供时将严格裁剪输出
            time_range_end: 展示窗结束(UTC)。提供时将严格裁剪输出
            
        Returns:
            风险事件列表
        """
        if not weather_data:
            return []
        
        data = sorted(weather_data, key=lambda d: d.timestamp)
        self._validate_weather_series(data, risk_rules)

        risk_events: list[RiskEvent] = []
        
        # 提取规则参数
        time_window = risk_rules.time_window
        thresholds = risk_rules.thresholds
        calculation = risk_rules.calculation
        
        window_ends = self._select_window_ends(
            data,
            window_type=time_window.type,
            step=time_window.step,
            region_timezone=region_timezone,
        )

        for window_end in window_ends:
            window_start = self._get_window_start(
                window_end=window_end,
                window_type=time_window.type,
                window_size=time_window.size,
                region_timezone=region_timezone,
            )

            window_data = [d for d in data if window_start < d.timestamp <= window_end]
            if not self._has_sufficient_points(window_data, window_type=time_window.type, window_size=time_window.size):
                continue

            aggregated_value = self._aggregate_values([d.value for d in window_data], calculation.aggregation)
            tier = self._determine_tier(aggregated_value, thresholds, calculation.operator)
            if tier <= 0:
                continue

            risk_events.append(
                RiskEvent(
                    timestamp=window_end,
                    region_code=data[0].region_code,
                    weather_type=risk_rules.weather_type,
                    tier_level=tier,
                    trigger_value=aggregated_value,
                    threshold_value=self._get_threshold_value(thresholds, tier),
                    product_id=product_id,
                    product_version=product_version,
                    data_type=data[0].data_type,
                    prediction_run_id=data[0].prediction_run_id,
                )
            )

        # 输出裁剪：仅返回 time_range 内的事件
        if time_range_start and time_range_end:
            start = self._ensure_utc(time_range_start)
            end = self._ensure_utc(time_range_end)
            risk_events = [e for e in risk_events if start <= e.timestamp <= end]

        return risk_events

    def _validate_weather_series(self, data: Sequence[WeatherDataPoint], risk_rules: RiskRules) -> None:
        """验证天气序列的一致性（纯计算模块的输入硬校验）"""
        if not data:
            raise ValueError("weather_data must not be empty")

        region_code = data[0].region_code
        weather_type = data[0].weather_type
        data_type = data[0].data_type
        prediction_run_id = data[0].prediction_run_id

        for d in data:
            if d.region_code != region_code:
                raise ValueError("weather_data contains mixed region_code")
            if d.weather_type != weather_type:
                raise ValueError("weather_data contains mixed weather_type")
            if d.data_type != data_type:
                raise ValueError("weather_data contains mixed data_type")
            if d.data_type == DataType.PREDICTED and d.prediction_run_id != prediction_run_id:
                raise ValueError("weather_data contains mixed prediction_run_id in predicted mode")

        # predicted 必须绑定 prediction_run_id
        if data_type == DataType.PREDICTED and not prediction_run_id:
            raise ValueError("prediction_run_id required for predicted weather_data")

        # weather_type 必须与产品规则一致
        if risk_rules.weather_type != weather_type:
            raise ValueError("risk_rules.weather_type must match weather_data.weather_type")

    def _select_window_ends(
        self,
        data: Sequence[WeatherDataPoint],
        window_type: str,
        step: Optional[int],
        region_timezone: str,
    ) -> list[datetime]:
        """
        选择窗口结束点。

        - step 为空：默认步长为 1（按窗口类型的基础单位）
        - 以数据点时间戳为候选，按最小步长节流，避免每个点都计算
        """
        if not data:
            return []

        step_value = step or 1
        step_value = max(step_value, 1)

        selected: list[datetime] = []
        last: Optional[datetime] = None

        for d in data:
            t = self._ensure_utc(d.timestamp)
            if last is None:
                selected.append(t)
                last = t
                continue

            if self._step_reached(last, t, window_type=window_type, step=step_value, region_timezone=region_timezone):
                selected.append(t)
                last = t

        return selected

    def _step_reached(
        self,
        last: datetime,
        current: datetime,
        window_type: str,
        step: int,
        region_timezone: str,
    ) -> bool:
        """判断 current 是否达到 step 间隔"""
        if window_type == "hourly":
            return (current - last) >= timedelta(hours=step)
        if window_type == "daily":
            return (current - last) >= timedelta(days=step)
        if window_type == "weekly":
            return (current - last) >= timedelta(weeks=step)
        if window_type == "monthly":
            last_local = utc_to_region_tz(last, region_timezone)
            current_local = utc_to_region_tz(current, region_timezone)
            months_last = last_local.year * 12 + last_local.month
            months_current = current_local.year * 12 + current_local.month
            return (months_current - months_last) >= step

        raise ValueError(f"Unknown window_type: {window_type}")

    def _get_window_start(
        self,
        window_end: datetime,
        window_type: str,
        window_size: int,
        region_timezone: str,
    ) -> datetime:
        """
        计算窗口起始（用于扩展窗口内的回溯计算）。

        规则（与 RD-计算窗口与扩展数据.md 对齐）：
        - hourly: window_end - size hours
        - daily/weekly: (window_end - size days/weeks) 后对齐到自然日起始
        - monthly: 对齐到自然月起始，并按 size 向前扩展多个自然月
        """
        end = self._ensure_utc(window_end)
        if window_size <= 0:
            raise ValueError("timeWindow.size must be positive")

        if window_type == "hourly":
            return end - timedelta(hours=window_size)
        if window_type == "daily":
            base = end - timedelta(days=window_size)
            return align_to_natural_day_start(base, region_timezone)
        if window_type == "weekly":
            base = end - timedelta(weeks=window_size)
            return align_to_natural_day_start(base, region_timezone)
        if window_type == "monthly":
            # 当月起始
            month_start = align_to_natural_month_start(end, region_timezone)
            if window_size == 1:
                return month_start

            # 向前扩展 (window_size-1) 个月，并对齐到该月 1 日 00:00:00（region_tz）
            month_start_local = utc_to_region_tz(month_start, region_timezone)
            total_months = month_start_local.year * 12 + month_start_local.month - (window_size - 1)
            start_year = (total_months - 1) // 12
            start_month = (total_months - 1) % 12 + 1

            shifted_local = month_start_local.replace(year=start_year, month=start_month, day=1)
            shifted_local = shifted_local.replace(hour=0, minute=0, second=0, microsecond=0)
            return region_tz_to_utc(shifted_local, region_timezone)

        raise ValueError(f"Unknown window_type: {window_type}")

    def _has_sufficient_points(self, window_data: Sequence[WeatherDataPoint], window_type: str, window_size: int) -> bool:
        """
        判断窗口内数据点是否足够。

        v2 假设 Weather Series 与 window_type 的基础粒度一致（hourly/daily/...），
        因此用 count >= size 作为最小门槛，避免稀疏数据导致误触发。
        """
        if window_type in ("hourly", "daily", "weekly", "monthly"):
            return len(window_data) >= window_size
        return False
    
    def _aggregate_values(
        self,
        values: List[Decimal],
        aggregation: str
    ) -> Decimal:
        """聚合数值"""
        if aggregation == "sum":
            return sum(values)
        elif aggregation == "avg":
            return sum(values) / len(values)
        elif aggregation == "max":
            return max(values)
        elif aggregation == "min":
            return min(values)
        else:
            raise ValueError(f"Unknown aggregation: {aggregation}")
    
    def _determine_tier(
        self,
        value: Decimal,
        thresholds,
        operator: str
    ) -> int:
        """判断tier级别"""
        if operator == ">=":
            if value >= thresholds.tier3:
                return 3
            if value >= thresholds.tier2:
                return 2
            if value >= thresholds.tier1:
                return 1
            return 0

        if operator == ">":
            if value > thresholds.tier3:
                return 3
            if value > thresholds.tier2:
                return 2
            if value > thresholds.tier1:
                return 1
            return 0

        if operator == "<=":
            if value <= thresholds.tier3:
                return 3
            if value <= thresholds.tier2:
                return 2
            if value <= thresholds.tier1:
                return 1
            return 0

        if operator == "<":
            if value < thresholds.tier3:
                return 3
            if value < thresholds.tier2:
                return 2
            if value < thresholds.tier1:
                return 1
            return 0

        raise ValueError(f"Unknown operator: {operator}")
    
    def _get_threshold_value(self, thresholds, tier: int) -> Decimal:
        """获取对应tier的阈值"""
        if tier == 1:
            return thresholds.tier1
        elif tier == 2:
            return thresholds.tier2
        elif tier == 3:
            return thresholds.tier3
        return Decimal(0)

    def _ensure_utc(self, dt: datetime) -> datetime:
        """确保 datetime 是 UTC-aware"""
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)


risk_calculator = RiskCalculator()
