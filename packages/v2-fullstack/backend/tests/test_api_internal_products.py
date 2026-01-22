from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_access_mode, get_session
from app.api.v1.internal import products
from app.schemas.shared import AccessMode
from app.services.product_service import product_service


async def _override_get_session():
    yield AsyncMock()


def _build_client(access_mode: AccessMode) -> TestClient:
    app = FastAPI()
    app.include_router(products.router, prefix="/api/v1")
    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_access_mode] = lambda: access_mode
    return TestClient(app)


def test_internal_create_product_requires_admin():
    client = _build_client(AccessMode.DEMO_PUBLIC)
    response = client.post(
        "/api/v1/internal/products",
        json={
            "id": "daily_rainfall",
            "name": "Daily Rainfall Protection",
            "type": "daily",
            "weather_type": "rainfall",
            "risk_rules": {
                "time_window": {"type": "hourly", "size": 4},
                "thresholds": {"tier1": "50.0", "tier2": "100.0", "tier3": "150.0"},
                "calculation": {"aggregation": "sum", "operator": ">=", "unit": "mm"},
                "weather_type": "rainfall",
            },
            "payout_rules": {
                "frequency_limit": "once_per_day_per_policy",
                "payout_percentages": {"tier1": "20.0", "tier2": "50.0", "tier3": "100.0"},
                "total_cap": "100.0",
            },
        },
    )
    assert response.status_code == 403


def test_internal_create_product_calls_service(monkeypatch):
    client = _build_client(AccessMode.ADMIN_INTERNAL)
    mock = AsyncMock(
        return_value={
            "id": "daily_rainfall",
            "name": "Daily Rainfall Protection",
            "type": "daily",
            "weather_type": "rainfall",
            "description": None,
            "icon": None,
            "risk_rules": {
                "time_window": {"type": "hourly", "size": 4},
                "thresholds": {"tier1": "50.0", "tier2": "100.0", "tier3": "150.0"},
                "calculation": {"aggregation": "sum", "operator": ">=", "unit": "mm"},
                "weather_type": "rainfall",
            },
            "payout_rules": {
                "frequency_limit": "once_per_day_per_policy",
                "payout_percentages": {"tier1": "20.0", "tier2": "50.0", "tier3": "100.0"},
                "total_cap": "100.0",
            },
            "version": "v1.0.0",
            "is_active": True,
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
        }
    )
    monkeypatch.setattr(product_service, "create", mock)
    monkeypatch.setattr(product_service, "get_by_id", AsyncMock(return_value=None))

    response = client.post(
        "/api/v1/internal/products",
        json={
            "id": "daily_rainfall",
            "name": "Daily Rainfall Protection",
            "type": "daily",
            "weather_type": "rainfall",
            "risk_rules": {
                "time_window": {"type": "hourly", "size": 4},
                "thresholds": {"tier1": "50.0", "tier2": "100.0", "tier3": "150.0"},
                "calculation": {"aggregation": "sum", "operator": ">=", "unit": "mm"},
                "weather_type": "rainfall",
            },
            "payout_rules": {
                "frequency_limit": "once_per_day_per_policy",
                "payout_percentages": {"tier1": "20.0", "tier2": "50.0", "tier3": "100.0"},
                "total_cap": "100.0",
            },
        },
    )

    assert response.status_code == 201
    assert mock.await_count == 1
