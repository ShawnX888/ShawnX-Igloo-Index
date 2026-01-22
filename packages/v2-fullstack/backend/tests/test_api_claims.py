from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_access_mode, get_session
from app.api.v1 import claims
from app.schemas.shared import AccessMode
from app.services.claim_service import claim_service


async def _override_get_session():
    yield AsyncMock()


def _build_client(access_mode: AccessMode) -> TestClient:
    app = FastAPI()
    app.include_router(claims.router, prefix="/api/v1")
    app.include_router(claims.policy_router, prefix="/api/v1")
    app.include_router(claims.stats_router, prefix="/api/v1")
    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_access_mode] = lambda: access_mode
    return TestClient(app)


def test_create_claim_requires_admin():
    client = _build_client(AccessMode.DEMO_PUBLIC)
    response = client.post(
        "/api/v1/claims",
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


def test_list_claims_calls_service(monkeypatch):
    client = _build_client(AccessMode.DEMO_PUBLIC)
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(claim_service, "list_by_filter", mock)

    response = client.get("/api/v1/claims")

    assert response.status_code == 200
    assert response.json() == []
    assert mock.await_count == 1


def test_get_claim_returns_404(monkeypatch):
    client = _build_client(AccessMode.DEMO_PUBLIC)
    mock = AsyncMock(return_value=None)
    monkeypatch.setattr(claim_service, "get_by_id", mock)

    response = client.get("/api/v1/claims/clm-missing")

    assert response.status_code == 404


def test_list_claims_by_policy(monkeypatch):
    client = _build_client(AccessMode.DEMO_PUBLIC)
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(claim_service, "list_by_policy", mock)

    response = client.get("/api/v1/policies/pol-001/claims")

    assert response.status_code == 200
    assert response.json() == []
    assert mock.await_count == 1


def test_get_claim_stats(monkeypatch):
    client = _build_client(AccessMode.DEMO_PUBLIC)
    mock = AsyncMock(return_value={"claim_count": 0, "payout_amount_sum": None})
    monkeypatch.setattr(claim_service, "get_stats", mock)

    response = client.get("/api/v1/statistics/claims")

    assert response.status_code == 200
    assert response.json()["claim_count"] == 0
