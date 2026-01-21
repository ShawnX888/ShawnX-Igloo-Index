from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.schemas.risk_event import RiskEventCreate
from app.schemas.shared import DataType, WeatherType


def test_predicted_risk_event_requires_run_id():
    with pytest.raises(ValueError, match="prediction_run_id required"):
        RiskEventCreate(
            id="evt-1",
            product_version="v1.0.0",
            timestamp=datetime(2025, 1, 20, tzinfo=timezone.utc),
            region_code="CN-GD",
            product_id="daily_rainfall",
            weather_type=WeatherType.RAINFALL,
            tier_level=1,
            trigger_value=Decimal("60"),
            threshold_value=Decimal("50"),
            data_type=DataType.PREDICTED,
            prediction_run_id=None,
        )


def test_historical_risk_event_must_not_have_run_id():
    with pytest.raises(ValueError, match="must be null"):
        RiskEventCreate(
            id="evt-2",
            product_version="v1.0.0",
            timestamp=datetime(2025, 1, 20, tzinfo=timezone.utc),
            region_code="CN-GD",
            product_id="daily_rainfall",
            weather_type=WeatherType.RAINFALL,
            tier_level=1,
            trigger_value=Decimal("60"),
            threshold_value=Decimal("50"),
            data_type=DataType.HISTORICAL,
            prediction_run_id="run-2025-01-20-001",
        )

