from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_access_mode, get_session
from app.api.v1.internal import claims
from app.schemas.shared import AccessMode
from app.services.claim_service import claim_service


async def _override_get_session():
    yield AsyncMock()


def _build_client(access_mode: AccessMode) -> TestClient:
    app = FastAPI()
    app.include_router(claims.router, prefix="/api/v1")
    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_access_mode] = lambda: access_mode
    return TestClient(app)


def test_internal_create_claim_requires_admin():
    client = _build_client(AccessMode.DEMO_PUBLIC)
    response = client.post(
        "/api/v1/internal/claims",
        json={
            "id": "clm-001",
            "policy_id": "pol-001",
            "product_id": "daily_rainfall",
            "region_code": "CN-GD",
            "tier_level": 1,
            "payout_percentage": "20.00",
            "payout_amount": "10000.00",
            "triggered_at": "2025-01-20T10:00:00Z",
            "product_version": "v1.0.0",
        },
    )
    assert response.status_code == 403


def test_internal_create_claim_calls_service(monkeypatch):
    client = _build_client(AccessMode.ADMIN_INTERNAL)
    mock = AsyncMock(
        return_value={
            "id": "clm-001",
            "policy_id": "pol-001",
            "product_id": "daily_rainfall",
            "risk_event_id": None,
            "region_code": "CN-GD",
            "tier_level": 1,
            "payout_percentage": "20.00",
            "payout_amount": "10000.00",
            "currency": "CNY",
            "triggered_at": "2025-01-20T10:00:00Z",
            "period_start": None,
            "period_end": None,
            "status": "computed",
            "product_version": "v1.0.0",
            "rules_hash": None,
            "source": "task",
            "created_at": "2025-01-20T10:00:00Z",
            "updated_at": "2025-01-20T10:00:00Z",
        }
    )
    monkeypatch.setattr(claim_service, "create", mock)

    response = client.post(
        "/api/v1/internal/claims",
        json={
            "id": "clm-001",
            "policy_id": "pol-001",
            "product_id": "daily_rainfall",
            "region_code": "CN-GD",
            "tier_level": 1,
            "payout_percentage": "20.00",
            "payout_amount": "10000.00",
            "triggered_at": "2025-01-20T10:00:00Z",
            "product_version": "v1.0.0",
        },
    )

    assert response.status_code == 201
    assert mock.await_count == 1
