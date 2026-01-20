"""
测试Product Service的验收用例

Reference: docs/v2/v2实施细则/05-产品表与Product-Service-细则.md
"""

import pytest
from decimal import Decimal

from app.schemas.product import (
    Calculation,
    PayoutPercentages,
    PayoutRules,
    Product,
    ProductCreate,
    RiskRules,
    Thresholds,
    TimeWindow,
)
from app.schemas.shared import AccessMode, WeatherType


class TestProductSchemas:
    """测试Product Schemas"""
    
    def test_time_window_creation(self):
        """测试TimeWindow创建"""
        tw = TimeWindow(type="hourly", size=4, step=1)
        
        assert tw.type == "hourly"
        assert tw.size == 4
        assert tw.step == 1
    
    def test_thresholds_validation(self):
        """测试Thresholds验证(tier递增)"""
        thresholds = Thresholds(
            tier1=Decimal("50.0"),
            tier2=Decimal("100.0"),
            tier3=Decimal("150.0")
        )
        
        assert thresholds.tier1 < thresholds.tier2 < thresholds.tier3
    
    def test_thresholds_invalid_order(self):
        """测试无效的Thresholds(tier2不大于tier1)"""
        with pytest.raises(ValueError, match="tier2 must be greater than tier1"):
            Thresholds(
                tier1=Decimal("100.0"),
                tier2=Decimal("50.0"),  # 错误: tier2 < tier1
                tier3=Decimal("150.0")
            )
    
    def test_payout_percentages_validation(self):
        """测试PayoutPercentages验证"""
        payout = PayoutPercentages(
            tier1=Decimal("20.0"),
            tier2=Decimal("50.0"),
            tier3=Decimal("100.0")
        )
        
        assert payout.tier1 < payout.tier2 < payout.tier3
    
    def test_risk_rules_creation(self):
        """测试RiskRules创建"""
        risk_rules = RiskRules(
            time_window=TimeWindow(type="hourly", size=4),
            thresholds=Thresholds(
                tier1=Decimal("50.0"),
                tier2=Decimal("100.0"),
                tier3=Decimal("150.0")
            ),
            calculation=Calculation(
                aggregation="sum",
                operator=">=",
                unit="mm"
            ),
            weather_type=WeatherType.RAINFALL
        )
        
        assert risk_rules.weather_type == WeatherType.RAINFALL
    
    def test_payout_rules_creation(self):
        """测试PayoutRules创建"""
        payout_rules = PayoutRules(
            frequency_limit="once_per_day_per_policy",
            payout_percentages=PayoutPercentages(
                tier1=Decimal("20.0"),
                tier2=Decimal("50.0"),
                tier3=Decimal("100.0")
            ),
            total_cap=Decimal("100.0")
        )
        
        assert payout_rules.frequency_limit == "once_per_day_per_policy"
        assert payout_rules.total_cap == Decimal("100.0")


class TestProductCreate:
    """测试ProductCreate验证"""
    
    def test_create_valid_product(self):
        """测试创建有效的产品"""
        product = ProductCreate(
            id="daily_rainfall",
            name="Daily Rainfall Protection",
            type="daily",
            weather_type=WeatherType.RAINFALL,
            description="Test product",
            version="v1.0.0",
            is_active=True,
            risk_rules=RiskRules(
                time_window=TimeWindow(type="hourly", size=4),
                thresholds=Thresholds(
                    tier1=Decimal("50.0"),
                    tier2=Decimal("100.0"),
                    tier3=Decimal("150.0")
                ),
                calculation=Calculation(
                    aggregation="sum",
                    operator=">=",
                    unit="mm"
                ),
                weather_type=WeatherType.RAINFALL
            ),
            payout_rules=PayoutRules(
                frequency_limit="once_per_day_per_policy",
                payout_percentages=PayoutPercentages(
                    tier1=Decimal("20.0"),
                    tier2=Decimal("50.0"),
                    tier3=Decimal("100.0")
                ),
                total_cap=Decimal("100.0")
            )
        )
        
        assert product.id == "daily_rainfall"
        assert product.weather_type == WeatherType.RAINFALL
        assert product.risk_rules.weather_type == WeatherType.RAINFALL
    
    def test_create_product_weather_type_mismatch(self):
        """
        验收用例: weather_type 与 riskRules.weatherType 必须一致
        
        这是P0约束
        """
        with pytest.raises(ValueError, match="weatherType.*must match"):
            ProductCreate(
                id="invalid_product",
                name="Invalid Product",
                type="daily",
                weather_type=WeatherType.RAINFALL,  # 产品是rainfall
                risk_rules=RiskRules(
                    time_window=TimeWindow(type="hourly", size=4),
                    thresholds=Thresholds(
                        tier1=Decimal("50.0"),
                        tier2=Decimal("100.0"),
                        tier3=Decimal("150.0")
                    ),
                    calculation=Calculation(
                        aggregation="sum",
                        operator=">=",
                        unit="mm"
                    ),
                    weather_type=WeatherType.WIND  # 但规则是wind - 不一致!
                ),
                payout_rules=PayoutRules(
                    frequency_limit="once_per_day_per_policy",
                    payout_percentages=PayoutPercentages(
                        tier1=Decimal("20.0"),
                        tier2=Decimal("50.0"),
                        tier3=Decimal("100.0")
                    ),
                    total_cap=Decimal("100.0")
                )
            )


class TestProductService:
    """测试Product Service (需要数据库)"""
    
    # TODO: 集成测试，需要数据库连接
    # 将在实际运行环境中测试
    
    @pytest.mark.skip(reason="Requires database connection")
    async def test_list_products_by_weather_type(self):
        """测试按天气类型过滤产品"""
        pass
    
    @pytest.mark.skip(reason="Requires database connection")
    async def test_mode_pruning_payout_rules(self):
        """
        验收用例: Demo/Public下 payoutRules 被裁剪
        
        这是Mode裁剪的核心验证
        """
        pass
