---
name: igloo-ai-agent
description: Multi-Agent architecture patterns with Google ADK for the Igloo Insurance platform. Use when building AI chat interfaces, implementing Function Calling (Tool Use), or designing the Router Agent + Modality Adapter + Expertise Agents architecture. Covers Router Agent (merged Chat + Orchestrator), Modality Adapters (Text/Voice), Voice Gateway with WebSocket, VAD, barge-in handling, SSE/WebSocket streaming, and response formatter decoupling.
---

# AI Agent Development

## Critical Rules

### Agent Architecture (NON-NEGOTIABLE)

```
┌─────────────────────────────────────────────────────────┐
│          Modality Adapter Layer                         │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │ TextAdapter      │  │ VoiceAdapter     │           │
│  │ - HTTP/SSE       │  │ - WebSocket      │           │
│  │ - Direct text    │  │ - VAD/STT/TTS    │           │
│  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────┘
                        ↕ (unified text)
┌─────────────────────────────────────────────────────────┐
│          Router Agent (Supervisor Agent)                 │
│  - NLU + Intent Recognition + Routing                   │
│  - Session Context Management                           │
│  - Response Formatting (based on channel)               │
└─────────────────────────────────────────────────────────┘
        ↕              ↕              ↕
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Product      │ │ Risk/Claim   │ │ Policy       │
│ Expertise    │ │ Expertise    │ │ Expertise    │
└──────────────┘ └──────────────┘ └──────────────┘
        ↕              ↕              ↕
┌─────────────────────────────────────────────────────────┐
│             Tools Layer (Function Calling)               │
└─────────────────────────────────────────────────────────┘
```

| Layer | Responsibility |
|-------|---------------|
| Modality Adapter | Decouples input/output modality from Agent logic |
| Router Agent | NLU, intent routing, context management, response formatting |
| Expertise Agents | Domain-specific logic and tool calls |
| Tools | Function definitions for backend services |

### Database Safety (NON-NEGOTIABLE)

AI Agents **NEVER** write directly to the database. They must call Backend Service methods via Function Calling:

```python
# ❌ WRONG - Agent writes to DB directly
async def handle_claim_request(session, data):
    claim = Claim(**data)
    session.add(claim)  # FORBIDDEN!

# ✅ CORRECT - Agent calls service via tool
@tool
async def create_claim(policy_id: int, tier: str) -> dict:
    """Create a claim for a policy."""
    return await claim_service.create(policy_id, tier)
```

### Response Formatter Decoupling (CRITICAL)

**Service Layer**: Returns pure JSON data only. NO formatting.
**Agent Layer**: Formats based on `channel` parameter:

```python
# Service Layer - returns pure JSON
async def get_policy_statistics(product_id: str) -> dict:
    return {
        "total_policies": 1234,
        "total_coverage": Decimal("5000000.00"),
        "active_claims": 45
    }

# Router Agent - formats based on channel
def format_response(data: dict, channel: str) -> str:
    if channel == "voice":
        # Voice mode: 2 sentences max, no tables
        return f"You have {data['total_policies']} policies with {data['active_claims']} active claims."
    else:
        # Text mode: Markdown tables OK
        return f"""
## Policy Statistics
| Metric | Value |
|--------|-------|
| Total Policies | {data['total_policies']} |
| Total Coverage | ${data['total_coverage']:,.2f} |
| Active Claims | {data['active_claims']} |
"""
```

### Context Management

**NEVER** pass raw, massive JSON to the LLM. Summarize data:

```python
def summarize_policy_for_llm(policy: Policy) -> str:
    """Create concise summary for LLM context."""
    return f"""
Policy #{policy.policy_number}
- Product: {policy.product_id}
- Coverage: ${policy.coverage_amount:,.2f}
- Period: {policy.coverage_start.date()} to {policy.coverage_end.date()}
- Region: {policy.coverage_region['province']}, {policy.coverage_region['country']}
- Active Claims: {len(policy.claims)}
"""
```

## Tool Definition Pattern

Keep input schemas **simple**:

```python
from google.adk import FunctionDeclaration

get_policy_stats = FunctionDeclaration(
    name="get_policy_statistics",
    description="Get statistics for policies by product and region",
    parameters={
        "type": "object",
        "properties": {
            "product_id": {
                "type": "string",
                "description": "Product ID (e.g., 'rainfall-pro')"
            },
            "region": {
                "type": "string",
                "description": "Region code (e.g., 'CN-GD')"
            }
        },
        "required": ["product_id"]
    }
)
```

## Voice Mode Guidelines

When `channel='voice'`:

```python
# Router Agent Prompt Addition
VOICE_MODE_PROMPT = """
If the output_modality is 'voice':
- Keep responses under 2 sentences
- Do not read raw data tables
- Summarize key figures
- Use friendly, reassuring tone (important for insurance claims)
"""
```

## Reference Files

- [Agent Architecture](references/agent-architecture.md) - Router Agent, Modality Adapters, multi-agent collaboration
- [Function Calling](references/function-calling.md) - Tool definitions and calling conventions
- [Streaming Response](references/streaming-response.md) - SSE, WebSocket, Voice Gateway, VAD, barge-in
