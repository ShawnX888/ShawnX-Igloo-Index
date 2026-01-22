"""
Risk Calculation Celery Tasks

异步计算风险事件

Reference:
- docs/v2/v2实施细则/15-风险事件计算任务-细则.md
"""

import asyncio
import hashlib
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator, Optional

import redis
from sqlalchemy import select

from app.celery_app import celery_app
from app.db import get_sessionmaker
from app.models.risk_event import RiskEvent as RiskEventModel
from app.schemas.risk_event import RiskEventCreate
from app.schemas.shared import AccessMode, DataType
from app.schemas.time import TimeRangeUTC, TimeWindowType
from app.schemas.weather import WeatherQueryRequest
from app.services.compute.risk_calculator import risk_calculator
from app.services.product_service import product_service
from app.services.risk_service import risk_service
from app.services.weather_service import weather_service
from app.utils.time_utils import calculate_extended_range, get_timezone_for_region

logger = logging.getLogger(__name__)

# Redis客户端 (用于分布式锁)
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
# 使用db=2专门用于锁（与 REDIS_URL 分离）
redis_lock_url = os.getenv("REDIS_LOCK_URL", redis_url.replace("/0", "/2"))
redis_client = redis.Redis.from_url(redis_lock_url, decode_responses=True)


@contextmanager
def distributed_lock(
    lock_key: str,
    timeout: int = 600
) -> Generator[bool, None, None]:
    """
    Redis分布式锁

    Args:
        lock_key: 锁键
        timeout: 超时时间(秒)

    Yields:
        是否获取到锁
    """
    lock = redis_client.lock(lock_key, timeout=timeout)
    acquired = lock.acquire(blocking=False)

    try:
        yield acquired
    finally:
        if acquired:
            try:
                lock.release()
            except redis.exceptions.LockError:
                pass  # 锁已过期


def _parse_utc_datetime(value: str) -> datetime:
    """解析ISO时间为UTC datetime"""
    if not value:
        raise ValueError("time_range value must not be empty")
    normalized = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _build_risk_event_id(
    *,
    product_id: str,
    product_version: str,
    region_code: str,
    event_time: datetime,
    weather_type: str,
    tier_level: int,
    data_type: str,
    prediction_run_id: Optional[str],
) -> str:
    """构造可复现的风险事件ID，支持幂等去重"""
    event_time_utc = (
        event_time.replace(tzinfo=timezone.utc)
        if event_time.tzinfo is None
        else event_time.astimezone(timezone.utc)
    )
    raw = "|".join(
        [
            product_id,
            product_version,
            region_code,
            event_time_utc.isoformat(),
            weather_type,
            str(tier_level),
            data_type,
            prediction_run_id or "null",
        ]
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
    return f"re_{digest}"


async def _calculate_risk_events_async(
    *,
    product_id: str,
    region_code: str,
    time_range_start: datetime,
    time_range_end: datetime,
    trace_id: Optional[str],
    correlation_id: Optional[str],
) -> dict:
    session_maker = get_sessionmaker()
    async with session_maker() as session:
        product = await product_service.get_by_id(
            session,
            product_id,
            access_mode=AccessMode.ADMIN_INTERNAL,
        )
        if not product:
            raise ValueError(f"product not found: {product_id}")

        region_timezone = get_timezone_for_region(region_code)
        time_range = TimeRangeUTC(
            start=time_range_start,
            end=time_range_end,
            region_timezone=region_timezone,
        )
        window_type = TimeWindowType(product.risk_rules.time_window.type)
        calculation_range = calculate_extended_range(
            time_range,
            window_type,
            window_duration=product.risk_rules.time_window.size,
        )

        weather_request = WeatherQueryRequest(
            region_code=region_code,
            weather_type=product.risk_rules.weather_type,
            start_time=calculation_range.calculation_start,
            end_time=calculation_range.calculation_end,
            data_type=DataType.HISTORICAL,
            prediction_run_id=None,
        )
        weather_data = await weather_service.query_time_series(session, weather_request)

        if not weather_data:
            return {
                "status": "completed",
                "events_calculated": 0,
                "events_written": 0,
                "product_id": product_id,
                "region_code": region_code,
                "trace_id": trace_id,
                "correlation_id": correlation_id,
            }

        events = risk_calculator.calculate_risk_events(
            weather_data,
            product.risk_rules,
            product_id,
            product.version,
            region_timezone,
            time_range.start,
            time_range.end,
        )
        if not events:
            return {
                "status": "completed",
                "events_calculated": 0,
                "events_written": 0,
                "product_id": product_id,
                "region_code": region_code,
                "trace_id": trace_id,
                "correlation_id": correlation_id,
            }

        payloads = [
            RiskEventCreate(
                id=_build_risk_event_id(
                    product_id=product_id,
                    product_version=product.version,
                    region_code=event.region_code,
                    event_time=event.timestamp,
                    weather_type=event.weather_type.value,
                    tier_level=event.tier_level,
                    data_type=event.data_type.value,
                    prediction_run_id=event.prediction_run_id,
                ),
                timestamp=event.timestamp,
                region_code=event.region_code,
                product_id=event.product_id,
                product_version=event.product_version,
                weather_type=event.weather_type,
                tier_level=event.tier_level,
                trigger_value=event.trigger_value,
                threshold_value=event.threshold_value,
                data_type=event.data_type,
                prediction_run_id=event.prediction_run_id,
            )
            for event in events
        ]

        existing_ids = set()
        if payloads:
            result = await session.execute(
                select(RiskEventModel.id).where(
                    RiskEventModel.id.in_([payload.id for payload in payloads])
                )
            )
            existing_ids = set(result.scalars().all())

        new_payloads = [item for item in payloads if item.id not in existing_ids]
        if new_payloads:
            await risk_service.batch_create(session, new_payloads)

        return {
            "status": "completed",
            "events_calculated": len(payloads),
            "events_written": len(new_payloads),
            "events_skipped": len(existing_ids),
            "product_id": product_id,
            "region_code": region_code,
            "trace_id": trace_id,
            "correlation_id": correlation_id,
        }


@celery_app.task(bind=True, max_retries=3)
def calculate_risk_events_task(
    self,
    product_id: str,
    region_code: str,
    time_range_start: str,
    time_range_end: str,
    prediction_run_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
):
    """
    计算风险事件任务
    
    Args:
        product_id: 产品ID
        region_code: 区域代码
        time_range_start: 起始时间(UTC ISO)
        time_range_end: 结束时间(UTC ISO)
        prediction_run_id: 预测批次ID(可选)
    """
    if prediction_run_id:
        logger.error(
            "Predicted risk events are not allowed in risk_calculation task",
            extra={
                "product_id": product_id,
                "region_code": region_code,
                "prediction_run_id": prediction_run_id,
            },
        )
        return {
            "status": "skipped",
            "reason": "predicted_not_supported",
            "product_id": product_id,
            "region_code": region_code,
            "prediction_run_id": prediction_run_id,
        }

    start_dt = _parse_utc_datetime(time_range_start)
    end_dt = _parse_utc_datetime(time_range_end)
    lock_key = (
        "risk_calc:"
        f"{product_id}:{region_code}:{start_dt.isoformat()}:{end_dt.isoformat()}"
    )

    with distributed_lock(lock_key) as acquired:
        if not acquired:
            logger.warning(
                "Risk calculation is already running, skipping.",
                extra={
                    "product_id": product_id,
                    "region_code": region_code,
                    "time_range_start": time_range_start,
                    "time_range_end": time_range_end,
                },
            )
            return {
                "status": "skipped",
                "reason": "concurrent_lock",
                "product_id": product_id,
                "region_code": region_code,
            }

        logger.info(
            "Calculating risk events",
            extra={
                "product_id": product_id,
                "region_code": region_code,
                "time_range_start": start_dt.isoformat(),
                "time_range_end": end_dt.isoformat(),
                "trace_id": trace_id,
                "correlation_id": correlation_id,
            },
        )

        try:
            return asyncio.run(
                _calculate_risk_events_async(
                    product_id=product_id,
                    region_code=region_code,
                    time_range_start=start_dt,
                    time_range_end=end_dt,
                    trace_id=trace_id,
                    correlation_id=correlation_id,
                )
            )
        except Exception as exc:
            logger.exception(
                "Risk calculation task failed",
                extra={
                    "product_id": product_id,
                    "region_code": region_code,
                    "time_range_start": time_range_start,
                    "time_range_end": time_range_end,
                    "trace_id": trace_id,
                    "correlation_id": correlation_id,
                },
            )
            raise exc
    # NOTE: 缓存失效由数据产品层控制；任务仅产出事实 risk_events
