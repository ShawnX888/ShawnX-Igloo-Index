"""
Claim Calculation Celery Tasks

异步计算理赔

Reference:
- docs/v2/v2实施细则/32-理赔计算任务-细则.md

硬规则:
- 只处理historical数据
- Redis分布式锁防止并发
- 幂等写入
"""

import asyncio
import hashlib
import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator, Optional

import redis
from sqlalchemy import select

from app.celery_app import celery_app
from app.db import get_sessionmaker
from app.models.policy import Policy as PolicyModel
from app.schemas.claim import ClaimCreate
from app.schemas.shared import AccessMode, DataType
from app.services.claim_service import claim_service
from app.services.compute.claim_calculator import RiskEventInput, claim_calculator
from app.services.policy_service import policy_service
from app.services.product_service import product_service
from app.services.risk_service import risk_service

logger = logging.getLogger(__name__)

# Redis客户端 (用于分布式锁)
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_lock_url = os.getenv("REDIS_LOCK_URL", redis_url.replace("/0", "/2"))
redis_client = redis.Redis.from_url(redis_lock_url, decode_responses=True)


@contextmanager
def distributed_lock(
    lock_key: str,
    timeout: int = 300
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


def _build_claim_id(policy_id: str, triggered_at: datetime, tier_level: int) -> str:
    """构造可复现理赔ID，支持幂等去重"""
    triggered_utc = (
        triggered_at.replace(tzinfo=timezone.utc)
        if triggered_at.tzinfo is None
        else triggered_at.astimezone(timezone.utc)
    )
    raw = f"{policy_id}|{triggered_utc.isoformat()}|{tier_level}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
    return f"cl_{digest}"


def _hash_payout_rules(payout_rules) -> str:
    """生成payoutRules哈希，便于审计"""
    payload = payout_rules.model_dump()
    serialized = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


async def _calculate_claims_for_policy_async(
    *,
    policy_id: str,
    time_range_start: datetime,
    time_range_end: datetime,
    product_id: Optional[str],
) -> dict:
    session_maker = get_sessionmaker()
    async with session_maker() as session:
        policy = await policy_service.get_by_id(
            session,
            policy_id,
            access_mode=AccessMode.ADMIN_INTERNAL,
        )
        if not policy:
            raise ValueError(f"policy not found: {policy_id}")

        if not policy.timezone:
            return {
                "status": "skipped",
                "reason": "missing_policy_timezone",
                "policy_id": policy_id,
            }

        product_id_final = product_id or policy.product_id
        product = await product_service.get_by_id(
            session,
            product_id_final,
            access_mode=AccessMode.ADMIN_INTERNAL,
        )
        if not product or not product.payout_rules:
            return {
                "status": "skipped",
                "reason": "missing_payout_rules",
                "policy_id": policy_id,
                "product_id": product_id_final,
            }

        risk_events = await risk_service.query_events(
            session,
            region_code=policy.coverage_region,
            weather_type=product.risk_rules.weather_type,
            data_type=DataType.HISTORICAL,
            time_range_start=time_range_start,
            time_range_end=time_range_end,
            prediction_run_id=None,
            product_id=product_id_final,
        )

        inputs = [
            RiskEventInput(
                event_id=event.id,
                timestamp=event.timestamp,
                tier_level=event.tier_level,
                region_code=event.region_code,
            )
            for event in risk_events
        ]

        claim_drafts = claim_calculator.calculate_claims(
            risk_events=inputs,
            payout_rules=product.payout_rules,
            policy_id=policy.id,
            product_id=product_id_final,
            product_version=product.version,
            coverage_amount=policy.coverage_amount,
            policy_timezone=policy.timezone,
            region_code=policy.coverage_region,
            data_type=DataType.HISTORICAL.value,
            coverage_start_utc=policy.coverage_start,
            coverage_end_utc=policy.coverage_end,
            time_range_start=time_range_start,
            time_range_end=time_range_end,
        )

        if not claim_drafts:
            return {
                "status": "completed",
                "policy_id": policy_id,
                "claims_generated": 0,
                "claims_written": 0,
                "risk_events_count": len(inputs),
            }

        rules_hash = _hash_payout_rules(product.payout_rules)
        payloads = [
            ClaimCreate(
                id=_build_claim_id(draft.policy_id, draft.triggered_at, draft.tier_level),
                policy_id=draft.policy_id,
                product_id=draft.product_id,
                risk_event_id=draft.risk_event_id,
                region_code=draft.region_code,
                tier_level=draft.tier_level,
                payout_percentage=draft.payout_percentage,
                payout_amount=draft.payout_amount,
                triggered_at=draft.triggered_at,
                period_start=draft.period_start,
                period_end=draft.period_end,
                status="computed",
                product_version=draft.product_version,
                rules_hash=rules_hash,
                source="task",
            )
            for draft in claim_drafts
        ]

        inserted_count = await claim_service.batch_create(
            session,
            payloads,
            data_type=DataType.HISTORICAL,
        )

        return {
            "status": "completed",
            "policy_id": policy_id,
            "claims_generated": len(payloads),
            "claims_written": inserted_count,
            "risk_events_count": len(inputs),
        }


@celery_app.task(bind=True, max_retries=3)
def calculate_claims_for_policy_task(
    self,
    policy_id: str,
    time_range_start: str,
    time_range_end: str,
    product_id: str = None
):
    """
    计算单个保单的理赔
    
    Args:
        policy_id: 保单ID
        time_range_start: 起始时间(UTC ISO)
        time_range_end: 结束时间(UTC ISO)
        product_id: 产品ID(可选)
    """
    start_dt = _parse_utc_datetime(time_range_start)
    end_dt = _parse_utc_datetime(time_range_end)
    # 分布式锁: 同一保单 + 同一结算窗口互斥
    lock_key = (
        f"claim_calc:{policy_id}:{start_dt.isoformat()}:{end_dt.isoformat()}"
    )
    
    with distributed_lock(lock_key) as acquired:
        if not acquired:
            logger.warning(
                f"Policy {policy_id} is being processed by another worker, skipping."
            )
            return {
                "status": "skipped",
                "reason": "concurrent_lock"
            }
        
        logger.info(
            f"Calculating claims for policy: {policy_id}",
            extra={
                "policy_id": policy_id,
                "time_range_start": start_dt.isoformat(),
                "time_range_end": end_dt.isoformat(),
            }
        )

        try:
            return asyncio.run(
                _calculate_claims_for_policy_async(
                    policy_id=policy_id,
                    time_range_start=start_dt,
                    time_range_end=end_dt,
                    product_id=product_id,
                )
            )
        except Exception as exc:
            logger.exception(
                "Claim calculation task failed",
                extra={
                    "policy_id": policy_id,
                    "time_range_start": start_dt.isoformat(),
                    "time_range_end": end_dt.isoformat(),
                },
            )
            raise exc


@celery_app.task(bind=True, max_retries=3)
def calculate_claims_batch_task(
    self,
    time_range_start: str,
    time_range_end: str,
    region_code: str = None,
    product_id: str = None
):
    """
    批量计算理赔
    
    Args:
        time_range_start: 起始时间(UTC ISO)
        time_range_end: 结束时间(UTC ISO)
        region_code: 区域代码(可选,用于分片)
        product_id: 产品ID(可选,用于过滤)
    """
    logger.info(
        f"Starting batch claim calculation",
        extra={
            "time_range_start": time_range_start,
            "time_range_end": time_range_end,
            "region_code": region_code,
            "product_id": product_id,
        }
    )
    start_dt = _parse_utc_datetime(time_range_start)
    end_dt = _parse_utc_datetime(time_range_end)

    session_maker = get_sessionmaker()
    async def _dispatch() -> dict:
        async with session_maker() as session:
            query = select(PolicyModel).where(PolicyModel.is_active == True)
            if region_code:
                query = query.where(PolicyModel.coverage_region == region_code)
            if product_id:
                query = query.where(PolicyModel.product_id == product_id)

            result = await session.execute(query.order_by(PolicyModel.id))
            policies = list(result.scalars().all())

        for policy in policies:
            calculate_claims_for_policy_task.delay(
                policy_id=policy.id,
                time_range_start=start_dt.isoformat(),
                time_range_end=end_dt.isoformat(),
                product_id=policy.product_id,
            )

        return {
            "status": "queued",
            "policies_processed": len(policies),
        }

    return asyncio.run(_dispatch())
