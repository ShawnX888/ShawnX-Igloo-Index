from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_access_mode, get_session
from app.api.v1.internal import policies
from app.schemas.shared import AccessMode
from app.services.policy_service import policy_service


async def _override_get_session():
    yield AsyncMock()


def _build_client(access_mode: AccessMode) -> TestClient:
    app = FastAPI()
    app.include_router(policies.router, prefix="/api/v1")
    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_access_mode] = lambda: access_mode
    return TestClient(app)


def test_internal_create_policy_requires_admin():
    client = _build_client(AccessMode.DEMO_PUBLIC)
    response = client.post(
        "/api/v1/internal/policies",
        json={
            "id": "pol-001",
            "policy_number": "POL-2025-001",
            "product_id": "daily_rainfall",
            "coverage_region": "CN-GD",
            "coverage_amount": "50000.00",
            "timezone": "Asia/Shanghai",
            "coverage_start": "2025-01-01T00:00:00Z",
            "coverage_end": "2025-12-31T00:00:00Z",
            "holder_name": "张三",
            "is_active": True,
        },
    )
    assert response.status_code == 403


def test_internal_create_policy_calls_service(monkeypatch):
    client = _build_client(AccessMode.ADMIN_INTERNAL)
    mock = AsyncMock(
        return_value={
            "id": "pol-001",
            "policy_number": "POL-2025-001",
            "product_id": "daily_rainfall",
            "coverage_region": "CN-GD",
            "coverage_amount": "50000.00",
            "timezone": "Asia/Shanghai",
            "coverage_start": "2025-01-01T00:00:00Z",
            "coverage_end": "2025-12-31T00:00:00Z",
            "holder_name": "张三",
            "is_active": True,
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
        }
    )
    monkeypatch.setattr(policy_service, "create", mock)

    response = client.post(
        "/api/v1/internal/policies",
        json={
            "id": "pol-001",
            "policy_number": "POL-2025-001",
            "product_id": "daily_rainfall",
            "coverage_region": "CN-GD",
            "coverage_amount": "50000.00",
            "timezone": "Asia/Shanghai",
            "coverage_start": "2025-01-01T00:00:00Z",
            "coverage_end": "2025-12-31T00:00:00Z",
            "holder_name": "张三",
            "is_active": True,
        },
    )

    assert response.status_code == 201
    assert mock.await_count == 1
