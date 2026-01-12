# Risk Calculator

## Table of Contents

1. [Architecture](#architecture)
2. [Product Rule Parsing](#product-rule-parsing)
3. [Sliding Window Calculation](#sliding-window-calculation)
4. [Threshold Comparison](#threshold-comparison)
5. [Integration with Services](#integration-with-services)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Risk Calculator                    │
│  (Pure sync function, no DB dependency)      │
├─────────────────────────────────────────────┤
│  Input:                                      │
│   - ProductConfig (riskRules)                │
│   - WeatherData[]                            │
│   - Timezone string                          │
│                                              │
│  Output:                                     │
│   - RiskEvent[]                              │
└─────────────────────────────────────────────┘
         ↓ Called by
┌─────────────────────────────────────────────┐
│  API Route (run_in_executor)                 │
│  OR                                          │
│  Celery Task (direct call)                   │
└─────────────────────────────────────────────┘
         ↓ Persists via
┌─────────────────────────────────────────────┐
│  Risk Service                                │
│  (create_risk_event / batch_create)          │
└─────────────────────────────────────────────┘
```

---

## Product Rule Parsing

### Risk Rules Structure

```python
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum

class TimeWindow(str, Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

class AggregationType(str, Enum):
    SUM = "sum"
    AVG = "avg"
    MAX = "max"

@dataclass
class TierThreshold:
    tier_level: str  # "tier1", "tier2", "tier3"
    threshold_value: Decimal
    payout_percentage: Decimal

@dataclass
class RiskRule:
    weather_type: str  # "rainfall", "wind", "temperature"
    time_window: TimeWindow
    window_hours: int  # e.g., 4 for 4-hour cumulative
    aggregation: AggregationType
    tiers: list[TierThreshold]
```

### Parsing from Product Config

```python
def parse_risk_rules(product_config: dict) -> list[RiskRule]:
    """Parse riskRules from product configuration."""
    rules = []
    for rule_data in product_config.get("riskRules", []):
        tiers = [
            TierThreshold(
                tier_level=t["level"],
                threshold_value=Decimal(str(t["threshold"])),
                payout_percentage=Decimal(str(t["payout"]))
            )
            for t in rule_data["tiers"]
        ]
        rules.append(RiskRule(
            weather_type=rule_data["weatherType"],
            time_window=TimeWindow(rule_data["timeWindow"]),
            window_hours=rule_data.get("windowHours", 24),
            aggregation=AggregationType(rule_data.get("aggregation", "sum")),
            tiers=sorted(tiers, key=lambda t: t.threshold_value)
        ))
    return rules
```

---

## Sliding Window Calculation

### Window Generator

```python
from datetime import datetime, timedelta
from typing import Generator

def sliding_windows(
    weather_data: list[WeatherData],
    window_hours: int
) -> Generator[list[WeatherData], None, None]:
    """Generate sliding windows of weather data."""
    if not weather_data:
        return
    
    # Sort by timestamp
    sorted_data = sorted(weather_data, key=lambda w: w.timestamp)
    window_delta = timedelta(hours=window_hours)
    
    for i, start_point in enumerate(sorted_data):
        window_end = start_point.timestamp + window_delta
        window = [
            w for w in sorted_data[i:]
            if w.timestamp < window_end
        ]
        if window:
            yield window
```

### Aggregation

```python
from decimal import Decimal

def aggregate_window(
    window: list[WeatherData],
    aggregation: AggregationType
) -> Decimal:
    """Aggregate weather values in a window."""
    values = [w.value for w in window]
    
    if aggregation == AggregationType.SUM:
        return sum(values, Decimal("0"))
    elif aggregation == AggregationType.AVG:
        return sum(values, Decimal("0")) / len(values)
    elif aggregation == AggregationType.MAX:
        return max(values)
    else:
        raise ValueError(f"Unknown aggregation: {aggregation}")
```

---

## Threshold Comparison

### Determine Triggered Tier

```python
def determine_tier(
    aggregated_value: Decimal,
    tiers: list[TierThreshold]
) -> TierThreshold | None:
    """Return highest tier triggered, or None if no trigger."""
    triggered = None
    for tier in tiers:  # Sorted ascending by threshold
        if aggregated_value >= tier.threshold_value:
            triggered = tier
    return triggered
```

### Complete Calculation

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class RiskEvent:
    product_id: str
    region: dict
    timestamp: datetime
    weather_type: str
    tier_level: str
    trigger_value: Decimal
    threshold_value: Decimal
    data_type: str  # "historical" or "predicted"

def calculate_risk_events(
    product_id: str,
    product_config: dict,
    weather_data: list[WeatherData],
    region: dict,
    data_type: str = "historical"
) -> list[RiskEvent]:
    """Calculate risk events for a product and region."""
    rules = parse_risk_rules(product_config)
    events = []
    
    for rule in rules:
        # Filter weather by type
        typed_data = [
            w for w in weather_data 
            if w.weather_type == rule.weather_type
        ]
        
        for window in sliding_windows(typed_data, rule.window_hours):
            agg_value = aggregate_window(window, rule.aggregation)
            tier = determine_tier(agg_value, rule.tiers)
            
            if tier:
                events.append(RiskEvent(
                    product_id=product_id,
                    region=region,
                    timestamp=window[0].timestamp,
                    weather_type=rule.weather_type,
                    tier_level=tier.tier_level,
                    trigger_value=agg_value,
                    threshold_value=tier.threshold_value,
                    data_type=data_type
                ))
    
    return events
```

---

## Integration with Services

### Celery Task

```python
from celery import shared_task
from app.compute.risk_calculator import calculate_risk_events
from app.services.risk_service import RiskService

@shared_task
def calculate_risk_events_task(
    product_id: str,
    region: dict,
    start_date: str,
    end_date: str,
    data_type: str = "historical"
) -> dict:
    """Celery task for risk event calculation."""
    # Get data (sync DB calls in Celery worker)
    product_config = get_product_config_sync(product_id)
    weather_data = get_weather_data_sync(region, start_date, end_date)
    
    # Calculate
    events = calculate_risk_events(
        product_id, product_config, weather_data, region, data_type
    )
    
    # Persist
    risk_service = RiskService()
    created = risk_service.batch_create_sync(events)
    
    return {"created_count": len(created)}
```

### API Route with run_in_executor

```python
from concurrent.futures import ThreadPoolExecutor
import asyncio

executor = ThreadPoolExecutor(max_workers=4)

@router.get("/risk-events/preview")
async def preview_risk_events(
    product_id: str,
    region_json: str,
    session: AsyncSession = Depends(get_session)
):
    """Preview risk events (lightweight calculation)."""
    region = json.loads(region_json)
    product_config = await product_service.get_config(session, product_id)
    weather_data = await weather_service.get_recent(session, region)
    
    loop = asyncio.get_event_loop()
    events = await loop.run_in_executor(
        executor,
        calculate_risk_events,
        product_id, product_config, weather_data, region
    )
    
    return {"events": events}
```
