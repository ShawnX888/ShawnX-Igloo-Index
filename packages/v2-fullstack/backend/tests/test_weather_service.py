from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import Mock
from unittest.mock import AsyncMock

import pytest

from app.schemas.shared import DataType, WeatherType
from app.schemas.weather import WeatherQueryRequest, WeatherStats
from app.services.weather_service import WeatherService


@pytest.mark.asyncio
async def test_query_stats_requires_run_id_for_predicted():
    service = WeatherService()
    session = AsyncMock()

    request = WeatherQueryRequest(
        region_code="CN-GD",
        weather_type=WeatherType.RAINFALL,
        start_time=datetime(2025, 1, 1, tzinfo=timezone.utc),
        end_time=datetime(2025, 1, 2, tzinfo=timezone.utc),
        data_type=DataType.PREDICTED,
        prediction_run_id=None,
    )

    with pytest.raises(ValueError, match="prediction_run_id required"):
        await service.query_stats(session, request)


@pytest.mark.asyncio
async def test_query_stats_maps_result_row():
    service = WeatherService()
    session = AsyncMock()

    request = WeatherQueryRequest(
        region_code="CN-GD",
        weather_type=WeatherType.RAINFALL,
        start_time=datetime(2025, 1, 1, tzinfo=timezone.utc),
        end_time=datetime(2025, 1, 2, tzinfo=timezone.utc),
        data_type=DataType.HISTORICAL,
        prediction_run_id=None,
    )

    # SQLAlchemy Result.one() is sync and returns a Row-like tuple
    result = Mock()
    result.one.return_value = (10, 2, 5, 1, 4)
    session.execute.return_value = result

    stats = await service.query_stats(session, request)

    assert isinstance(stats, WeatherStats)
    assert stats.sum == 10
    assert stats.avg == 2
    assert stats.max == 5
    assert stats.min == 1
    assert stats.count == 4

