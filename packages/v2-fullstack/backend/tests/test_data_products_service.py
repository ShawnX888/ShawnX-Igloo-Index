from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.shared import AccessMode, DataType, RegionScope, SharedDimensions, TimeRange, WeatherType
from app.services.data_products_service import (
    l0_dashboard_service,
    l1_intelligence_service,
    map_overlays_service,
)


def _dimensions(data_type: DataType) -> SharedDimensions:
    return SharedDimensions(
        region_scope=RegionScope.PROVINCE,
        region_code="CN-GD",
        time_range=TimeRange(
            start=datetime(2025, 1, 1, tzinfo=timezone.utc),
            end=datetime(2025, 1, 2, tzinfo=timezone.utc),
        ),
        data_type=data_type,
        weather_type=WeatherType.RAINFALL,
        access_mode=AccessMode.DEMO_PUBLIC,
        prediction_run_id="run-2025-01-20-001" if data_type == DataType.PREDICTED else None,
        region_timezone="Asia/Shanghai",
    )


def test_l0_dashboard_claims_unavailable_flag():
    response = l0_dashboard_service.build_response(_dimensions(DataType.HISTORICAL))
    assert response.legend.claims_available is False
    assert response.legend.claims_unavailable_reason is not None


def test_overlays_predicted_binds_run_id():
    response = map_overlays_service.build_response(_dimensions(DataType.PREDICTED))
    assert response.legend.prediction_run_id == "run-2025-01-20-001"


def test_l1_intelligence_has_region_timezone_meta():
    response = l1_intelligence_service.build_response(_dimensions(DataType.HISTORICAL))
    assert response.legend.region_timezone == "Asia/Shanghai"
