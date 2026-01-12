# Agent Architecture

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Modality Adapter Layer](#modality-adapter-layer)
3. [Router Agent](#router-agent)
4. [Expertise Agents](#expertise-agents)
5. [Agent Communication](#agent-communication)
6. [Response Formatter Decoupling](#response-formatter-decoupling)

---

## Architecture Overview

The architecture follows a **2-layer Agent design** with a **Modality Adapter Layer** for extensibility:

```
┌─────────────────────────────────────────────────────────┐
│           表现层 (Presentation Layer)                     │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │ Text Chat UI     │  │ Voice Interface  │           │
│  │ (Contextual View)│  │ (Web Speech API)  │           │
│  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────┘
        ↕ HTTP/SSE              ↕ WebSocket
┌─────────────────────────────────────────────────────────┐
│          Modality Adapter Layer                         │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │ TextAdapter      │  │ VoiceAdapter     │           │
│  │ - Direct text    │  │ - VAD detection  │           │
│  │ - Format convert │  │ - STT/TTS        │           │
│  │                  │  │ - Barge-in       │           │
│  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────┘
                        ↕ (unified text protocol)
┌─────────────────────────────────────────────────────────┐
│          Router Agent (Supervisor Agent)                 │
│  [Merged: Chat Agent + Orchestrator Agent]              │
│  - Natural Language Understanding (NLU)                 │
│  - Session Context Management                           │
│  - Intent Recognition + Routing                         │
│  - Call Expertise Agents (as Tools)                     │
│  - Response Formatting (based on channel: text/voice)   │
└─────────────────────────────────────────────────────────┘
        ↕              ↕              ↕
        │ (Function Calling)         │
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Product      │ │ Risk & Claim │ │ Policy       │
│ Expertise    │ │ Expertise    │ │ Expertise    │
│ Agent        │ │ Agent        │ │ Agent        │
│              │ │              │ │              │
│ - Products   │ │ - Risk query │ │ - Policy     │
│ - Rules      │ │ - Prediction │ │ - Statistics │
│ - Compare    │ │ - Claims     │ │ - Analysis   │
└──────────────┘ └──────────────┘ └──────────────┘
        ↕              ↕              ↕
┌─────────────────────────────────────────────────────────┐
│             Tools Layer (Function Calling)               │
│  Service Layer returns pure JSON (NO formatting)        │
└─────────────────────────────────────────────────────────┘
```

### Why This Architecture?

1. **Reduced Latency**: Merging Chat Agent + Orchestrator into Router Agent reduces LLM calls from 3 to 2 (~50% latency reduction)
2. **Modality Decoupling**: Modality Adapter Layer allows easy extension to voice, image, AR/VR without touching Agent logic
3. **Modern LLM Capability**: GPT-4o/Gemini 1.5 Pro can handle NLU + Intent + Tool Calling in a single call
4. **Response Flexibility**: Agent formats responses based on channel (text vs voice)

---

## Modality Adapter Layer

### Interface Definition

```python
from abc import ABC, abstractmethod
from typing import AsyncGenerator

class ModalityAdapter(ABC):
    """Base class for modality adapters."""
    
    @abstractmethod
    async def transcribe(self, raw_input: bytes | str) -> str:
        """Convert raw input to text for Agent processing."""
        pass
    
    @abstractmethod
    async def synthesize(
        self,
        text: str,
        channel: str,
        stream_callback: callable | None = None
    ) -> bytes | str:
        """Convert Agent output to modality-specific format."""
        pass
```

### TextAdapter

```python
class TextAdapter(ModalityAdapter):
    """Adapter for text-based interactions (HTTP/SSE)."""
    
    async def transcribe(self, raw_input: str) -> str:
        """Direct passthrough for text."""
        return raw_input
    
    async def synthesize(
        self,
        text: str,
        channel: str = "text",
        stream_callback: callable | None = None
    ) -> str:
        """Return text as-is."""
        return text
```

### VoiceAdapter

```python
class VoiceAdapter(ModalityAdapter):
    """Adapter for voice-based interactions (WebSocket)."""
    
    def __init__(self, use_gemini_native: bool = True):
        self.use_gemini_native = use_gemini_native
        self.stt_client = None  # Fallback STT
        self.tts_client = None  # Fallback TTS
    
    async def transcribe(self, audio_bytes: bytes) -> str:
        """Convert audio to text."""
        if self.use_gemini_native:
            # Gemini 1.5 Pro can process audio directly
            # Audio bytes passed to model, no STT needed
            return audio_bytes  # Pass raw audio
        else:
            # Fallback: Use Google Speech-to-Text
            return await self.stt_client.transcribe(audio_bytes)
    
    async def synthesize(
        self,
        text: str,
        channel: str = "voice",
        stream_callback: callable | None = None
    ) -> AsyncGenerator[bytes, None]:
        """Convert text to audio stream."""
        async for audio_chunk in self.tts_client.synthesize_stream(text):
            if stream_callback:
                await stream_callback(audio_chunk)
            yield audio_chunk
    
    async def handle_interrupt(self):
        """Handle user barge-in (interrupt during AI speech)."""
        # Cancel ongoing TTS generation
        # Clear audio buffer
        # Signal ready for new input
        pass
```

---

## Router Agent

### Responsibilities

The Router Agent is the **single entry point** that handles:

1. Natural Language Understanding (NLU)
2. Conversation context management (Session State)
3. Intent recognition and routing to Expertise Agents
4. Response formatting based on channel (text/voice)

### Implementation

```python
from google.adk import Agent, GenerativeModel
from typing import AsyncGenerator

class RouterAgent:
    def __init__(self):
        self.model = GenerativeModel("gemini-1.5-pro")
        self.expertise_agents = {
            "product": ProductExpertiseAgent(),
            "risk_claim": RiskClaimExpertiseAgent(),
            "policy": PolicyExpertiseAgent(),
        }
    
    async def process(
        self,
        message: str,
        session: ChatSession,
        channel: str = "text"  # "text" or "voice"
    ) -> AsyncGenerator[str, None]:
        """Process user message with streaming response."""
        
        # Add to conversation history
        session.add_user_message(message)
        
        # Build prompt with channel-specific instructions
        system_prompt = self._build_system_prompt(channel)
        
        # Classify intent
        intent = await self._classify_intent(message)
        
        # Status update
        yield self._format_status(f"Analyzing your question about {intent}...", channel)
        
        # Route to appropriate Expertise Agent
        expertise_agent = self.expertise_agents.get(intent, self.expertise_agents["product"])
        
        # Get response from Expertise Agent
        result = await expertise_agent.handle(message, session)
        
        # Format response based on channel
        formatted = self._format_response(result, channel)
        
        async for chunk in self._stream_response(formatted):
            yield chunk
            session.add_assistant_chunk(chunk)
        
        session.finalize_assistant_message()
    
    def _build_system_prompt(self, channel: str) -> str:
        base_prompt = """You are an insurance AI assistant for Igloo Index.
You help users understand:
- Weather index insurance products
- Risk events and their triggers
- Policy coverage and claims
- Historical and predicted weather data

Be concise and professional. Use data from the backend services."""

        if channel == "voice":
            base_prompt += """

VOICE MODE INSTRUCTIONS:
- Keep responses under 2 sentences
- Do not read raw data tables
- Summarize key figures only
- Use friendly, reassuring tone (important for insurance claims)
"""
        return base_prompt
    
    def _format_response(self, data: dict, channel: str) -> str:
        """Format response based on channel."""
        if channel == "voice":
            # Voice: Short summary, no tables
            return self._summarize_for_voice(data)
        else:
            # Text: Can include Markdown tables
            return self._format_for_text(data)
    
    def _summarize_for_voice(self, data: dict) -> str:
        """Create voice-friendly summary (2 sentences max)."""
        # Extract key metrics
        if "policies" in data:
            return f"You have {data['total']} policies with total coverage of ${data['coverage']:,.0f}."
        elif "risk_events" in data:
            return f"I found {len(data['events'])} risk events in the selected period."
        elif "claims" in data:
            return f"There are {len(data['claims'])} claims totaling ${data['total_payout']:,.0f}."
        return "Here's what I found."
    
    def _format_for_text(self, data: dict) -> str:
        """Create text-friendly format with Markdown."""
        # Can include tables, lists, formatting
        pass
```

### Session Management

```python
@dataclass
class ChatSession:
    session_id: str
    messages: list[Message]
    context: AgentContext
    channel: str = "text"  # Current interaction channel
    
    def add_user_message(self, content: str):
        self.messages.append(Message(role="user", content=content))
    
    def add_assistant_chunk(self, chunk: str):
        if not self.messages or self.messages[-1].role != "assistant":
            self.messages.append(Message(role="assistant", content=""))
        self.messages[-1].content += chunk
    
    def get_context_window(self, max_messages: int = 10) -> list[Message]:
        """Get recent messages for context (avoid token overflow)."""
        return self.messages[-max_messages:]
    
    def get_summary_for_expertise_agent(self) -> str:
        """Create concise context summary for Expertise Agents."""
        # Don't pass full history, summarize key points
        return f"User is asking about: {self.messages[-1].content[:200]}"

@dataclass
class AgentContext:
    """Shared context between agents."""
    selected_product: str | None = None
    selected_region: dict | None = None
    selected_policy_id: int | None = None
    
    # Cached results (avoid re-fetching)
    cached_policies: list | None = None
    cached_risks: list | None = None
```

---

## Expertise Agents

### Product Expertise Agent

```python
class ProductExpertiseAgent:
    """Handles product-related queries."""
    
    def __init__(self):
        self.tools = [
            get_product_config,
            list_products,
            compare_products,
        ]
    
    async def handle(
        self,
        message: str,
        session: ChatSession
    ) -> dict:
        """Handle product query, return structured data."""
        product_id = session.context.selected_product
        
        if "compare" in message.lower():
            return await self._compare_products(message)
        elif product_id:
            return await self._get_product_details(product_id)
        else:
            return await self._list_products()
    
    async def _get_product_details(self, product_id: str) -> dict:
        # Call tool, return pure JSON
        config = await get_product_config(product_id)
        return {
            "type": "product_details",
            "product_id": product_id,
            "name": config["name"],
            "description": config["description"],
            "risk_rules": config["riskRules"],
        }
```

### Risk & Claim Expertise Agent

```python
class RiskClaimExpertiseAgent:
    """Handles risk events and claims."""
    
    def __init__(self):
        self.tools = [
            get_risk_events,
            calculate_risk_prediction,
            get_claims,
            explain_claim_calculation,
        ]
    
    async def handle(
        self,
        message: str,
        session: ChatSession
    ) -> dict:
        """Handle risk/claim query, return structured data."""
        if "predict" in message.lower():
            return await self._predict_risks(session)
        elif "claim" in message.lower():
            return await self._query_claims(message, session)
        else:
            return await self._query_risks(message, session)
    
    async def _predict_risks(self, session: ChatSession) -> dict:
        region = session.context.selected_region
        product_id = session.context.selected_product
        
        result = await calculate_risk_prediction(
            product_id=product_id,
            region=region,
            days_ahead=7
        )
        
        return {
            "type": "risk_prediction",
            "events": result["predicted_events"],
            "summary": f"{len(result['predicted_events'])} events predicted"
        }
```

### Policy Expertise Agent

```python
class PolicyExpertiseAgent:
    """Handles policy-related queries."""
    
    def __init__(self):
        self.tools = [
            get_policy_statistics,
            search_policies,
            get_policy_details,
        ]
    
    async def handle(
        self,
        message: str,
        session: ChatSession
    ) -> dict:
        """Handle policy query, return structured data."""
        if "statistics" in message.lower() or "how many" in message.lower():
            return await self._get_stats(session)
        else:
            return await self._search_policies(message, session)
```

---

## Agent Communication

### Context Passing

Pass **summarized context** to Expertise Agents, not full conversation history:

```python
# ❌ WRONG - Pass full history (token explosion)
async def call_expertise_agent(agent, full_history):
    return await agent.handle(full_history)

# ✅ CORRECT - Pass summarized context
async def call_expertise_agent(agent, message, session):
    summary = session.get_summary_for_expertise_agent()
    return await agent.handle(message, session)
```

### Result Aggregation

For complex queries requiring multiple Expertise Agents:

```python
async def handle_complex_query(
    self,
    message: str,
    session: ChatSession
) -> dict:
    """Handle queries requiring multiple agents."""
    
    # Example: "What policies are at risk this week?"
    
    # Step 1: Get policies
    policies = await self.expertise_agents["policy"].handle(
        "get active policies",
        session
    )
    
    # Step 2: Get risks for each policy
    risks = []
    for policy in policies["policies"]:
        risk = await self.expertise_agents["risk_claim"].handle(
            f"predict risks for region {policy['region']}",
            session
        )
        if risk["events"]:
            risks.append({
                "policy": policy["policy_number"],
                "events": risk["events"]
            })
    
    return {
        "type": "policies_at_risk",
        "policies": risks,
        "summary": f"{len(risks)} policies have upcoming risk events"
    }
```

---

## Response Formatter Decoupling

### Core Principle

**Service Layer** returns pure JSON data. **Agent Layer** formats based on channel.

```python
# SERVICE LAYER - Returns pure JSON (NO formatting)
class PolicyService:
    async def get_statistics(self, product_id: str) -> dict:
        # Query database
        result = await self.db.execute(...)
        
        # Return pure data
        return {
            "total_policies": 1234,
            "total_coverage": Decimal("5000000.00"),
            "active_claims": 45,
            "by_region": {...}
        }
        # ❌ NEVER return:
        # "| Region | Count |\n|--------|-------|\n..."  # Markdown
        # "<table>...</table>"  # HTML

# AGENT LAYER - Formats based on channel
class RouterAgent:
    def _format_response(self, data: dict, channel: str) -> str:
        if channel == "voice":
            return self._format_for_voice(data)
        else:
            return self._format_for_text(data)
    
    def _format_for_voice(self, data: dict) -> str:
        """Voice: 2 sentences max, no tables."""
        return f"You have {data['total_policies']} policies totaling ${data['total_coverage']:,.0f} in coverage."
    
    def _format_for_text(self, data: dict) -> str:
        """Text: Can include Markdown tables."""
        return f"""
## Policy Statistics

| Metric | Value |
|--------|-------|
| Total Policies | {data['total_policies']} |
| Total Coverage | ${data['total_coverage']:,.2f} |
| Active Claims | {data['active_claims']} |
"""
```

### Benefits

1. **Single Source of Truth**: Business logic stays in Service layer
2. **Multi-Modal Ready**: Easy to add new channels (AR, video call, etc.)
3. **Testable**: Service layer can be tested independently of formatting
4. **Maintainable**: Formatting logic centralized in Agent layer
