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
- 返回 risk_event 数据(不含赔付金额)
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from app.schemas.product import RiskRules
from app.schemas.shared import WeatherType
from app.schemas.weather import WeatherDataPoint
from app.utils.time_utils import (
    align_to_natural_day_start,
    get_natural_date,
)

logger = logging.getLogger(__name__)


class RiskEvent:
    """
    风险事件 (计算结果)
    
    纯数据类,用于传递计算结果
    """
    
    def __init__(
        self,
        timestamp: datetime,
        region_code: str,
        weather_type: WeatherType,
        tier_level: int,
        trigger_value: Decimal,
        threshold_value: Decimal,
        product_id: str,
        product_version: str,
        data_type: str,
        prediction_run_id: Optional[str] = None
    ):
        self.timestamp = timestamp
        self.region_code = region_code
        self.weather_type = weather_type
        self.tier_level = tier_level
        self.trigger_value = trigger_value
        self.threshold_value = threshold_value
        self.product_id = product_id
        self.product_version = product_version
        self.data_type = data_type
        self.prediction_run_id = prediction_run_id


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
        region_timezone: str
    ) -> List[RiskEvent]:
        """
        计算风险事件
        
        Args:
            weather_data: 天气数据(已扩展窗口)
            risk_rules: 风险规则
            product_id: 产品ID
            product_version: 产品版本
            region_timezone: 区域时区
            
        Returns:
            风险事件列表
        """
        if not weather_data:
            return []
        
        risk_events = []
        
        # 提取规则参数
        time_window = risk_rules.time_window
        thresholds = risk_rules.thresholds
        calculation = risk_rules.calculation
        
        # 按时间窗口聚合
        window_values = self._aggregate_by_window(
            weather_data,
            time_window.type,
            time_window.size,
            calculation.aggregation,
            region_timezone
        )
        
        # 判断阈值
        for window_end, aggregated_value in window_values:
            tier = self._determine_tier(
                aggregated_value,
                thresholds,
                calculation.operator
            )
            
            if tier > 0:
                # 提取data_type和prediction_run_id
                data_type = weather_data[0].data_type.value
                prediction_run_id = weather_data[0].prediction_run_id
                
                risk_events.append(RiskEvent(
                    timestamp=window_end,
                    region_code=weather_data[0].region_code,
                    weather_type=risk_rules.weather_type,
                    tier_level=tier,
                    trigger_value=aggregated_value,
                    threshold_value=self._get_threshold_value(thresholds, tier),
                    product_id=product_id,
                    product_version=product_version,
                    data_type=data_type,
                    prediction_run_id=prediction_run_id
                ))
        
        return risk_events
    
    def _aggregate_by_window(
        self,
        data: List[WeatherDataPoint],
        window_type: str,
        window_size: int,
        aggregation: str,
        region_timezone: str
    ) -> List[tuple[datetime, Decimal]]:
        """
        按时间窗口聚合
        
        Returns:
            [(window_end_time, aggregated_value), ...]
        """
        # 简化实现: 基础滑动窗口
        results = []
        
        for i in range(len(data)):
            window_data = data[max(0, i - window_size + 1):i + 1]
            
            if len(window_data) == window_size:
                value = self._aggregate_values(
                    [d.value for d in window_data],
                    aggregation
                )
                results.append((data[i].timestamp, value))
        
        return results
    
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
        if operator in (">=", ">"):
            if value >= thresholds.tier3:
                return 3
            elif value >= thresholds.tier2:
                return 2
            elif value >= thresholds.tier1:
                return 1
        elif operator in ("<=", "<"):
            if value <= thresholds.tier3:
                return 3
            elif value <= thresholds.tier2:
                return 2
            elif value <= thresholds.tier1:
                return 1
        
        return 0  # 未触发
    
    def _get_threshold_value(self, thresholds, tier: int) -> Decimal:
        """获取对应tier的阈值"""
        if tier == 1:
            return thresholds.tier1
        elif tier == 2:
            return thresholds.tier2
        elif tier == 3:
            return thresholds.tier3
        return Decimal(0)


risk_calculator = RiskCalculator()
