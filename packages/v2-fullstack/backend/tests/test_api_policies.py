from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_access_mode, get_session
from app.api.v1 import policies
from app.schemas.shared import AccessMode
from app.services.policy_service import policy_service


async def _override_get_session():
    yield AsyncMock()


def _build_client(access_mode: AccessMode) -> TestClient:
    app = FastAPI()
    app.include_router(policies.router, prefix="/api/v1")
    app.include_router(policies.stats_router, prefix="/api/v1")
    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_access_mode] = lambda: access_mode
    return TestClient(app)


def test_list_policies_calls_service(monkeypatch):
    client = _build_client(AccessMode.DEMO_PUBLIC)
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(policy_service, "list_by_filter", mock)

    response = client.get("/api/v1/policies")

    assert response.status_code == 200
    assert response.json() == []
    assert mock.await_count == 1


def test_get_policy_returns_404(monkeypatch):
    client = _build_client(AccessMode.DEMO_PUBLIC)
    mock = AsyncMock(return_value=None)
    monkeypatch.setattr(policy_service, "get_by_id", mock)

    response = client.get("/api/v1/policies/pol-missing")

    assert response.status_code == 404


def test_get_policy_stats(monkeypatch):
    client = _build_client(AccessMode.DEMO_PUBLIC)
    mock = AsyncMock(return_value={"policy_count": 0, "coverage_amount_sum": None})
    monkeypatch.setattr(policy_service, "get_stats", mock)

    response = client.get("/api/v1/statistics/policies")

    assert response.status_code == 200
    assert response.json()["policy_count"] == 0
