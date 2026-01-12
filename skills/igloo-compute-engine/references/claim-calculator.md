# Claim Calculator

## Table of Contents

1. [Tier Differential Logic](#tier-differential-logic)
2. [Same Period Determination](#same-period-determination)
3. [Calculation Examples](#calculation-examples)
4. [Implementation](#implementation)
5. [Concurrent Control](#concurrent-control)

---

## Tier Differential Logic

### Rules

1. **No prior claim in period**: Payout = original tier percentage
2. **Prior lower-tier claim exists**: Payout = current tier % - highest prior tier %
3. **Prior higher-tier claim exists**: No new claim (skip)
4. **Multiple tiers at same timestamp**: Only highest tier generates claim

### Payout Percentages (Example Config)

```python
TIER_PAYOUTS = {
    "tier1": Decimal("20"),   # 20%
    "tier2": Decimal("50"),   # 50%
    "tier3": Decimal("100"),  # 100%
}
```

---

## Same Period Determination

"Same period" depends on product's payout frequency:

| Frequency | Same Period Definition |
|-----------|------------------------|
| `once_per_day` | Same **local date** |
| `once_per_month` | Same **local year-month** |
| `once_per_policy` | Entire policy duration |

### Period Key Generation

```python
from datetime import datetime, date
import pytz

def get_period_key(
    utc_timestamp: datetime,
    timezone_str: str,
    frequency: str
) -> str:
    """Generate period key for claim deduplication."""
    tz = pytz.timezone(timezone_str)
    local_dt = utc_timestamp.astimezone(tz)
    
    if frequency == "once_per_day":
        return local_dt.strftime("%Y-%m-%d")
    elif frequency == "once_per_month":
        return local_dt.strftime("%Y-%m")
    elif frequency == "once_per_policy":
        return "policy"
    else:
        raise ValueError(f"Unknown frequency: {frequency}")
```

---

## Calculation Examples

### Example 1: Sequential Triggering (tier1 → tier2 → tier3)

**Config**: tier1=20%, tier2=50%, tier3=100%, once_per_day

```
Time T1: tier1 triggered, no prior claims
  → Claim: 20% (original)

Time T2: tier2 triggered, tier1 exists
  → Claim: 50% - 20% = 30% (differential)

Time T3: tier3 triggered, tier2 exists
  → Claim: 100% - 50% = 50% (differential)

Total: 20% + 30% + 50% = 100% ✓
```

### Example 2: Skip tier1 (tier2 → tier3)

```
Time T1: tier2 triggered, no prior claims
  → Claim: 50% (original)

Time T2: tier3 triggered, tier2 exists
  → Claim: 100% - 50% = 50% (differential)

Total: 50% + 50% = 100% ✓
```

### Example 3: Reverse Order (tier2 → tier1)

```
Time T1: tier2 triggered, no prior claims
  → Claim: 50% (original)

Time T2: tier1 triggered, tier2 exists (higher)
  → No claim (tier1 < tier2)

Total: 50%
```

### Example 4: Same Timestamp Multiple Tiers

```
Time T1: tier1, tier2, tier3 all triggered
  → Only tier3 claim: 100% (highest tier wins)

Total: 100% ✓
```

---

## Implementation

### Data Structures

```python
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

@dataclass
class ClaimInput:
    policy_id: int
    risk_event_id: int
    tier_level: str
    event_timestamp: datetime
    coverage_amount: Decimal
    timezone: str

@dataclass
class ClaimOutput:
    policy_id: int
    risk_event_id: int
    tier_level: str
    payout_percentage: Decimal
    payout_amount: Decimal
    trigger_timestamp: datetime
```

### Calculator Class

```python
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

TIER_ORDER = {"tier1": 1, "tier2": 2, "tier3": 3}

class ClaimCalculator:
    def __init__(self, payout_rules: dict[str, Decimal], frequency: str):
        self.payout_rules = payout_rules  # {"tier1": Decimal("20"), ...}
        self.frequency = frequency
    
    def calculate(
        self,
        risk_events: list[RiskEvent],
        policy: Policy,
        existing_claims: list[Claim]
    ) -> list[ClaimOutput]:
        """Calculate claims for risk events."""
        claims = []
        
        # Group events by period and timestamp
        events_by_period = self._group_by_period(risk_events, policy.timezone)
        
        # Track highest tier per period
        existing_by_period = self._map_existing_claims(existing_claims, policy.timezone)
        
        for period_key, period_events in events_by_period.items():
            # Get existing highest tier in this period
            highest_existing = existing_by_period.get(period_key)
            
            # Group by timestamp, take highest tier at each timestamp
            by_timestamp = self._group_by_timestamp(period_events)
            
            for timestamp, ts_events in sorted(by_timestamp.items()):
                # Get highest tier at this timestamp
                highest_event = max(
                    ts_events, 
                    key=lambda e: TIER_ORDER[e.tier_level]
                )
                
                claim = self._calculate_single(
                    highest_event, policy, highest_existing
                )
                
                if claim:
                    claims.append(claim)
                    # Update highest for next iteration
                    if highest_existing is None or \
                       TIER_ORDER[claim.tier_level] > TIER_ORDER[highest_existing]:
                        highest_existing = claim.tier_level
        
        return claims
    
    def _calculate_single(
        self,
        event: RiskEvent,
        policy: Policy,
        highest_existing: str | None
    ) -> ClaimOutput | None:
        """Calculate single claim with tier differential."""
        current_tier = event.tier_level
        current_payout = self.payout_rules[current_tier]
        
        if highest_existing:
            if TIER_ORDER[current_tier] <= TIER_ORDER[highest_existing]:
                # Current tier is not higher than existing
                return None
            # Differential payout
            prior_payout = self.payout_rules[highest_existing]
            payout_percentage = current_payout - prior_payout
        else:
            # First claim in period
            payout_percentage = current_payout
        
        payout_amount = (
            policy.coverage_amount * payout_percentage / Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        return ClaimOutput(
            policy_id=policy.id,
            risk_event_id=event.id,
            tier_level=current_tier,
            payout_percentage=payout_percentage,
            payout_amount=payout_amount,
            trigger_timestamp=event.timestamp
        )
    
    def _group_by_period(
        self,
        events: list[RiskEvent],
        timezone: str
    ) -> dict[str, list[RiskEvent]]:
        """Group events by period key."""
        groups = defaultdict(list)
        for event in events:
            key = get_period_key(event.timestamp, timezone, self.frequency)
            groups[key].append(event)
        return groups
    
    def _group_by_timestamp(
        self,
        events: list[RiskEvent]
    ) -> dict[datetime, list[RiskEvent]]:
        """Group events by exact timestamp."""
        groups = defaultdict(list)
        for event in events:
            groups[event.timestamp].append(event)
        return groups
    
    def _map_existing_claims(
        self,
        claims: list[Claim],
        timezone: str
    ) -> dict[str, str]:
        """Map period key to highest tier from existing claims."""
        result = {}
        for claim in claims:
            key = get_period_key(claim.trigger_timestamp, timezone, self.frequency)
            existing = result.get(key)
            if existing is None or TIER_ORDER[claim.tier_level] > TIER_ORDER[existing]:
                result[key] = claim.tier_level
        return result
```

---

## Concurrent Control

See [Concurrency Control](concurrency-control.md) for Redis lock and DB lock patterns.

### Integration Point

```python
async def process_claims_for_policy(
    session: AsyncSession,
    redis: Redis,
    policy_id: int,
    date_str: str
):
    lock_key = f"lock:claim_calc:{policy_id}:{date_str}"
    
    async with redis.lock(lock_key, timeout=60):
        async with session.begin():
            # Lock risk events
            events = await session.execute(
                select(RiskEvent)
                .where(RiskEvent.policy_id == policy_id)
                .with_for_update()
            )
            
            # Calculate and persist claims
            claims = calculator.calculate(events, policy, existing)
            for claim in claims:
                session.add(Claim(**claim.__dict__))
```
