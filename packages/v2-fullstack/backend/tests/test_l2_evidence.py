from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.schemas.l2_evidence import (
    L2Claim,
    L2EvidenceMeta,
    L2EvidenceRequest,
    L2RiskEvent,
)
from app.schemas.shared import AccessMode, DataType, RegionScope, WeatherType
from app.schemas.time import TimeRangeUTC
from app.services.l2_evidence_service import L2EvidenceService


def _build_time_range() -> TimeRangeUTC:
    return TimeRangeUTC(
        start=datetime(2025, 1, 1, tzinfo=timezone.utc),
        end=datetime(2025, 1, 2, tzinfo=timezone.utc),
    )


def _build_request(
    *,
    data_type: DataType,
    access_mode: AccessMode,
    prediction_run_id: str | None = None,
) -> L2EvidenceRequest:
    return L2EvidenceRequest(
        region_scope=RegionScope.PROVINCE,
        region_code="CN-GD",
        time_range=_build_time_range(),
        data_type=data_type,
        weather_type=WeatherType.RAINFALL,
        access_mode=access_mode,
        prediction_run_id=prediction_run_id,
        page_size=10,
        cursor=0,
    )


def _build_meta(request: L2EvidenceRequest) -> L2EvidenceMeta:
    return L2EvidenceMeta(
        region_scope=request.region_scope,
        region_code=request.region_code,
        time_range=request.time_range,
        data_type=request.data_type,
        weather_type=request.weather_type,
        access_mode=request.access_mode,
        product_id=request.product_id,
        prediction_run_id=request.prediction_run_id,
        region_timezone="Asia/Shanghai",
        product_version=None,
        rules_hash=None,
        calculation_range=None,
    )


def test_l2_evidence_request_predicted_requires_run_id():
    with pytest.raises(ValueError, match="prediction_run_id required"):
        _build_request(
            data_type=DataType.PREDICTED,
            access_mode=AccessMode.ADMIN_INTERNAL,
            prediction_run_id=None,
        )


@pytest.mark.asyncio
async def test_l2_evidence_demo_force_aggregation(monkeypatch):
    service = L2EvidenceService()
    request = _build_request(
        data_type=DataType.HISTORICAL,
        access_mode=AccessMode.DEMO_PUBLIC,
        prediction_run_id=None,
    )

    monkeypatch.setattr(service, "_build_meta", AsyncMock(return_value=_build_meta(request)))
    monkeypatch.setattr(
        service,
        "_query_risk_events",
        AsyncMock(
            return_value=[
                L2RiskEvent(
                    id="evt-1",
                    timestamp=request.time_range.start,
                    tier_level=2,
                    trigger_value=10,
                    threshold_value=5,
                    weather_type=WeatherType.RAINFALL,
                    data_type=DataType.HISTORICAL,
                    prediction_run_id=None,
                )
            ]
        ),
    )
    monkeypatch.setattr(
        service,
        "_query_claims",
        AsyncMock(
            return_value=[
                L2Claim(
                    id="clm-1",
                    policy_id="pol-1",
                    tier_level=2,
                    payout_percentage=20,
                    payout_amount=1000,
                    triggered_at=request.time_range.start,
                    status="computed",
                )
            ]
        ),
    )

    response = await service.get_evidence(AsyncMock(), request)

    assert response.risk_events == []
    assert response.claims == []
    assert response.summary.risk_event_count == 1
    assert response.summary.claim_count == 1


@pytest.mark.asyncio
async def test_l2_evidence_predicted_has_no_claims(monkeypatch):
    service = L2EvidenceService()
    request = _build_request(
        data_type=DataType.PREDICTED,
        access_mode=AccessMode.ADMIN_INTERNAL,
        prediction_run_id="run-001",
    )

    monkeypatch.setattr(service, "_build_meta", AsyncMock(return_value=_build_meta(request)))
    monkeypatch.setattr(
        service,
        "_query_risk_events",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        service,
        "_query_claims",
        AsyncMock(side_effect=AssertionError("claims should not be queried for predicted")),
    )

    response = await service.get_evidence(AsyncMock(), request)

    assert response.claims == []
