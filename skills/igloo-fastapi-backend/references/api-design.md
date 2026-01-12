# API Design Conventions

## Table of Contents

1. [URL Structure](#url-structure)
2. [Request/Response Patterns](#requestresponse-patterns)
3. [Error Handling](#error-handling)
4. [Query Parameters](#query-parameters)
5. [Async Processing](#async-processing)

---

## URL Structure

### Versioning

All APIs use version prefix:

```
/api/v1/policies
/api/v1/claims
/api/v1/statistics
/api/v1/risk-events
/api/v1/weather
/api/v1/agents
```

### Resource Naming

```python
# Collection
GET    /api/v1/policies          # List policies
POST   /api/v1/policies          # Create policy

# Single resource
GET    /api/v1/policies/{id}     # Get policy
PUT    /api/v1/policies/{id}     # Update policy
DELETE /api/v1/policies/{id}     # Delete policy

# Sub-resources
GET    /api/v1/policies/{id}/claims  # Get policy's claims

# Actions (use verbs for non-CRUD)
POST   /api/v1/risk-events/calculate
GET    /api/v1/statistics/trends
```

---

## Request/Response Patterns

### Standard Response Wrapper

```python
from pydantic import BaseModel, ConfigDict
from typing import Generic, TypeVar

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T
    message: str | None = None

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
```

### Route Implementation

```python
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix="/policies", tags=["policies"])

@router.get("", response_model=PaginatedResponse[PolicyResponse])
async def list_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    product_id: str | None = None,
    session: AsyncSession = Depends(get_session)
) -> PaginatedResponse[PolicyResponse]:
    items, total = await policy_service.get_paginated(
        session, page, page_size, product_id
    )
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )
```

---

## Error Handling

### HTTP Exception Patterns

```python
from fastapi import HTTPException, status

# 404 Not Found
if not policy:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Policy not found"
    )

# 400 Bad Request
if coverage_end <= coverage_start:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="coverage_end must be after coverage_start"
    )

# 409 Conflict
if existing_policy:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Policy with number {policy_number} already exists"
    )

# 422 Validation Error (automatic from Pydantic)
```

### Global Exception Handler

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(Exception)
async def global_exception_handler(
    request: Request, 
    exc: Exception
) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "detail": str(exc) if settings.DEBUG else None
        }
    )
```

---

## Query Parameters

### Filtering

```python
from datetime import datetime
from typing import Annotated
from fastapi import Query

@router.get("/claims")
async def list_claims(
    policy_id: int | None = None,
    tier_level: Annotated[
        str | None, 
        Query(pattern="^tier[123]$")
    ] = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    status: list[str] = Query(default=[]),
    session: AsyncSession = Depends(get_session)
):
    return await claim_service.get_filtered(
        session,
        policy_id=policy_id,
        tier_level=tier_level,
        start_date=start_date,
        end_date=end_date,
        status=status
    )
```

### Sorting

```python
from enum import Enum

class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

@router.get("/policies")
async def list_policies(
    sort_by: str = "created_at",
    sort_order: SortOrder = SortOrder.DESC,
    session: AsyncSession = Depends(get_session)
):
    return await policy_service.get_sorted(
        session, sort_by, sort_order
    )
```

---

## Async Processing

### Lightweight Calculations (< 0.5s)

Use `run_in_executor` for quick calculations:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

@router.get("/risk-events/preview")
async def preview_risk_events(
    product_id: str,
    region: str,
    session: AsyncSession = Depends(get_session)
):
    # Get data async
    weather_data = await weather_service.get_data(session, region)
    product_config = await product_service.get_config(session, product_id)
    
    # Run sync calculation in thread pool
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        risk_calculator.calculate,
        product_config,
        weather_data
    )
    return result
```

### Heavy Calculations (> 0.5s)

Return task ID and use polling:

```python
from celery import Celery

@router.post("/claims/calculate")
async def trigger_claim_calculation(
    policy_id: int,
    session: AsyncSession = Depends(get_session)
):
    # Validate policy exists
    policy = await policy_service.get_by_id(session, policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")
    
    # Trigger async task
    task = claim_calculation_task.delay(policy_id)
    
    return {
        "task_id": task.id,
        "status": "pending",
        "poll_url": f"/api/v1/tasks/{task.id}"
    }

@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    task = AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": task.status,
        "result": task.result if task.ready() else None
    }
```

### Streaming Response (SSE)

```python
from fastapi.responses import StreamingResponse
import json

@router.post("/agents/chat")
async def chat_stream(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session)
):
    async def generate():
        async for chunk in agent_service.stream_response(request):
            yield f"data: {json.dumps(chunk)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```
