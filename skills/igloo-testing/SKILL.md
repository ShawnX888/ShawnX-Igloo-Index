---
name: igloo-testing
description: Testing strategies for the Igloo Insurance platform including Property-Based Testing with Hypothesis. Use when writing tests for calculation engines, verifying financial invariants (payout never exceeds 100%), testing concurrent control mechanisms (Redis locks, DB locks), or validating timezone-sensitive logic. Covers pytest-asyncio patterns and edge case discovery.
---

# Testing Strategies

## Critical Rules

### External API Mocking (NON-NEGOTIABLE)

**NEVER** hit real external APIs in tests:

```python
# ❌ WRONG - Hits real API
async def test_weather_fetch():
    data = await weather_api.fetch("CN-GD")  # Real API call!

# ✅ CORRECT - Mock external calls
@pytest.fixture
def mock_weather_api(mocker):
    return mocker.patch(
        "app.services.weather_service.fetch_from_api",
        return_value=MOCK_WEATHER_DATA
    )

async def test_weather_fetch(mock_weather_api):
    data = await weather_service.get_weather("CN-GD")
    assert data == MOCK_WEATHER_DATA
```

### Financial Precision Testing

Always verify Decimal calculations:

```python
from decimal import Decimal

def test_payout_calculation():
    coverage = Decimal("100000.00")
    percentage = Decimal("20.00")
    
    payout = calculate_payout(coverage, percentage)
    
    # Exact comparison - no floating point issues
    assert payout == Decimal("20000.00")
    assert isinstance(payout, Decimal)  # Not float!
```

## Key Invariants to Verify

| Invariant | Description |
|-----------|-------------|
| Payout ≤ 100% | Total payout percentage in a period never exceeds 100% |
| Decimal precision | Financial amounts maintain exact precision |
| Tier ordering | tier3 > tier2 > tier1 always |
| Timezone consistency | "per day" uses local time, not UTC |
| No duplicate claims | Same event doesn't generate duplicate claims |

## pytest-asyncio Setup

```python
# conftest.py
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def db_session():
    engine = create_async_engine("postgresql+asyncpg://test:test@localhost/test")
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()
```

## Reference Files

- [Hypothesis Patterns](references/hypothesis-patterns.md) - Property-based testing examples
- [Invariants](references/invariants.md) - Critical invariants for insurance domain
- [Concurrent Testing](references/concurrent-testing.md) - Redis lock and DB lock testing
