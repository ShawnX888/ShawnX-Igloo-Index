# Timezone Handling

## Table of Contents

1. [Core Principle](#core-principle)
2. [Database Storage](#database-storage)
3. [Conversion Patterns](#conversion-patterns)
4. [Period Boundary Calculation](#period-boundary-calculation)
5. [Common Pitfalls](#common-pitfalls)

---

## Core Principle

**Time Relativity in Insurance**:

- Database stores **UTC** (universal)
- Business logic uses **local time** of risk location
- "Per day" = midnight to midnight in **local timezone**

```
UTC Time:       2025-01-27 16:00:00 UTC
Asia/Shanghai:  2025-01-28 00:00:00 (next day!)
America/NY:     2025-01-27 11:00:00 (same day)
```

---

## Database Storage

### Policy Table Schema

```sql
CREATE TABLE policies (
    id SERIAL PRIMARY KEY,
    policy_number VARCHAR(50) UNIQUE,
    coverage_start TIMESTAMPTZ NOT NULL,  -- UTC
    coverage_end TIMESTAMPTZ NOT NULL,    -- UTC
    timezone VARCHAR(50) NOT NULL,        -- e.g., "Asia/Shanghai"
    coverage_amount DECIMAL(15, 2) NOT NULL
);
```

### SQLAlchemy Model

```python
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import TIMESTAMP

class Policy(Base):
    __tablename__ = "policies"
    
    id = Column(Integer, primary_key=True)
    coverage_start = Column(TIMESTAMP(timezone=True), nullable=False)
    coverage_end = Column(TIMESTAMP(timezone=True), nullable=False)
    timezone = Column(String(50), nullable=False)  # IANA timezone
```

---

## Conversion Patterns

### UTC to Local Time

```python
from datetime import datetime, date
import pytz

def utc_to_local(utc_dt: datetime, timezone_str: str) -> datetime:
    """Convert UTC datetime to local datetime."""
    if utc_dt.tzinfo is None:
        utc_dt = pytz.UTC.localize(utc_dt)
    tz = pytz.timezone(timezone_str)
    return utc_dt.astimezone(tz)

def get_local_date(utc_dt: datetime, timezone_str: str) -> date:
    """Get local date from UTC datetime."""
    return utc_to_local(utc_dt, timezone_str).date()

def get_local_year_month(utc_dt: datetime, timezone_str: str) -> tuple[int, int]:
    """Get local (year, month) from UTC datetime."""
    local = utc_to_local(utc_dt, timezone_str)
    return (local.year, local.month)
```

### Local to UTC

```python
def local_to_utc(local_dt: datetime, timezone_str: str) -> datetime:
    """Convert local datetime to UTC."""
    tz = pytz.timezone(timezone_str)
    if local_dt.tzinfo is None:
        local_dt = tz.localize(local_dt)
    return local_dt.astimezone(pytz.UTC)

def local_date_to_utc_range(
    local_date: date, 
    timezone_str: str
) -> tuple[datetime, datetime]:
    """Get UTC range for a local date (midnight to midnight)."""
    tz = pytz.timezone(timezone_str)
    
    # Start of day in local time
    start_local = tz.localize(datetime.combine(local_date, datetime.min.time()))
    
    # Start of next day in local time
    next_day = local_date + timedelta(days=1)
    end_local = tz.localize(datetime.combine(next_day, datetime.min.time()))
    
    return (
        start_local.astimezone(pytz.UTC),
        end_local.astimezone(pytz.UTC)
    )
```

---

## Period Boundary Calculation

### Same Day Check

```python
def is_same_local_day(
    utc_dt1: datetime,
    utc_dt2: datetime,
    timezone_str: str
) -> bool:
    """Check if two UTC datetimes are on the same local day."""
    return get_local_date(utc_dt1, timezone_str) == get_local_date(utc_dt2, timezone_str)
```

### Same Month Check

```python
def is_same_local_month(
    utc_dt1: datetime,
    utc_dt2: datetime,
    timezone_str: str
) -> bool:
    """Check if two UTC datetimes are in the same local month."""
    ym1 = get_local_year_month(utc_dt1, timezone_str)
    ym2 = get_local_year_month(utc_dt2, timezone_str)
    return ym1 == ym2
```

### Period Key for Claims

```python
def get_claim_period_key(
    utc_timestamp: datetime,
    timezone_str: str,
    frequency: str
) -> str:
    """Generate unique key for claim deduplication."""
    local_dt = utc_to_local(utc_timestamp, timezone_str)
    
    if frequency == "once_per_day":
        return local_dt.strftime("%Y-%m-%d")
    elif frequency == "once_per_month":
        return local_dt.strftime("%Y-%m")
    elif frequency == "once_per_policy":
        return "POLICY"
    else:
        raise ValueError(f"Unknown frequency: {frequency}")
```

---

## Common Pitfalls

### Pitfall 1: Comparing UTC Dates Directly

```python
# ❌ WRONG - Uses UTC date, not local
if event1.timestamp.date() == event2.timestamp.date():
    # This compares UTC dates!

# ✅ CORRECT - Convert to local first
if get_local_date(event1.timestamp, tz) == get_local_date(event2.timestamp, tz):
    # Compares local dates
```

### Pitfall 2: Naive Datetime

```python
# ❌ WRONG - Naive datetime loses timezone info
now = datetime.now()  # No timezone!

# ✅ CORRECT - Always use aware datetime
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
```

### Pitfall 3: DST Transitions

```python
# ⚠️ CAUTION - DST can cause issues
# America/New_York: 2025-03-09 02:00 doesn't exist (spring forward)
# America/New_York: 2025-11-02 01:30 exists twice (fall back)

# ✅ SAFE - Use pytz.normalize for arithmetic
from pytz import timezone

tz = timezone("America/New_York")
dt = tz.localize(datetime(2025, 3, 9, 1, 0))
dt_plus_2h = tz.normalize(dt + timedelta(hours=2))  # Handles DST
```

### Pitfall 4: Cross-Timezone Policies

If a policy covers multiple timezones:

```python
# Option 1: Use primary region's timezone
timezone = policy.primary_region_timezone

# Option 2: Split claims by sub-region
for region in policy.regions:
    claims = calculate_for_region(region, region.timezone)
```

---

## Example: Full Claim Period Check

```python
from datetime import datetime
import pytz

def should_generate_claim(
    new_event: RiskEvent,
    existing_claims: list[Claim],
    policy: Policy,
    payout_frequency: str
) -> bool:
    """Determine if new claim should be generated."""
    new_period = get_claim_period_key(
        new_event.timestamp,
        policy.timezone,
        payout_frequency
    )
    
    for claim in existing_claims:
        claim_period = get_claim_period_key(
            claim.trigger_timestamp,
            policy.timezone,
            payout_frequency
        )
        
        if claim_period == new_period:
            # Same period - check tier
            if TIER_ORDER[claim.tier_level] >= TIER_ORDER[new_event.tier_level]:
                return False  # Higher or equal tier already claimed
    
    return True
```
