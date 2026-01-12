---
name: igloo-compute-engine
description: CPU-bound calculation engine patterns for Risk and Claim calculations in the Igloo Insurance platform. Use when implementing risk event detection, tier differential claim calculations, timezone conversions for "per day/month" logic, or concurrent control with Redis locks. Covers financial precision with Decimal, async execution strategies, and distributed locking.
---

# Compute Engine Development

## Critical Rules

### CPU Isolation (NON-NEGOTIABLE)

**NEVER** run calculation logic directly in FastAPI `async def` route handlers.

```python
# ❌ WRONG - Blocks entire async event loop
@router.get("/calculate")
async def calculate(session: AsyncSession = Depends(get_session)):
    result = risk_calculator.calculate(data)  # CPU-bound!
    return result

# ✅ CORRECT - Use run_in_executor
@router.get("/calculate")
async def calculate(session: AsyncSession = Depends(get_session)):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor, risk_calculator.calculate, data
    )
    return result

# ✅ CORRECT - Use Celery for heavy tasks
@router.post("/calculate")
async def calculate(session: AsyncSession = Depends(get_session)):
    task = risk_calculation_task.delay(data)
    return {"task_id": task.id}
```

### Financial Precision

**ALWAYS** use `decimal.Decimal` for money and percentages:

```python
from decimal import Decimal, ROUND_HALF_UP

# Coverage amount
coverage_amount: Decimal = Decimal("100000.00")

# Payout percentage (e.g., 20% = Decimal("20"))
payout_percentage: Decimal = Decimal("20.00")

# Calculate payout
payout_amount = (coverage_amount * payout_percentage / Decimal("100")).quantize(
    Decimal("0.01"), rounding=ROUND_HALF_UP
)
```

### Timezone Handling

"Per day" and "per month" limits must use **local time** of the risk location:

```python
from datetime import datetime
import pytz

def get_local_date(utc_time: datetime, timezone_str: str) -> date:
    """Convert UTC to local date for period comparison."""
    tz = pytz.timezone(timezone_str)  # e.g., "Asia/Shanghai"
    local_time = utc_time.astimezone(tz)
    return local_time.date()

# Example: Check if two events are in "same day"
event1_local = get_local_date(event1.timestamp, policy.timezone)
event2_local = get_local_date(event2.timestamp, policy.timezone)
same_day = event1_local == event2_local
```

## Calculator Design Pattern

Keep calculators **synchronous** - caller decides execution strategy:

```python
# compute/risk_calculator.py
class RiskCalculator:
    def calculate(
        self,
        product_config: ProductConfig,
        weather_data: list[WeatherData],
        timezone: str
    ) -> list[RiskEvent]:
        """Pure sync function - no DB, no async."""
        events = []
        for window in self._sliding_windows(weather_data):
            if self._check_threshold(window, product_config):
                events.append(self._create_event(window))
        return events
```

## Reference Files

- [Risk Calculator](references/risk-calculator.md) - Risk event calculation logic
- [Claim Calculator](references/claim-calculator.md) - Tier differential claim logic
- [Timezone Handling](references/timezone-handling.md) - UTC to local time patterns
- [Concurrency Control](references/concurrency-control.md) - Redis lock + DB lock
