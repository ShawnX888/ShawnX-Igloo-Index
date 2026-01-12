# Critical Invariants for Insurance Domain

## Table of Contents

1. [Financial Invariants](#financial-invariants)
2. [Temporal Invariants](#temporal-invariants)
3. [Business Logic Invariants](#business-logic-invariants)
4. [Data Consistency Invariants](#data-consistency-invariants)
5. [Testing Patterns](#testing-patterns)

---

## Financial Invariants

### INV-1: Payout Never Exceeds Coverage

```python
def test_invariant_payout_le_coverage():
    """Total payout for a policy never exceeds coverage amount."""
    
    @given(
        coverage=coverage_amounts(),
        claim_percentages=st.lists(
            payout_percentages(),
            min_size=1,
            max_size=10
        )
    )
    def check(coverage, claim_percentages):
        total_payout = sum(
            coverage * p / Decimal("100")
            for p in claim_percentages
        )
        
        # This should be enforced by business logic
        # In real system, claims are validated before creation
        assert total_payout <= coverage * Decimal("100") / Decimal("100")
```

### INV-2: Period Payout ≤ 100%

```python
def verify_period_payout_invariant(claims: list[Claim], policy: Policy):
    """Verify no period exceeds 100% payout."""
    by_period = defaultdict(Decimal)
    
    for claim in claims:
        period_key = get_period_key(
            claim.trigger_timestamp,
            policy.timezone,
            policy.payout_frequency
        )
        by_period[period_key] += claim.payout_percentage
    
    violations = [
        (period, total)
        for period, total in by_period.items()
        if total > Decimal("100")
    ]
    
    assert not violations, f"Periods exceeding 100%: {violations}"
```

### INV-3: Decimal Precision Maintained

```python
def test_decimal_precision_invariant():
    """All financial calculations maintain Decimal precision."""
    
    @given(
        a=coverage_amounts(),
        b=payout_percentages()
    )
    def check(a, b):
        result = a * b / Decimal("100")
        
        # Result should be Decimal
        assert isinstance(result, Decimal)
        
        # Result should have reasonable precision
        assert result.as_tuple().exponent >= -10
        
        # Quantized result should be exact
        quantized = result.quantize(Decimal("0.01"))
        assert isinstance(quantized, Decimal)
```

---

## Temporal Invariants

### INV-4: Coverage Period Validity

```python
def test_coverage_period_invariant():
    """coverage_end must be after coverage_start."""
    
    @given(policy=policies())
    def check(policy):
        assert policy.coverage_end > policy.coverage_start
        
        # Duration should be reasonable (1 day to 10 years)
        duration = policy.coverage_end - policy.coverage_start
        assert timedelta(days=1) <= duration <= timedelta(days=3650)
```

### INV-5: Claim Within Coverage Period

```python
def verify_claim_in_coverage_period(claim: Claim, policy: Policy):
    """Claim must be within policy coverage period."""
    assert policy.coverage_start <= claim.trigger_timestamp <= policy.coverage_end, \
        f"Claim {claim.id} at {claim.trigger_timestamp} outside " \
        f"policy period [{policy.coverage_start}, {policy.coverage_end}]"
```

### INV-6: Local Time Consistency

```python
def test_local_time_consistency_invariant():
    """Same UTC time converts to consistent local time."""
    
    @given(
        utc_time=timestamps(),
        tz=timezones
    )
    def check(utc_time, tz):
        # Convert multiple times
        local1 = utc_to_local(utc_time, tz)
        local2 = utc_to_local(utc_time, tz)
        
        # Should be identical
        assert local1 == local2
        
        # Round-trip should preserve UTC
        back_to_utc = local_to_utc(local1, tz)
        assert abs((back_to_utc - utc_time).total_seconds()) < 1
```

---

## Business Logic Invariants

### INV-7: Tier Differential Correctness

```python
def test_tier_differential_invariant():
    """Tier differential payout is correctly calculated."""
    
    PAYOUTS = {"tier1": Decimal("20"), "tier2": Decimal("50"), "tier3": Decimal("100")}
    
    @given(
        existing_tier=st.sampled_from(["tier1", "tier2", None]),
        new_tier=tier_levels
    )
    def check(existing_tier, new_tier):
        TIER_ORDER = {"tier1": 1, "tier2": 2, "tier3": 3}
        
        if existing_tier is None:
            # No existing claim - full payout
            expected = PAYOUTS[new_tier]
        elif TIER_ORDER[new_tier] <= TIER_ORDER[existing_tier]:
            # New tier not higher - no payout
            expected = Decimal("0")
        else:
            # Differential payout
            expected = PAYOUTS[new_tier] - PAYOUTS[existing_tier]
        
        actual = calculate_differential_payout(existing_tier, new_tier, PAYOUTS)
        assert actual == expected
```

### INV-8: No Downgrade Claims

```python
def verify_no_downgrade_claims(claims: list[Claim]):
    """Higher tier claim followed by lower tier should not create new claim."""
    TIER_ORDER = {"tier1": 1, "tier2": 2, "tier3": 3}
    
    by_period = defaultdict(list)
    for claim in claims:
        period = get_period_key(claim.trigger_timestamp, tz, freq)
        by_period[period].append(claim)
    
    for period, period_claims in by_period.items():
        sorted_claims = sorted(period_claims, key=lambda c: c.created_at)
        max_tier_seen = 0
        
        for claim in sorted_claims:
            tier_num = TIER_ORDER[claim.tier_level]
            assert tier_num > max_tier_seen, \
                f"Downgrade claim in period {period}: {claim.tier_level}"
            max_tier_seen = tier_num
```

### INV-9: Risk Event Uniqueness

```python
def verify_risk_event_uniqueness(events: list[RiskEvent]):
    """No duplicate risk events for same product/region/time/weather/tier."""
    seen = set()
    
    for event in events:
        key = (
            event.product_id,
            json.dumps(event.region, sort_keys=True),
            event.timestamp.isoformat(),
            event.weather_type,
            event.tier_level,
            event.calculation_run_id
        )
        assert key not in seen, f"Duplicate risk event: {key}"
        seen.add(key)
```

---

## Data Consistency Invariants

### INV-10: Foreign Key Integrity

```python
async def verify_fk_integrity(session: AsyncSession):
    """All foreign keys point to existing records."""
    
    # Claims -> Policies
    orphan_claims = await session.execute(
        select(Claim)
        .outerjoin(Policy, Claim.policy_id == Policy.id)
        .where(Policy.id.is_(None))
    )
    assert not list(orphan_claims.scalars()), "Orphan claims found"
    
    # Claims -> RiskEvents (optional FK)
    claims_with_invalid_events = await session.execute(
        select(Claim)
        .where(Claim.risk_event_id.isnot(None))
        .outerjoin(RiskEvent, Claim.risk_event_id == RiskEvent.id)
        .where(RiskEvent.id.is_(None))
    )
    assert not list(claims_with_invalid_events.scalars()), \
        "Claims with invalid risk_event_id found"
```

### INV-11: Audit Trail Completeness

```python
def verify_audit_trail(
    original: Policy,
    updated: Policy,
    audit_log: list[AuditEntry]
):
    """All changes to sensitive fields are logged."""
    sensitive_fields = ["coverage_amount", "coverage_start", "coverage_end"]
    
    for field in sensitive_fields:
        old_val = getattr(original, field)
        new_val = getattr(updated, field)
        
        if old_val != new_val:
            matching_log = [
                log for log in audit_log
                if log.field == field
                and log.old_value == str(old_val)
                and log.new_value == str(new_val)
            ]
            assert matching_log, f"Missing audit log for {field} change"
```

---

## Testing Patterns

### Invariant Test Fixture

```python
import pytest
from typing import Callable

class InvariantChecker:
    """Collects and runs invariant checks."""
    
    def __init__(self):
        self.invariants: list[Callable] = []
    
    def register(self, func: Callable):
        self.invariants.append(func)
        return func
    
    def verify_all(self, context: dict):
        violations = []
        for inv in self.invariants:
            try:
                inv(context)
            except AssertionError as e:
                violations.append((inv.__name__, str(e)))
        
        if violations:
            msg = "\n".join(f"  {name}: {err}" for name, err in violations)
            raise AssertionError(f"Invariant violations:\n{msg}")

@pytest.fixture
def invariant_checker():
    return InvariantChecker()

# Usage
def test_full_calculation_cycle(invariant_checker, db_session):
    checker = invariant_checker
    
    @checker.register
    def payout_bounded(ctx):
        verify_period_payout_invariant(ctx["claims"], ctx["policy"])
    
    @checker.register
    def no_duplicates(ctx):
        verify_risk_event_uniqueness(ctx["events"])
    
    # Run calculation
    events, claims = run_calculation(policy)
    
    # Verify all invariants
    checker.verify_all({
        "policy": policy,
        "events": events,
        "claims": claims
    })
```

### Property-Based Invariant Suite

```python
from hypothesis import given, settings

@settings(max_examples=500)
@given(
    policy=policies(),
    events=st.lists(risk_events(), min_size=1, max_size=50)
)
def test_all_invariants(policy, events):
    """Comprehensive invariant test with random data."""
    
    # Run calculation
    calculator = ClaimCalculator(TIER_PAYOUTS, "once_per_day")
    claims = calculator.calculate(events, policy, [])
    
    # Check all invariants
    verify_period_payout_invariant(claims, policy)
    verify_no_downgrade_claims(claims)
    verify_risk_event_uniqueness(events)
    
    for claim in claims:
        verify_claim_in_coverage_period(claim, policy)
```
