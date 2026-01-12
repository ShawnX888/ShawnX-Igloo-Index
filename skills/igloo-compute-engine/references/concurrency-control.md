# Concurrency Control

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Redis Distributed Lock](#redis-distributed-lock)
3. [Database Row Lock](#database-row-lock)
4. [Combined Strategy](#combined-strategy)
5. [Celery Task Patterns](#celery-task-patterns)

---

## Problem Statement

### Race Condition Scenario

```
Celery Worker 1                    Celery Worker 2
     |                                  |
     v                                  v
Read risk events                   Read risk events
     |                                  |
     v                                  v
Calculate claims                   Calculate claims
     |                                  |
     v                                  v
Insert claim (tier2)               Insert claim (tier2)  ← DUPLICATE!
```

### Solution: Double-Lock Strategy

1. **Redis Distributed Lock**: Prevent concurrent task execution
2. **Database Row Lock**: Ensure data consistency within transaction

---

## Redis Distributed Lock

### Lock Key Format

```
lock:claim_calc:{policy_id}:{local_date}
```

Example: `lock:claim_calc:12345:2025-01-27`

### Implementation with redis-py

```python
import redis
from contextlib import asynccontextmanager
from datetime import timedelta

class DistributedLock:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    @asynccontextmanager
    async def acquire(
        self, 
        key: str, 
        timeout: int = 60,
        blocking: bool = True,
        blocking_timeout: float = 10.0
    ):
        """Acquire distributed lock with auto-release."""
        lock = self.redis.lock(
            key,
            timeout=timeout,
            blocking=blocking,
            blocking_timeout=blocking_timeout
        )
        
        acquired = await lock.acquire()
        if not acquired:
            raise LockNotAcquiredError(f"Could not acquire lock: {key}")
        
        try:
            yield lock
        finally:
            await lock.release()

class LockNotAcquiredError(Exception):
    pass
```

### Usage in Claim Calculation

```python
async def calculate_claims_with_lock(
    redis: redis.Redis,
    policy_id: int,
    local_date: str
):
    lock_key = f"lock:claim_calc:{policy_id}:{local_date}"
    lock_manager = DistributedLock(redis)
    
    try:
        async with lock_manager.acquire(lock_key, timeout=120):
            # Safe to calculate
            await do_claim_calculation(policy_id, local_date)
    except LockNotAcquiredError:
        # Another worker is processing this policy/date
        logger.info(f"Skipping {policy_id}/{local_date}: lock held by another worker")
        return
```

---

## Database Row Lock

### SELECT ... FOR UPDATE

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

async def lock_and_process_events(
    session: AsyncSession,
    policy_id: int,
    start_time: datetime,
    end_time: datetime
) -> list[RiskEvent]:
    """Lock risk events for processing."""
    result = await session.execute(
        select(RiskEvent)
        .where(
            RiskEvent.policy_id == policy_id,
            RiskEvent.timestamp >= start_time,
            RiskEvent.timestamp < end_time
        )
        .with_for_update()  # Lock rows
        .order_by(RiskEvent.timestamp)
    )
    return list(result.scalars().all())
```

### Transaction Boundary

```python
async def process_in_transaction(
    session: AsyncSession,
    policy_id: int
):
    async with session.begin():
        # Lock events
        events = await lock_and_process_events(session, policy_id, start, end)
        
        # Check existing claims
        existing = await get_existing_claims(session, policy_id, start, end)
        
        # Calculate new claims
        new_claims = calculator.calculate(events, policy, existing)
        
        # Insert claims
        for claim in new_claims:
            session.add(Claim(**claim.__dict__))
        
        # Commit happens automatically on context exit
```

---

## Combined Strategy

### Full Implementation

```python
from datetime import datetime, date
import pytz
import redis
from sqlalchemy.ext.asyncio import AsyncSession

async def process_policy_claims(
    session: AsyncSession,
    redis_client: redis.Redis,
    policy: Policy,
    target_date: date
) -> list[Claim]:
    """Process claims with full concurrency control."""
    
    # 1. Generate lock key (local date)
    tz = pytz.timezone(policy.timezone)
    local_date_str = target_date.strftime("%Y-%m-%d")
    lock_key = f"lock:claim_calc:{policy.id}:{local_date_str}"
    
    # 2. Acquire Redis lock
    lock = redis_client.lock(lock_key, timeout=120)
    if not lock.acquire(blocking=True, blocking_timeout=10):
        raise LockNotAcquiredError(f"Lock busy: {lock_key}")
    
    try:
        # 3. Get UTC time range for local date
        start_utc, end_utc = local_date_to_utc_range(target_date, policy.timezone)
        
        # 4. Database transaction with row lock
        async with session.begin():
            # Lock risk events
            events = await session.execute(
                select(RiskEvent)
                .where(
                    RiskEvent.region == policy.coverage_region,
                    RiskEvent.timestamp >= start_utc,
                    RiskEvent.timestamp < end_utc
                )
                .with_for_update()
            )
            events = list(events.scalars().all())
            
            # Get existing claims (no lock needed - we're the only writer)
            existing = await session.execute(
                select(Claim)
                .where(
                    Claim.policy_id == policy.id,
                    Claim.trigger_timestamp >= start_utc,
                    Claim.trigger_timestamp < end_utc
                )
            )
            existing = list(existing.scalars().all())
            
            # Calculate
            calculator = ClaimCalculator(
                payout_rules=get_payout_rules(policy.product_id),
                frequency=get_frequency(policy.product_id)
            )
            new_claims = calculator.calculate(events, policy, existing)
            
            # Insert
            created = []
            for claim_data in new_claims:
                claim = Claim(**claim_data.__dict__)
                session.add(claim)
                created.append(claim)
            
            # Commit on context exit
        
        return created
    
    finally:
        # 5. Always release Redis lock
        lock.release()
```

---

## Celery Task Patterns

### Idempotent Task

```python
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    autoretry_for=(LockNotAcquiredError,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=5
)
def calculate_policy_claims_task(self, policy_id: int, date_str: str):
    """Calculate claims for a policy on a specific date."""
    try:
        with get_sync_session() as session:
            with get_redis() as redis_client:
                policy = session.get(Policy, policy_id)
                target_date = date.fromisoformat(date_str)
                
                claims = process_policy_claims_sync(
                    session, redis_client, policy, target_date
                )
                
                logger.info(
                    f"Created {len(claims)} claims for policy {policy_id} on {date_str}"
                )
                return {"created": len(claims)}
    
    except LockNotAcquiredError as e:
        logger.warning(f"Lock not acquired, will retry: {e}")
        raise self.retry(exc=e)
```

### Batch Processing with Lock

```python
@shared_task
def calculate_all_claims_for_date(date_str: str):
    """Process all policies for a given date."""
    target_date = date.fromisoformat(date_str)
    
    with get_sync_session() as session:
        policies = session.execute(
            select(Policy)
            .where(
                Policy.coverage_start <= target_date,
                Policy.coverage_end >= target_date
            )
        ).scalars().all()
    
    # Fan out to individual tasks
    for policy in policies:
        calculate_policy_claims_task.delay(policy.id, date_str)
```

### Preventing Duplicate Tasks

```python
from celery import Task

class UniqueTask(Task):
    """Base task that prevents duplicate execution."""
    
    def __init__(self):
        self.redis = None
    
    def before_start(self, task_id, args, kwargs):
        self.redis = get_redis()
        unique_key = f"task:running:{self.name}:{args}:{kwargs}"
        
        if not self.redis.set(unique_key, task_id, nx=True, ex=3600):
            raise Ignore()  # Task already running
    
    def after_return(self, status, retval, task_id, args, kwargs, einfo):
        if self.redis:
            unique_key = f"task:running:{self.name}:{args}:{kwargs}"
            self.redis.delete(unique_key)

@shared_task(base=UniqueTask)
def unique_claim_calculation(policy_id: int, date_str: str):
    """This task will only run once for the same arguments."""
    ...
```
