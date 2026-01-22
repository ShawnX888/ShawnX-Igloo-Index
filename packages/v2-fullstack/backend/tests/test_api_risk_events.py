from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_session
from app.api.v1 import risk_events
from app.services.risk_service import risk_service


async def _override_get_session():
    yield AsyncMock()


def _build_client() -> TestClient:
    app = FastAPI()
    app.include_router(risk_events.router, prefix="/api/v1")
    app.dependency_overrides[get_session] = _override_get_session
    return TestClient(app)


def test_list_risk_events_predicted_requires_run_id():
    client = _build_client()
    response = client.get(
        "/api/v1/risk-events",
        params={
            "region_code": "CN-GD",
            "weather_type": "rainfall",
            "data_type": "predicted",
            "time_range_start": "2025-01-01T00:00:00Z",
            "time_range_end": "2025-01-02T00:00:00Z",
        },
    )
    assert response.status_code == 400


def test_list_risk_events_historical_rejects_run_id():
    client = _build_client()
    response = client.get(
        "/api/v1/risk-events",
        params={
            "region_code": "CN-GD",
            "weather_type": "rainfall",
            "data_type": "historical",
            "time_range_start": "2025-01-01T00:00:00Z",
            "time_range_end": "2025-01-02T00:00:00Z",
            "prediction_run_id": "run-2025-01-20-001",
        },
    )
    assert response.status_code == 400


def test_list_risk_events_calls_service(monkeypatch):
    client = _build_client()
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(risk_service, "query_events", mock)

    response = client.get(
        "/api/v1/risk-events",
        params={
            "region_code": "CN-GD",
            "weather_type": "rainfall",
            "data_type": "historical",
            "time_range_start": "2025-01-01T00:00:00Z",
            "time_range_end": "2025-01-02T00:00:00Z",
        },
    )

    assert response.status_code == 200
    assert response.json() == []
    assert mock.await_count == 1
