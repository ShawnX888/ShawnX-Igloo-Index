# Function Calling (Tool Use)

## Table of Contents

1. [Tool Definition](#tool-definition)
2. [Tool Implementation](#tool-implementation)
3. [Tool Registration](#tool-registration)
4. [Error Handling](#error-handling)
5. [Context Summarization](#context-summarization)

---

## Tool Definition

### JSON Schema Format

```python
from google.adk import FunctionDeclaration

# Simple tool - single input
get_policy = FunctionDeclaration(
    name="get_policy",
    description="Get details of a specific insurance policy by ID",
    parameters={
        "type": "object",
        "properties": {
            "policy_id": {
                "type": "integer",
                "description": "The unique ID of the policy"
            }
        },
        "required": ["policy_id"]
    }
)

# Complex tool - multiple inputs with enum
get_risk_events = FunctionDeclaration(
    name="get_risk_events",
    description="Query historical risk events for a region",
    parameters={
        "type": "object",
        "properties": {
            "region": {
                "type": "object",
                "properties": {
                    "country": {"type": "string"},
                    "province": {"type": "string"}
                },
                "required": ["country"]
            },
            "weather_type": {
                "type": "string",
                "enum": ["rainfall", "wind", "temperature"],
                "description": "Type of weather event"
            },
            "tier_level": {
                "type": "string",
                "enum": ["tier1", "tier2", "tier3"],
                "description": "Risk tier level filter (optional)"
            },
            "start_date": {
                "type": "string",
                "format": "date",
                "description": "Start date (YYYY-MM-DD)"
            },
            "end_date": {
                "type": "string",
                "format": "date",
                "description": "End date (YYYY-MM-DD)"
            }
        },
        "required": ["region"]
    }
)
```

### Keep Schemas Simple

```python
# ❌ BAD - Too complex, nested objects everywhere
complex_tool = FunctionDeclaration(
    name="complex_query",
    parameters={
        "type": "object",
        "properties": {
            "filters": {
                "type": "object",
                "properties": {
                    "weather": {
                        "type": "object",
                        "properties": {
                            "types": {"type": "array"},
                            "thresholds": {"type": "object"}
                        }
                    }
                }
            }
        }
    }
)

# ✅ GOOD - Flat, simple parameters
simple_tool = FunctionDeclaration(
    name="get_weather_events",
    parameters={
        "type": "object",
        "properties": {
            "weather_type": {"type": "string"},
            "min_value": {"type": "number"},
            "region_code": {"type": "string"}
        },
        "required": ["weather_type", "region_code"]
    }
)
```

---

## Tool Implementation

### Response Formatter Decoupling (CRITICAL)

**Service Layer returns pure JSON data. NO formatting.**

```python
# ✅ CORRECT - Service returns pure JSON
async def get_policy_statistics(product_id: str, region: str | None = None) -> dict:
    return {
        "total_policies": 1234,
        "total_coverage": "5000000.00",  # Decimal as string
        "active_policies": 1100,
        "by_region": [
            {"region": "Guangdong", "count": 500, "coverage": "2000000.00"}
        ]
    }

# ❌ WRONG - Service returns formatted output
async def get_policy_statistics_bad(product_id: str) -> str:
    return """
| Region | Count | Coverage |
|--------|-------|----------|
| Guangdong | 500 | $2M |
"""  # NEVER do this! Agent layer handles formatting based on channel
```

**Agent Layer formats based on channel (text/voice):**

```python
def format_statistics(data: dict, channel: str) -> str:
    if channel == "voice":
        # Voice: Short summary, no tables
        return f"You have {data['total_policies']} policies with ${float(data['total_coverage']):,.0f} total coverage."
    else:
        # Text: Markdown tables OK
        return f"""
## Policy Statistics
| Metric | Value |
|--------|-------|
| Total Policies | {data['total_policies']} |
| Total Coverage | ${float(data['total_coverage']):,.2f} |
"""
```

### Basic Tool Function

```python
from typing import Any
from decimal import Decimal

async def get_policy_statistics(
    product_id: str,
    region: str | None = None
) -> dict[str, Any]:
    """
    Get statistics for policies.
    
    Called by AI Agent via Function Calling.
    Returns pure JSON data (NO formatting).
    """
    async with get_session() as session:
        stats = await statistics_service.get_policy_stats(
            session,
            product_id=product_id,
            region=region
        )
    
    # Return serializable dict (pure data, no formatting)
    return {
        "total_policies": stats.count,
        "total_coverage": str(stats.total_coverage),  # Decimal -> str
        "active_policies": stats.active_count,
        "by_region": [
            {
                "region": r.name,
                "count": r.count,
                "coverage": str(r.coverage)
            }
            for r in stats.by_region
        ]
    }
```

### Tool with Computation

```python
async def calculate_risk_prediction(
    product_id: str,
    region: dict,
    days_ahead: int = 7
) -> dict[str, Any]:
    """
    Calculate predicted risk events.
    
    Uses Celery for heavy computation.
    """
    # Trigger async calculation
    task = risk_prediction_task.delay(
        product_id=product_id,
        region=region,
        days_ahead=days_ahead
    )
    
    # Wait for result (with timeout)
    try:
        result = task.get(timeout=30)
    except TimeoutError:
        return {
            "status": "pending",
            "task_id": task.id,
            "message": "Calculation in progress, please check back later"
        }
    
    return {
        "status": "complete",
        "predicted_events": [
            {
                "date": e.timestamp.isoformat(),
                "tier_level": e.tier_level,
                "weather_type": e.weather_type,
                "value": str(e.trigger_value),
                "threshold": str(e.threshold_value)
            }
            for e in result.events
        ]
    }
```

---

## Tool Registration

### Tool Registry

```python
from dataclasses import dataclass
from typing import Callable, Any

@dataclass
class Tool:
    declaration: FunctionDeclaration
    handler: Callable[..., Any]
    category: str

class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}
    
    def register(
        self,
        declaration: FunctionDeclaration,
        handler: Callable,
        category: str = "general"
    ):
        self._tools[declaration.name] = Tool(
            declaration=declaration,
            handler=handler,
            category=category
        )
    
    def get_declarations(
        self,
        categories: list[str] | None = None
    ) -> list[FunctionDeclaration]:
        if categories is None:
            return [t.declaration for t in self._tools.values()]
        return [
            t.declaration for t in self._tools.values()
            if t.category in categories
        ]
    
    async def execute(
        self,
        name: str,
        arguments: dict
    ) -> Any:
        if name not in self._tools:
            raise ValueError(f"Unknown tool: {name}")
        
        tool = self._tools[name]
        return await tool.handler(**arguments)

# Global registry
tool_registry = ToolRegistry()

# Register tools
tool_registry.register(
    get_policy_statistics_declaration,
    get_policy_statistics,
    category="statistics"
)
tool_registry.register(
    get_risk_events_declaration,
    get_risk_events,
    category="risk"
)
```

### Agent with Tools

```python
class ExpertiseAgent:
    def __init__(self, categories: list[str]):
        self.categories = categories
        self.tools = tool_registry.get_declarations(categories)
    
    async def handle_tool_call(
        self,
        tool_name: str,
        arguments: dict
    ) -> str:
        """Execute tool and format result for LLM."""
        try:
            result = await tool_registry.execute(tool_name, arguments)
            return self._format_result(result)
        except Exception as e:
            return f"Error executing {tool_name}: {str(e)}"
    
    def _format_result(self, result: Any) -> str:
        """Format tool result for LLM context."""
        if isinstance(result, dict):
            return json.dumps(result, indent=2, default=str)
        return str(result)
```

---

## Error Handling

### Graceful Degradation

```python
async def safe_tool_execution(
    tool_name: str,
    arguments: dict,
    fallback_message: str = "Unable to retrieve data"
) -> dict:
    """Execute tool with error handling."""
    try:
        result = await tool_registry.execute(tool_name, arguments)
        return {"success": True, "data": result}
    except ValidationError as e:
        return {
            "success": False,
            "error": "Invalid parameters",
            "details": str(e)
        }
    except TimeoutError:
        return {
            "success": False,
            "error": "Request timed out",
            "suggestion": "Try with a smaller date range"
        }
    except Exception as e:
        logger.exception(f"Tool {tool_name} failed")
        return {
            "success": False,
            "error": fallback_message
        }
```

### User-Friendly Error Messages

```python
ERROR_MESSAGES = {
    "policy_not_found": "I couldn't find a policy with that ID. Please check the policy number and try again.",
    "no_data": "No data available for the specified region and time period.",
    "calculation_timeout": "The risk calculation is taking longer than expected. I'll provide cached results instead.",
}

async def handle_with_friendly_errors(
    tool_name: str,
    arguments: dict
) -> AsyncGenerator[str, None]:
    result = await safe_tool_execution(tool_name, arguments)
    
    if not result["success"]:
        error_key = result.get("error_code", "generic")
        message = ERROR_MESSAGES.get(
            error_key,
            "I encountered an issue retrieving that information."
        )
        yield f"⚠️ {message}\n\n"
        
        if "suggestion" in result:
            yield f"💡 Suggestion: {result['suggestion']}\n"
    else:
        yield format_data_for_user(result["data"])
```

---

## Context Summarization

### Policy Summary

```python
def summarize_policy(policy: Policy) -> str:
    """Create concise policy summary for LLM."""
    return f"""Policy: {policy.policy_number}
Product: {policy.product_id}
Coverage: ${policy.coverage_amount:,.2f}
Period: {policy.coverage_start.date()} to {policy.coverage_end.date()}
Region: {policy.coverage_region.get('province', 'N/A')}, {policy.coverage_region['country']}
Status: {'Active' if policy.is_active else 'Expired'}
Claims: {len(policy.claims)} total, ${sum(c.payout_amount for c in policy.claims):,.2f} paid"""
```

### Risk Events Summary

```python
def summarize_risk_events(events: list[RiskEvent]) -> str:
    """Summarize risk events for LLM context."""
    if not events:
        return "No risk events found for the specified criteria."
    
    by_tier = defaultdict(list)
    for e in events:
        by_tier[e.tier_level].append(e)
    
    lines = [f"Found {len(events)} risk events:"]
    for tier in ["tier3", "tier2", "tier1"]:
        if tier in by_tier:
            lines.append(f"- {tier.upper()}: {len(by_tier[tier])} events")
    
    # Add date range
    dates = sorted(e.timestamp for e in events)
    lines.append(f"Date range: {dates[0].date()} to {dates[-1].date()}")
    
    return "\n".join(lines)
```

### Statistics Summary

```python
def summarize_statistics(stats: dict) -> str:
    """Format statistics for natural language response."""
    return f"""Summary Statistics:
- Total Policies: {stats['total_policies']:,}
- Total Coverage: ${Decimal(stats['total_coverage']):,.2f}
- Active Policies: {stats['active_policies']:,}
- Total Claims: {stats.get('total_claims', 0):,}
- Claims Paid: ${Decimal(stats.get('claims_paid', '0')):,.2f}

Top Regions:
""" + "\n".join(
        f"  {i+1}. {r['region']}: {r['count']} policies"
        for i, r in enumerate(stats.get('by_region', [])[:5])
    )
```
