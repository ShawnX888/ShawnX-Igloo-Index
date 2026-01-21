"""
测试Risk Calculator

验收用例:
- 只读 riskRules, 不读 payoutRules
- 正确聚合和判断tier
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.product import Calculation, RiskRules, Thresholds, TimeWindow
from app.schemas.shared import DataType, WeatherType
from app.schemas.weather import WeatherDataPoint
from app.services.compute.risk_calculator import RiskCalculator


class TestRiskCalculator:
    """测试风险计算引擎"""
    
    def test_aggregate_sum(self):
        """测试sum聚合"""
        calculator = RiskCalculator()
        
        values = [Decimal("10"), Decimal("20"), Decimal("30")]
        result = calculator._aggregate_values(values, "sum")
        
        assert result == Decimal("60")
    
    def test_aggregate_max(self):
        """测试max聚合"""
        calculator = RiskCalculator()
        
        values = [Decimal("10"), Decimal("50"), Decimal("30")]
        result = calculator._aggregate_values(values, "max")
        
        assert result == Decimal("50")
    
    def test_determine_tier_greater_than(self):
        """测试tier判断(>=运算符)"""
        calculator = RiskCalculator()
        
        thresholds = Thresholds(
            tier1=Decimal("50"),
            tier2=Decimal("100"),
            tier3=Decimal("150")
        )
        
        assert calculator._determine_tier(Decimal("60"), thresholds, ">=") == 1
        assert calculator._determine_tier(Decimal("120"), thresholds, ">=") == 2
        assert calculator._determine_tier(Decimal("180"), thresholds, ">=") == 3
        assert calculator._determine_tier(Decimal("30"), thresholds, ">=") == 0
    
    def test_determine_tier_less_than(self):
        """测试tier判断(<=运算符,用于低温)"""
        calculator = RiskCalculator()
        
        thresholds = Thresholds(
            tier1=Decimal("0"),
            tier2=Decimal("-5"),
            tier3=Decimal("-10")
        )
        
        assert calculator._determine_tier(Decimal("-2"), thresholds, "<=") == 1
        assert calculator._determine_tier(Decimal("-7"), thresholds, "<=") == 2
        assert calculator._determine_tier(Decimal("-15"), thresholds, "<=") == 3
        assert calculator._determine_tier(Decimal("5"), thresholds, "<=") == 0
    
    def test_calculate_risk_events(self):
        """
        验收用例: 只读 riskRules, 不读 payoutRules
        """
        calculator = RiskCalculator()
        
        # 准备天气数据(4小时累计降雨)
        weather_data = [
            WeatherDataPoint(
                timestamp=datetime(2025, 1, 20, i, 0, tzinfo=timezone.utc),
                region_code="CN-GD",
                weather_type=WeatherType.RAINFALL,
                value=Decimal("15"),
                unit="mm",
                data_type=DataType.HISTORICAL,
            )
            for i in range(8)
        ]
        
        # 定义风险规则(只使用riskRules)
        risk_rules = RiskRules(
            time_window=TimeWindow(type="hourly", size=4),
            thresholds=Thresholds(
                tier1=Decimal("50"),
                tier2=Decimal("100"),
                tier3=Decimal("150")
            ),
            calculation=Calculation(
                aggregation="sum",
                operator=">=",
                unit="mm"
            ),
            weather_type=WeatherType.RAINFALL
        )
        
        # 计算风险事件
        events = calculator.calculate_risk_events(
            weather_data,
            risk_rules,
            product_id="daily_rainfall",
            product_version="v1.0.0",
            region_timezone="Asia/Shanghai",
            time_range_start=datetime(2025, 1, 20, 3, 0, tzinfo=timezone.utc),
            time_range_end=datetime(2025, 1, 20, 5, 0, tzinfo=timezone.utc),
        )
        
        # 4小时累计=60mm, 触发tier1(50mm)
        assert len(events) > 0
        assert all(e.tier_level >= 1 for e in events)
        assert all(e.product_id == "daily_rainfall" for e in events)
        # 输出严格裁剪回 time_range
        assert all(
            datetime(2025, 1, 20, 3, 0, tzinfo=timezone.utc)
            <= e.timestamp
            <= datetime(2025, 1, 20, 5, 0, tzinfo=timezone.utc)
            for e in events
        )

    def test_calculate_risk_events_predicted_requires_run_id(self):
        """predicted 场景必须绑定 prediction_run_id"""
        calculator = RiskCalculator()

        weather_data = [
            WeatherDataPoint(
                timestamp=datetime(2025, 1, 20, i, 0, tzinfo=timezone.utc),
                region_code="CN-GD",
                weather_type=WeatherType.RAINFALL,
                value=Decimal("15"),
                unit="mm",
                data_type=DataType.PREDICTED,
                prediction_run_id=None,
            )
            for i in range(4)
        ]

        risk_rules = RiskRules(
            time_window=TimeWindow(type="hourly", size=4),
            thresholds=Thresholds(
                tier1=Decimal("50"),
                tier2=Decimal("100"),
                tier3=Decimal("150"),
            ),
            calculation=Calculation(
                aggregation="sum",
                operator=">=",
                unit="mm",
            ),
            weather_type=WeatherType.RAINFALL,
        )

        with pytest.raises(ValueError, match="prediction_run_id required"):
            calculator.calculate_risk_events(
                weather_data,
                risk_rules,
                product_id="daily_rainfall",
                product_version="v1.0.0",
                region_timezone="Asia/Shanghai",
            )
