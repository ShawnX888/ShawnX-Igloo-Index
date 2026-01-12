# Concurrent Control Testing

## Table of Contents

1. [Redis Lock Testing](#redis-lock-testing)
2. [Database Lock Testing](#database-lock-testing)
3. [Race Condition Simulation](#race-condition-simulation)
4. [Idempotency Testing](#idempotency-testing)
5. [Integration Testing](#integration-testing)

---

## Redis Lock Testing

### Lock Acquisition Test

```python
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
import redis.asyncio as redis

@pytest.fixture
def mock_redis():
    """Create mock Redis client."""
    client = AsyncMock(spec=redis.Redis)
    lock = AsyncMock()
    lock.acquire.return_value = True
    lock.release.return_value = None
    client.lock.return_value = lock
    return client

async def test_lock_acquired_before_calculation(mock_redis):
    """Verify lock is acquired before claim calculation."""
    lock = mock_redis.lock.return_value
    
    await process_policy_claims(
        session=mock_session,
        redis_client=mock_redis,
        policy=test_policy,
        target_date=date(2025, 1, 15)
    )
    
    # Verify lock was acquired
    mock_redis.lock.assert_called_once_with(
        f"lock:claim_calc:{test_policy.id}:2025-01-15",
        timeout=120
    )
    lock.acquire.assert_called_once()
    lock.release.assert_called_once()

async def test_lock_released_on_error(mock_redis):
    """Verify lock is released even when calculation fails."""
    lock = mock_redis.lock.return_value
    
    with pytest.raises(CalculationError):
        await process_policy_claims_with_error(
            redis_client=mock_redis,
            policy=test_policy
        )
    
    # Lock should still be released
    lock.release.assert_called_once()
```

### Lock Contention Test

```python
async def test_lock_contention_skips_duplicate():
    """When lock is held, second request should skip."""
    redis_client = await get_test_redis()
    policy_id = 12345
    date_str = "2025-01-15"
    lock_key = f"lock:claim_calc:{policy_id}:{date_str}"
    
    # First worker acquires lock
    lock1 = redis_client.lock(lock_key, timeout=60)
    acquired1 = await lock1.acquire(blocking=False)
    assert acquired1 is True
    
    try:
        # Second worker tries to acquire
        lock2 = redis_client.lock(lock_key, timeout=60)
        acquired2 = await lock2.acquire(blocking=False)
        assert acquired2 is False  # Should fail
        
    finally:
        await lock1.release()
```

### Lock Timeout Test

```python
async def test_lock_timeout_recovery():
    """Lock should expire after timeout, allowing recovery."""
    redis_client = await get_test_redis()
    lock_key = "lock:claim_calc:test:2025-01-15"
    
    # Acquire with short timeout
    lock1 = redis_client.lock(lock_key, timeout=2)
    await lock1.acquire()
    
    # Don't release - simulate crash
    
    # Wait for timeout
    await asyncio.sleep(3)
    
    # Another worker should be able to acquire
    lock2 = redis_client.lock(lock_key, timeout=60)
    acquired = await lock2.acquire(blocking=False)
    assert acquired is True
    
    await lock2.release()
```

---

## Database Lock Testing

### SELECT FOR UPDATE Test

```python
async def test_for_update_blocks_concurrent_read(db_session):
    """FOR UPDATE should block other transactions from reading."""
    
    # Create test data
    event = await create_test_risk_event(db_session)
    await db_session.commit()
    
    results = []
    
    async def transaction1():
        async with db_session.begin():
            # Lock the row
            result = await db_session.execute(
                select(RiskEvent)
                .where(RiskEvent.id == event.id)
                .with_for_update()
            )
            results.append(("t1", "locked"))
            await asyncio.sleep(0.5)  # Hold lock
            results.append(("t1", "released"))
    
    async def transaction2():
        await asyncio.sleep(0.1)  # Start slightly after t1
        async with db_session.begin():
            # Try to lock same row
            result = await db_session.execute(
                select(RiskEvent)
                .where(RiskEvent.id == event.id)
                .with_for_update()
            )
            results.append(("t2", "acquired"))
    
    await asyncio.gather(transaction1(), transaction2())
    
    # t2 should acquire after t1 releases
    assert results == [
        ("t1", "locked"),
        ("t1", "released"),
        ("t2", "acquired")
    ]
```

### Deadlock Prevention Test

```python
async def test_consistent_lock_ordering_prevents_deadlock(db_session):
    """Acquiring locks in consistent order prevents deadlocks."""
    
    events = [
        await create_test_risk_event(db_session, id=1),
        await create_test_risk_event(db_session, id=2),
    ]
    await db_session.commit()
    
    deadlock_occurred = False
    
    async def process_events(event_ids: list[int]):
        nonlocal deadlock_occurred
        try:
            async with db_session.begin():
                # ALWAYS sort IDs to ensure consistent ordering
                sorted_ids = sorted(event_ids)
                for eid in sorted_ids:
                    await db_session.execute(
                        select(RiskEvent)
                        .where(RiskEvent.id == eid)
                        .with_for_update()
                    )
                await asyncio.sleep(0.1)
        except Exception as e:
            if "deadlock" in str(e).lower():
                deadlock_occurred = True
    
    # Run concurrent transactions
    await asyncio.gather(
        process_events([1, 2]),
        process_events([2, 1]),  # Different order, but sorted internally
    )
    
    assert not deadlock_occurred
```

---

## Race Condition Simulation

### Parallel Claim Calculation Test

```python
async def test_parallel_calculation_no_duplicates():
    """Parallel calculations should not create duplicate claims."""
    
    redis_client = await get_test_redis()
    policy = await create_test_policy()
    events = [await create_test_risk_event() for _ in range(5)]
    
    async def calculate_worker(worker_id: int):
        return await process_policy_claims(
            redis_client=redis_client,
            policy=policy,
            target_date=date(2025, 1, 15)
        )
    
    # Run 5 parallel calculations
    results = await asyncio.gather(*[
        calculate_worker(i) for i in range(5)
    ], return_exceptions=True)
    
    # Count successful results (non-exceptions)
    successful = [r for r in results if not isinstance(r, Exception)]
    
    # Only one should succeed (others should be locked out or return empty)
    total_claims = sum(len(r) for r in successful if r)
    
    # Should not have duplicates
    async with get_session() as session:
        all_claims = await session.execute(
            select(Claim).where(Claim.policy_id == policy.id)
        )
        actual_claims = list(all_claims.scalars())
    
    assert len(actual_claims) == total_claims
    verify_no_duplicate_claims(actual_claims)
```

### Interleaved Event Processing

```python
async def test_interleaved_events_consistent():
    """Interleaved event arrival should produce consistent results."""
    
    policy = create_test_policy()
    calculator = ClaimCalculator(TIER_PAYOUTS, "once_per_day")
    
    # Simulate events arriving in different orders
    events = [
        create_risk_event(tier="tier1", hour=10),
        create_risk_event(tier="tier2", hour=14),
        create_risk_event(tier="tier3", hour=18),
    ]
    
    # Process in different orders
    orders = [
        [0, 1, 2],  # Ascending tier
        [2, 1, 0],  # Descending tier
        [1, 0, 2],  # Mixed
        [2, 0, 1],  # Mixed
    ]
    
    results = []
    for order in orders:
        ordered_events = [events[i] for i in order]
        claims = calculator.calculate(ordered_events, policy, [])
        total_payout = sum(c.payout_percentage for c in claims)
        results.append(total_payout)
    
    # All orders should produce same total payout
    assert all(r == results[0] for r in results), \
        f"Inconsistent results for different orderings: {results}"
```

---

## Idempotency Testing

### Repeated Calculation Test

```python
async def test_calculation_idempotent():
    """Running calculation multiple times produces same result."""
    
    policy = await create_test_policy()
    events = [await create_test_risk_event() for _ in range(3)]
    
    # First calculation
    claims1 = await calculate_claims(policy, events)
    
    # Second calculation (same inputs)
    claims2 = await calculate_claims(policy, events)
    
    # Results should be identical
    assert len(claims1) == len(claims2)
    for c1, c2 in zip(claims1, claims2):
        assert c1.tier_level == c2.tier_level
        assert c1.payout_percentage == c2.payout_percentage

async def test_no_duplicate_claims_on_retry():
    """Retrying calculation doesn't create duplicate claims."""
    
    async with get_session() as session:
        policy = await create_and_persist_policy(session)
        events = [await create_and_persist_event(session) for _ in range(3)]
        await session.commit()
        
        # First run
        await run_claim_calculation_task(policy.id, "2025-01-15")
        claims1 = await get_claims_for_policy(session, policy.id)
        
        # Retry (simulating task retry)
        await run_claim_calculation_task(policy.id, "2025-01-15")
        claims2 = await get_claims_for_policy(session, policy.id)
        
        # Same number of claims
        assert len(claims1) == len(claims2)
```

### Celery Task Idempotency

```python
from celery import states

def test_celery_task_idempotent():
    """Celery task is idempotent on retry."""
    
    task = calculate_policy_claims_task
    
    # First execution
    result1 = task.apply(args=[policy_id, "2025-01-15"])
    assert result1.state == states.SUCCESS
    claims_after_1 = get_claim_count(policy_id)
    
    # Simulate retry
    result2 = task.apply(args=[policy_id, "2025-01-15"])
    assert result2.state == states.SUCCESS
    claims_after_2 = get_claim_count(policy_id)
    
    # No new claims created
    assert claims_after_1 == claims_after_2
```

---

## Integration Testing

### Full Concurrent Scenario

```python
@pytest.mark.integration
async def test_full_concurrent_calculation_scenario():
    """Integration test: Multiple workers, multiple policies."""
    
    # Setup
    redis_client = await get_real_redis()
    policies = [await create_test_policy() for _ in range(10)]
    for policy in policies:
        for _ in range(5):
            await create_test_risk_event(policy.coverage_region)
    
    # Run concurrent calculations
    async def worker(policy: Policy):
        return await process_policy_claims(
            redis_client=redis_client,
            policy=policy,
            target_date=date(2025, 1, 15)
        )
    
    # 3 workers per policy, all running concurrently
    tasks = []
    for policy in policies:
        for _ in range(3):
            tasks.append(worker(policy))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Verify invariants
    async with get_session() as session:
        for policy in policies:
            claims = await get_claims_for_policy(session, policy.id)
            verify_no_duplicate_claims(claims)
            verify_period_payout_invariant(claims, policy)

@pytest.mark.integration
async def test_concurrent_with_db_failure_recovery():
    """System recovers from DB failure during concurrent processing."""
    
    redis_client = await get_real_redis()
    policy = await create_test_policy()
    
    failure_injected = False
    
    async def failing_worker():
        nonlocal failure_injected
        if not failure_injected:
            failure_injected = True
            raise DatabaseError("Simulated DB failure")
        return await process_policy_claims(
            redis_client=redis_client,
            policy=policy,
            target_date=date(2025, 1, 15)
        )
    
    # Run with retries
    for attempt in range(3):
        try:
            result = await failing_worker()
            break
        except DatabaseError:
            await asyncio.sleep(0.5)
    
    # Should eventually succeed
    async with get_session() as session:
        claims = await get_claims_for_policy(session, policy.id)
        assert len(claims) > 0
        verify_no_duplicate_claims(claims)
```
