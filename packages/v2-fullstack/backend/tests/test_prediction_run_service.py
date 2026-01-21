from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock

import pytest

from app.models.prediction_run import PredictionRun as PredictionRunModel
from app.schemas.prediction import (
    ActiveRunSwitchRequest,
    PredictionRunCreate,
    PredictionRunSource,
    PredictionRunStatus,
)
from app.services.prediction_run_service import PredictionRunService


def _result_with_scalar(value):
    result = Mock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.asyncio
async def test_create_prediction_run_persists_model():
    service = PredictionRunService()
    session = AsyncMock()
    session.add = Mock()

    payload = PredictionRunCreate(
        status=PredictionRunStatus.PROCESSING,
        source=PredictionRunSource.EXTERNAL_SYNC,
        note="sync started",
    )

    model = PredictionRunModel(
        id="run-2025-01-20-001",
        status=payload.status.value,
        source=payload.source.value,
        note=payload.note,
        created_at=datetime(2025, 1, 20, tzinfo=timezone.utc),
    )

    async def _refresh(m):
        m.created_at = datetime(2025, 1, 20, tzinfo=timezone.utc)

    session.refresh.side_effect = _refresh

    created = await service.create(session, run_id=model.id, payload=payload)

    session.add.assert_called_once()
    session.commit.assert_awaited()
    session.refresh.assert_awaited()

    assert created.id == model.id
    assert created.status == PredictionRunStatus.PROCESSING
    assert created.source == PredictionRunSource.EXTERNAL_SYNC


@pytest.mark.asyncio
async def test_switch_active_run_archives_current_and_activates_target():
    service = PredictionRunService()
    session = AsyncMock()

    current_model = PredictionRunModel(
        id="run-2025-01-20-001",
        status=PredictionRunStatus.ACTIVE.value,
        source=PredictionRunSource.EXTERNAL_SYNC.value,
        created_at=datetime(2025, 1, 20, tzinfo=timezone.utc),
    )
    target_model = PredictionRunModel(
        id="run-2025-01-21-001",
        status=PredictionRunStatus.ARCHIVED.value,
        source=PredictionRunSource.SCHEDULED_RERUN.value,
        created_at=datetime(2025, 1, 21, tzinfo=timezone.utc),
    )

    # Sequence of DB reads:
    # 1) get_by_id(target) -> returns target_model (via scalar_one_or_none)
    # 2) get_active_run() -> returns current_model
    # 3) re-fetch current_model by id -> returns current_model
    # 4) fetch target_model by id -> returns target_model
    session.execute.side_effect = [
        _result_with_scalar(target_model),
        _result_with_scalar(current_model),
        _result_with_scalar(current_model),
        _result_with_scalar(target_model),
    ]

    record = await service.switch_active_run(
        session,
        ActiveRunSwitchRequest(
            new_active_run_id=target_model.id,
            reason="switch for demo",
            operator="admin@example.com",
            scope="global",
        ),
    )

    assert current_model.status == PredictionRunStatus.ARCHIVED.value
    assert target_model.status == PredictionRunStatus.ACTIVE.value
    session.commit.assert_awaited()

    assert record.from_run_id == current_model.id
    assert record.to_run_id == target_model.id


@pytest.mark.asyncio
async def test_switch_active_run_requires_target_exists():
    service = PredictionRunService()
    session = AsyncMock()

    session.execute.return_value = _result_with_scalar(None)

    with pytest.raises(ValueError, match="PredictionRun not found"):
        await service.switch_active_run(
            session,
            ActiveRunSwitchRequest(
                new_active_run_id="run-missing",
                reason="test",
            ),
        )

