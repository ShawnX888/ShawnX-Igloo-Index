from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock

import pytest

from app.schemas.shared import DataType, WeatherType
from app.services.risk_service import RiskService


@pytest.mark.asyncio
async def test_query_events_requires_run_id_for_predicted():
    service = RiskService()
    session = AsyncMock()

    with pytest.raises(ValueError, match="prediction_run_id required"):
        await service.query_events(
            session,
            region_code="CN-GD",
            weather_type=WeatherType.RAINFALL,
            data_type=DataType.PREDICTED,
            time_range_start=datetime(2025, 1, 1, tzinfo=timezone.utc),
            time_range_end=datetime(2025, 1, 2, tzinfo=timezone.utc),
            prediction_run_id=None,
        )


@pytest.mark.asyncio
async def test_query_events_historical_must_not_have_run_id():
    service = RiskService()
    session = AsyncMock()

    with pytest.raises(ValueError, match="must be null"):
        await service.query_events(
            session,
            region_code="CN-GD",
            weather_type=WeatherType.RAINFALL,
            data_type=DataType.HISTORICAL,
            time_range_start=datetime(2025, 1, 1, tzinfo=timezone.utc),
            time_range_end=datetime(2025, 1, 2, tzinfo=timezone.utc),
            prediction_run_id="run-2025-01-20-001",
        )


@pytest.mark.asyncio
async def test_query_events_executes_select_and_maps_rows():
    service = RiskService()
    session = AsyncMock()

    result = Mock()
    result.scalars.return_value.all.return_value = []
    session.execute.return_value = result

    events = await service.query_events(
        session,
        region_code="CN-GD",
        weather_type=WeatherType.RAINFALL,
        data_type=DataType.HISTORICAL,
        time_range_start=datetime(2025, 1, 1, tzinfo=timezone.utc),
        time_range_end=datetime(2025, 1, 2, tzinfo=timezone.utc),
    )

    assert events == []
    session.execute.assert_awaited()

