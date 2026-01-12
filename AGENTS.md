# AGENTS

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: Bash("openskills read <skill-name>")
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>skill-creator</name>
<description>Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.</description>
<location>global</location>
</skill>

<skill>
<name>igloo-fastapi-backend</name>
<description>FastAPI backend development patterns for the Igloo Insurance SaaS platform. Use when building API routes, Pydantic schemas, SQLAlchemy models, or Celery tasks. Covers Pydantic V2 syntax, SQLAlchemy 2.0 Async patterns, PostGIS spatial data, and service-controller architecture.</description>
<location>skills/igloo-fastapi-backend</location>
</skill>

<skill>
<name>igloo-compute-engine</name>
<description>CPU-bound calculation engine patterns for Risk and Claim calculations in the Igloo Insurance platform. Use when implementing risk event detection, tier differential claim calculations, timezone conversions for "per day/month" logic, or concurrent control with Redis locks. Covers financial precision with Decimal, async execution strategies, and distributed locking.</description>
<location>skills/igloo-compute-engine</location>
</skill>

<skill>
<name>igloo-react-frontend</name>
<description>React 19 frontend development patterns for the Igloo Insurance platform. Use when building React components, data fetching with TanStack Query, state management with Zustand, or map visualization with deck.gl on Google Maps. Covers Custom Hooks patterns, form validation with zod, and particle effects for weather visualization.</description>
<location>skills/igloo-react-frontend</location>
</skill>

<skill>
<name>igloo-ai-agent</name>
<description>Multi-Agent architecture patterns with Google ADK for the Igloo Insurance platform. Use when building AI chat interfaces, implementing Function Calling (Tool Use), or designing the Router Agent + Modality Adapter + Expertise Agents architecture. Covers Router Agent (merged Chat + Orchestrator), Modality Adapters (Text/Voice), Voice Gateway with WebSocket, VAD, barge-in handling, SSE/WebSocket streaming, and response formatter decoupling (Service returns JSON, Agent formats based on channel).</description>
<location>skills/igloo-ai-agent</location>
</skill>

<skill>
<name>igloo-testing</name>
<description>Testing strategies for the Igloo Insurance platform including Property-Based Testing with Hypothesis. Use when writing tests for calculation engines, verifying financial invariants (payout never exceeds 100%), testing concurrent control mechanisms (Redis locks, DB locks), or validating timezone-sensitive logic. Covers pytest-asyncio patterns and edge case discovery.</description>
<location>skills/igloo-testing</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
