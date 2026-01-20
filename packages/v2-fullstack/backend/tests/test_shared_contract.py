"""
测试Shared Contract基线的验收用例

Reference: docs/v2/v2实施细则/01-Shared-Contract基线-细则.md
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.shared import (
    RegionScope,
    DataType,
    WeatherType,
    AccessMode,
    TimeRange,
    SharedDimensions,
    SeriesData,
    EventData,
    AggregationData,
    LegendMeta,
    DataProductResponse,
    TraceContext,
    ResponseMeta,
)


class TestEnums:
    """测试枚举类型定义"""
    
    def test_region_scope_values(self):
        """验证RegionScope枚举值"""
        assert RegionScope.PROVINCE.value == "province"
        assert RegionScope.DISTRICT.value == "district"
    
    def test_data_type_values(self):
        """验证DataType枚举值"""
        assert DataType.HISTORICAL.value == "historical"
        assert DataType.PREDICTED.value == "predicted"
    
    def test_weather_type_values(self):
        """验证WeatherType枚举值"""
        assert WeatherType.RAINFALL.value == "rainfall"
        assert WeatherType.WIND.value == "wind"
        assert WeatherType.TEMPERATURE.value == "temperature"
    
    def test_access_mode_values(self):
        """验证AccessMode枚举值"""
        assert AccessMode.DEMO_PUBLIC.value == "demo_public"
        assert AccessMode.PARTNER.value == "partner"
        assert AccessMode.ADMIN_INTERNAL.value == "admin_internal"


class TestTimeRange:
    """测试TimeRange"""
    
    def test_valid_time_range(self):
        """测试有效的时间范围"""
        time_range = TimeRange(
            start=datetime(2025, 1, 1, tzinfo=timezone.utc),
            end=datetime(2025, 1, 31, tzinfo=timezone.utc)
        )
        assert time_range.start < time_range.end
    
    def test_invalid_time_range(self):
        """测试无效的时间范围(end早于start)"""
        with pytest.raises(ValueError, match="end must be after start"):
            TimeRange(
                start=datetime(2025, 1, 31, tzinfo=timezone.utc),
                end=datetime(2025, 1, 1, tzinfo=timezone.utc)
            )


class TestSharedDimensions:
    """测试SharedDimensions"""
    
    def test_historical_dimensions(self):
        """测试historical场景的维度"""
        dimensions = SharedDimensions(
            region_scope=RegionScope.PROVINCE,
            region_code="CN-GD",
            time_range=TimeRange(
                start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                end=datetime(2025, 1, 31, tzinfo=timezone.utc)
            ),
            data_type=DataType.HISTORICAL,
            weather_type=WeatherType.RAINFALL,
            access_mode=AccessMode.DEMO_PUBLIC,
            product_id="daily_rainfall",
            prediction_run_id=None,
        )
        
        assert dimensions.data_type == DataType.HISTORICAL
        assert dimensions.prediction_run_id is None
    
    def test_predicted_dimensions_with_run_id(self):
        """测试predicted场景必须提供prediction_run_id"""
        dimensions = SharedDimensions(
            region_scope=RegionScope.PROVINCE,
            region_code="CN-GD",
            time_range=TimeRange(
                start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                end=datetime(2025, 1, 31, tzinfo=timezone.utc)
            ),
            data_type=DataType.PREDICTED,
            weather_type=WeatherType.RAINFALL,
            access_mode=AccessMode.DEMO_PUBLIC,
            prediction_run_id="run-2025-01-20-001",
        )
        
        assert dimensions.data_type == DataType.PREDICTED
        assert dimensions.prediction_run_id == "run-2025-01-20-001"
    
    def test_predicted_dimensions_without_run_id_fails(self):
        """测试predicted场景缺少prediction_run_id会失败"""
        with pytest.raises(ValueError, match="prediction_run_id is required"):
            SharedDimensions(
                region_scope=RegionScope.PROVINCE,
                region_code="CN-GD",
                time_range=TimeRange(
                    start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                    end=datetime(2025, 1, 31, tzinfo=timezone.utc)
                ),
                data_type=DataType.PREDICTED,
                weather_type=WeatherType.RAINFALL,
                access_mode=AccessMode.DEMO_PUBLIC,
                prediction_run_id=None,
            )
    
    def test_historical_dimensions_with_run_id_fails(self):
        """测试historical场景不能提供prediction_run_id"""
        with pytest.raises(ValueError, match="prediction_run_id must be None"):
            SharedDimensions(
                region_scope=RegionScope.PROVINCE,
                region_code="CN-GD",
                time_range=TimeRange(
                    start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                    end=datetime(2025, 1, 31, tzinfo=timezone.utc)
                ),
                data_type=DataType.HISTORICAL,
                weather_type=WeatherType.RAINFALL,
                access_mode=AccessMode.DEMO_PUBLIC,
                prediction_run_id="run-2025-01-20-001",
            )
    
    def test_cache_key_historical(self):
        """测试historical场景的缓存key生成"""
        dimensions = SharedDimensions(
            region_scope=RegionScope.PROVINCE,
            region_code="CN-GD",
            time_range=TimeRange(
                start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                end=datetime(2025, 1, 31, tzinfo=timezone.utc)
            ),
            data_type=DataType.HISTORICAL,
            weather_type=WeatherType.RAINFALL,
            access_mode=AccessMode.DEMO_PUBLIC,
            product_id="daily_rainfall",
        )
        
        cache_key = dimensions.to_cache_key()
        
        # 验证缓存key包含所有必须维度
        assert "region:province:CN-GD" in cache_key
        assert "dtype:historical" in cache_key
        assert "weather:rainfall" in cache_key
        assert "mode:demo_public" in cache_key
        assert "product:daily_rainfall" in cache_key
        assert "run:" not in cache_key  # historical不应包含run
    
    def test_cache_key_predicted(self):
        """测试predicted场景的缓存key必须包含prediction_run_id"""
        dimensions = SharedDimensions(
            region_scope=RegionScope.PROVINCE,
            region_code="CN-GD",
            time_range=TimeRange(
                start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                end=datetime(2025, 1, 31, tzinfo=timezone.utc)
            ),
            data_type=DataType.PREDICTED,
            weather_type=WeatherType.RAINFALL,
            access_mode=AccessMode.DEMO_PUBLIC,
            prediction_run_id="run-2025-01-20-001",
        )
        
        cache_key = dimensions.to_cache_key()
        
        # 验证缓存key包含prediction_run_id
        assert "run:run-2025-01-20-001" in cache_key
    
    def test_cache_key_consistency(self):
        """测试相同维度生成相同缓存key"""
        dimensions1 = SharedDimensions(
            region_scope=RegionScope.PROVINCE,
            region_code="CN-GD",
            time_range=TimeRange(
                start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                end=datetime(2025, 1, 31, tzinfo=timezone.utc)
            ),
            data_type=DataType.HISTORICAL,
            weather_type=WeatherType.RAINFALL,
            access_mode=AccessMode.DEMO_PUBLIC,
        )
        
        dimensions2 = SharedDimensions(
            region_scope=RegionScope.PROVINCE,
            region_code="CN-GD",
            time_range=TimeRange(
                start=datetime(2025, 1, 1, tzinfo=timezone.utc),
                end=datetime(2025, 1, 31, tzinfo=timezone.utc)
            ),
            data_type=DataType.HISTORICAL,
            weather_type=WeatherType.RAINFALL,
            access_mode=AccessMode.DEMO_PUBLIC,
        )
        
        assert dimensions1.to_cache_key() == dimensions2.to_cache_key()


class TestOutputDTOs:
    """测试输出DTO分类"""
    
    def test_series_data(self):
        """测试SeriesData"""
        series = SeriesData(
            timestamps=[datetime(2025, 1, 1, tzinfo=timezone.utc)],
            values=[100.5],
            unit="mm"
        )
        
        assert len(series.timestamps) == len(series.values)
        assert series.unit == "mm"
    
    def test_event_data_historical(self):
        """测试historical事件数据"""
        event = EventData(
            event_id="evt-001",
            timestamp=datetime(2025, 1, 1, tzinfo=timezone.utc),
            event_type="risk",
            tier_level=2,
            trigger_value=Decimal("105.5"),
            threshold_value=Decimal("100.0"),
            data_type=DataType.HISTORICAL,
            prediction_run_id=None,
        )
        
        assert event.data_type == DataType.HISTORICAL
        assert event.prediction_run_id is None
    
    def test_event_data_predicted(self):
        """测试predicted事件数据必须包含prediction_run_id"""
        event = EventData(
            event_id="evt-002",
            timestamp=datetime(2025, 1, 1, tzinfo=timezone.utc),
            event_type="risk",
            tier_level=3,
            data_type=DataType.PREDICTED,
            prediction_run_id="run-2025-01-20-001",
        )
        
        assert event.data_type == DataType.PREDICTED
        assert event.prediction_run_id == "run-2025-01-20-001"
    
    def test_aggregation_data(self):
        """测试AggregationData"""
        agg = AggregationData(
            aggregation_key="CN-GD",
            aggregation_method="sum",
            value=Decimal("1250.5"),
            unit="mm",
            label="Guangdong Province"
        )
        
        assert agg.aggregation_method == "sum"
        assert agg.unit == "mm"
    
    def test_legend_meta_historical(self):
        """测试historical的LegendMeta"""
        legend = LegendMeta(
            data_type=DataType.HISTORICAL,
            weather_type=WeatherType.RAINFALL,
            unit="mm",
            thresholds={"tier1": 50.0, "tier2": 100.0, "tier3": 150.0}
        )
        
        assert legend.data_type == DataType.HISTORICAL
        assert legend.prediction_run_id is None
    
    def test_legend_meta_predicted(self):
        """测试predicted的LegendMeta必须包含prediction_run_id"""
        legend = LegendMeta(
            data_type=DataType.PREDICTED,
            weather_type=WeatherType.RAINFALL,
            unit="mm",
            prediction_run_id="run-2025-01-20-001",
            prediction_generated_at=datetime(2025, 1, 20, tzinfo=timezone.utc)
        )
        
        assert legend.data_type == DataType.PREDICTED
        assert legend.prediction_run_id == "run-2025-01-20-001"


class TestDataProductResponse:
    """测试DataProductResponse统一响应格式"""
    
    def test_complete_response(self):
        """测试完整的DataProductResponse"""
        trace_context = TraceContext(
            trace_id="trace-001",
            access_mode=AccessMode.DEMO_PUBLIC,
            region_code="CN-GD",
            data_type=DataType.HISTORICAL,
            weather_type=WeatherType.RAINFALL,
        )
        
        response = DataProductResponse(
            series=[
                SeriesData(
                    timestamps=[datetime(2025, 1, 1, tzinfo=timezone.utc)],
                    values=[100.5],
                    unit="mm"
                )
            ],
            events=[
                EventData(
                    event_id="evt-001",
                    timestamp=datetime(2025, 1, 1, tzinfo=timezone.utc),
                    event_type="risk",
                    data_type=DataType.HISTORICAL,
                )
            ],
            aggregations=[
                AggregationData(
                    aggregation_key="CN-GD",
                    aggregation_method="sum",
                    value=1250.5,
                )
            ],
            legend=LegendMeta(
                data_type=DataType.HISTORICAL,
                weather_type=WeatherType.RAINFALL,
                unit="mm",
            ),
            meta=ResponseMeta(
                trace_context=trace_context,
                cached=False,
            )
        )
        
        assert response.series is not None
        assert response.events is not None
        assert response.aggregations is not None
        assert response.legend.data_type == DataType.HISTORICAL
        assert response.meta.trace_context.trace_id == "trace-001"


class TestObservability:
    """测试可观测性"""
    
    def test_trace_context_creation(self):
        """测试TraceContext创建"""
        trace_context = TraceContext(
            trace_id="trace-001",
            access_mode=AccessMode.DEMO_PUBLIC,
            region_code="CN-GD",
            data_type=DataType.HISTORICAL,
            weather_type=WeatherType.RAINFALL,
            product_id="daily_rainfall",
        )
        
        assert trace_context.trace_id == "trace-001"
        assert trace_context.access_mode == AccessMode.DEMO_PUBLIC
        assert trace_context.region_code == "CN-GD"
    
    def test_response_meta(self):
        """测试ResponseMeta"""
        trace_context = TraceContext(
            trace_id="trace-001",
            access_mode=AccessMode.DEMO_PUBLIC,
        )
        
        meta = ResponseMeta(
            trace_context=trace_context,
            cached=True,
            cache_key="region:province:CN-GD|...",
            warnings=["Data incomplete for 2 districts"],
        )
        
        assert meta.cached is True
        assert meta.cache_key is not None
        assert len(meta.warnings) == 1
