# Property-Based Testing with Hypothesis

## Table of Contents

1. [Setup](#setup)
2. [Strategy Definitions](#strategy-definitions)
3. [Invariant Testing](#invariant-testing)
4. [Edge Case Discovery](#edge-case-discovery)
5. [Stateful Testing](#stateful-testing)

---

## Setup

### Installation

```bash
pip install hypothesis pytest-hypothesis
```

### Basic Configuration

```python
# conftest.py
from hypothesis import settings, Verbosity

settings.register_profile("ci", max_examples=1000)
settings.register_profile("dev", max_examples=100)
settings.register_profile("debug", max_examples=10, verbosity=Verbosity.verbose)

# Use: pytest --hypothesis-profile=ci
```

---

## Strategy Definitions

### Custom Strategies for Insurance Domain

```python
from hypothesis import strategies as st
from decimal import Decimal
from datetime import datetime, timedelta
import pytz

# Decimal strategy for financial amounts
@st.composite
def coverage_amounts(draw):
    """Generate valid coverage amounts."""
    value = draw(st.decimals(
        min_value=Decimal("1000"),
        max_value=Decimal("10000000"),
        places=2,
        allow_nan=False,
        allow_infinity=False
    ))
    return value

# Payout percentage strategy
@st.composite
def payout_percentages(draw):
    """Generate valid payout percentages (0-100)."""
    return draw(st.decimals(
        min_value=Decimal("0"),
        max_value=Decimal("100"),
        places=2,
        allow_nan=False,
        allow_infinity=False
    ))

# Tier level strategy
tier_levels = st.sampled_from(["tier1", "tier2", "tier3"])

# Region strategy
@st.composite
def regions(draw):
    """Generate valid region dictionaries."""
    countries = ["CN", "ID", "MY", "TH", "VN"]
    provinces = {
        "CN": ["Guangdong", "Zhejiang", "Jiangsu"],
        "ID": ["Jakarta", "West Java", "East Java"],
        "MY": ["Selangor", "Johor", "Penang"],
        "TH": ["Bangkok", "Chiang Mai", "Phuket"],
        "VN": ["Ho Chi Minh", "Hanoi", "Da Nang"],
    }
    
    country = draw(st.sampled_from(countries))
    province = draw(st.sampled_from(provinces[country]))
    
    return {"country": country, "province": province}

# Timestamp strategy
@st.composite
def timestamps(draw, min_date=None, max_date=None):
    """Generate timezone-aware UTC timestamps."""
    if min_date is None:
        min_date = datetime(2024, 1, 1)
    if max_date is None:
        max_date = datetime(2026, 12, 31)
    
    dt = draw(st.datetimes(min_value=min_date, max_value=max_date))
    return dt.replace(tzinfo=pytz.UTC)

# Timezone strategy
timezones = st.sampled_from([
    "Asia/Shanghai",
    "Asia/Jakarta",
    "Asia/Kuala_Lumpur",
    "Asia/Bangkok",
    "Asia/Ho_Chi_Minh",
    "America/New_York",
    "Europe/London",
])
```

### Composite Strategies

```python
@st.composite
def risk_events(draw, product_id="test-product"):
    """Generate valid risk events."""
    return RiskEvent(
        product_id=product_id,
        region=draw(regions()),
        timestamp=draw(timestamps()),
        weather_type=draw(st.sampled_from(["rainfall", "wind"])),
        tier_level=draw(tier_levels),
        trigger_value=draw(st.decimals(
            min_value=Decimal("0"),
            max_value=Decimal("1000"),
            places=2
        )),
        threshold_value=draw(st.decimals(
            min_value=Decimal("0"),
            max_value=Decimal("500"),
            places=2
        )),
        data_type=draw(st.sampled_from(["historical", "predicted"]))
    )

@st.composite
def policies(draw):
    """Generate valid policies."""
    start = draw(timestamps(
        min_date=datetime(2024, 1, 1),
        max_date=datetime(2025, 6, 1)
    ))
    end = start + timedelta(days=draw(st.integers(min_value=30, max_value=365)))
    
    return Policy(
        id=draw(st.integers(min_value=1)),
        policy_number=f"POL-{draw(st.integers(min_value=10000, max_value=99999))}",
        product_id=draw(st.sampled_from(["rainfall-pro", "wind-shield"])),
        coverage_region=draw(regions()),
        coverage_start=start,
        coverage_end=end,
        coverage_amount=draw(coverage_amounts()),
        timezone=draw(timezones)
    )
```

---

## Invariant Testing

### Total Payout Never Exceeds 100%

```python
from hypothesis import given, assume
from decimal import Decimal

TIER_PAYOUTS = {
    "tier1": Decimal("20"),
    "tier2": Decimal("50"),
    "tier3": Decimal("100"),
}

@given(
    events=st.lists(risk_events(), min_size=1, max_size=20),
    policy=policies()
)
def test_total_payout_never_exceeds_100(events, policy):
    """Property: Total payout in any period never exceeds 100%."""
    # Arrange
    calculator = ClaimCalculator(
        payout_rules=TIER_PAYOUTS,
        frequency="once_per_day"
    )
    
    # Act
    claims = calculator.calculate(events, policy, existing_claims=[])
    
    # Assert: Group by period and check
    from collections import defaultdict
    by_period = defaultdict(Decimal)
    
    for claim in claims:
        period_key = get_period_key(
            claim.trigger_timestamp,
            policy.timezone,
            "once_per_day"
        )
        by_period[period_key] += claim.payout_percentage
    
    for period, total in by_period.items():
        assert total <= Decimal("100"), \
            f"Period {period} has payout {total}% > 100%"

@given(
    coverage=coverage_amounts(),
    percentage=payout_percentages()
)
def test_payout_amount_precision(coverage, percentage):
    """Property: Payout amount is exactly coverage * percentage / 100."""
    expected = (coverage * percentage / Decimal("100")).quantize(
        Decimal("0.01")
    )
    
    actual = calculate_payout(coverage, percentage)
    
    assert actual == expected
    assert isinstance(actual, Decimal)
```

### Tier Ordering

```python
@given(st.lists(tier_levels, min_size=2, max_size=10))
def test_tier_ordering_consistent(tiers):
    """Property: Tier comparison is consistent."""
    TIER_ORDER = {"tier1": 1, "tier2": 2, "tier3": 3}
    
    for i in range(len(tiers) - 1):
        t1, t2 = tiers[i], tiers[i+1]
        
        if TIER_ORDER[t1] < TIER_ORDER[t2]:
            assert is_lower_tier(t1, t2)
            assert not is_lower_tier(t2, t1)
        elif TIER_ORDER[t1] > TIER_ORDER[t2]:
            assert is_lower_tier(t2, t1)
            assert not is_lower_tier(t1, t2)
        else:
            assert not is_lower_tier(t1, t2)
            assert not is_lower_tier(t2, t1)
```

---

## Edge Case Discovery

### Midnight Boundary

```python
@given(
    base_hour=st.integers(min_value=22, max_value=23),
    offset_hours=st.integers(min_value=1, max_value=4),
    timezone=timezones
)
def test_midnight_crossing(base_hour, offset_hours, timezone):
    """Property: Events crossing midnight are in different days."""
    import pytz
    from datetime import datetime, timedelta
    
    # Create event near midnight
    tz = pytz.timezone(timezone)
    local_time = datetime(2025, 1, 15, base_hour, 30)
    local_dt = tz.localize(local_time)
    utc_dt1 = local_dt.astimezone(pytz.UTC)
    
    # Create event after offset
    utc_dt2 = utc_dt1 + timedelta(hours=offset_hours)
    
    # Check if they're on the same local day
    local_date1 = get_local_date(utc_dt1, timezone)
    local_date2 = get_local_date(utc_dt2, timezone)
    
    # If crossing midnight, dates should differ
    if base_hour + offset_hours >= 24:
        assert local_date2 > local_date1, \
            f"Expected different days for {utc_dt1} + {offset_hours}h in {timezone}"
```

### Month Boundary

```python
@given(
    day=st.integers(min_value=28, max_value=31),
    month=st.integers(min_value=1, max_value=12),
    year=st.integers(min_value=2024, max_value=2026),
    timezone=timezones
)
def test_month_boundary(day, month, year, timezone):
    """Property: Events at month boundary are correctly classified."""
    from calendar import monthrange
    import pytz
    
    # Adjust day to valid range for month
    max_day = monthrange(year, month)[1]
    day = min(day, max_day)
    
    tz = pytz.timezone(timezone)
    
    try:
        local_dt = tz.localize(datetime(year, month, day, 23, 59))
        utc_dt1 = local_dt.astimezone(pytz.UTC)
        utc_dt2 = utc_dt1 + timedelta(minutes=2)  # Cross midnight
        
        ym1 = get_local_year_month(utc_dt1, timezone)
        ym2 = get_local_year_month(utc_dt2, timezone)
        
        # Last day of month + 2 minutes = next month
        if day == max_day:
            assert ym2 > ym1 or (ym2[0] > ym1[0]), \
                f"Expected month change from {ym1} to {ym2}"
    except ValueError:
        pass  # Invalid date, skip
```

### Reverse Tier Triggering

```python
@given(
    events=st.lists(risk_events(), min_size=2, max_size=5)
)
def test_reverse_tier_no_extra_payout(events):
    """Property: Lower tier after higher tier doesn't add payout."""
    assume(len(events) >= 2)
    
    # Sort events to ensure higher tier comes first
    TIER_ORDER = {"tier1": 1, "tier2": 2, "tier3": 3}
    events_sorted = sorted(
        events,
        key=lambda e: -TIER_ORDER[e.tier_level]  # Descending
    )
    
    # Set all to same timestamp (same period)
    base_time = events_sorted[0].timestamp
    for e in events_sorted:
        e.timestamp = base_time
    
    policy = create_test_policy()
    calculator = ClaimCalculator(TIER_PAYOUTS, "once_per_day")
    
    claims = calculator.calculate(events_sorted, policy, [])
    
    # Should only have one claim (highest tier)
    assert len(claims) == 1
    highest_tier = max(events_sorted, key=lambda e: TIER_ORDER[e.tier_level])
    assert claims[0].tier_level == highest_tier.tier_level
```

---

## Stateful Testing

### Claim Calculator State Machine

```python
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant
from hypothesis import strategies as st

class ClaimCalculatorStateMachine(RuleBasedStateMachine):
    """Stateful test for claim calculator."""
    
    def __init__(self):
        super().__init__()
        self.policy = create_test_policy()
        self.existing_claims = []
        self.risk_events = []
        self.calculator = ClaimCalculator(TIER_PAYOUTS, "once_per_day")
    
    @rule(event=risk_events())
    def add_risk_event(self, event):
        """Add a risk event and recalculate claims."""
        self.risk_events.append(event)
        new_claims = self.calculator.calculate(
            self.risk_events,
            self.policy,
            self.existing_claims
        )
        self.existing_claims.extend(new_claims)
    
    @invariant()
    def total_payout_bounded(self):
        """Invariant: Total payout never exceeds 100% per period."""
        from collections import defaultdict
        
        by_period = defaultdict(Decimal)
        for claim in self.existing_claims:
            period = get_period_key(
                claim.trigger_timestamp,
                self.policy.timezone,
                "once_per_day"
            )
            by_period[period] += claim.payout_percentage
        
        for period, total in by_period.items():
            assert total <= Decimal("100")
    
    @invariant()
    def no_duplicate_claims(self):
        """Invariant: No duplicate claims for same event."""
        seen = set()
        for claim in self.existing_claims:
            key = (claim.risk_event_id, claim.tier_level)
            assert key not in seen, f"Duplicate claim: {key}"
            seen.add(key)

# Run stateful test
TestClaimCalculator = ClaimCalculatorStateMachine.TestCase
```
