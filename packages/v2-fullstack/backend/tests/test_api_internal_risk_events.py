from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_access_mode, get_session
from app.api.v1.internal import risk_events
from app.schemas.shared import AccessMode
from app.services.risk_service import risk_service


async def _override_get_session():
    yield AsyncMock()


def _build_client(access_mode: AccessMode) -> TestClient:
    app = FastAPI()
    app.include_router(risk_events.router, prefix="/api/v1")
    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_access_mode] = lambda: access_mode
    return TestClient(app)


def test_internal_create_risk_event_requires_admin():
    client = _build_client(AccessMode.DEMO_PUBLIC)
    response = client.post(
        "/api/v1/internal/risk-events",
        json={
            "id": "evt-001",
            "timestamp": "2025-01-01T00:00:00Z",
            "region_code": "CN-GD",
            "product_id": "daily_rainfall",
            "product_version": "v1.0.0",
            "weather_type": "rainfall",
            "tier_level": 1,
            "trigger_value": "10.00",
            "threshold_value": "5.00",
            "data_type": "historical",
        },
    )
    assert response.status_code == 403


def test_internal_batch_create_calls_service(monkeypatch):
    client = _build_client(AccessMode.ADMIN_INTERNAL)
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(risk_service, "batch_create", mock)

    response = client.post(
        "/api/v1/internal/risk-events/batch",
        json=[
            {
                "id": "evt-001",
                "timestamp": "2025-01-01T00:00:00Z",
                "region_code": "CN-GD",
                "product_id": "daily_rainfall",
                "product_version": "v1.0.0",
                "weather_type": "rainfall",
                "tier_level": 1,
                "trigger_value": "10.00",
                "threshold_value": "5.00",
                "data_type": "historical",
            }
        ],
    )

    assert response.status_code == 201
    assert mock.await_count == 1
