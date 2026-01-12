---
name: igloo-fastapi-backend
description: FastAPI backend development patterns for the Igloo Insurance SaaS platform. Use when building API routes, Pydantic schemas, SQLAlchemy models, or Celery tasks. Covers Pydantic V2 syntax, SQLAlchemy 2.0 Async patterns, PostGIS spatial data, and service-controller architecture.
---

# FastAPI Backend Development

## Critical Rules

### Circular Import Prevention

```python
from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from app.models.claim import Claim

class Policy:
    claims: List["Claim"]  # String forward reference
```

### Directory Separation

- `models/` - SQLAlchemy ORM models only
- `schemas/` - Pydantic schemas only
- NEVER import models into schemas or vice versa at runtime

## Pydantic V2 Syntax (Mandatory)

```python
from pydantic import BaseModel, ConfigDict, field_validator

class PolicyCreate(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True
    )
    
    policy_number: str
    coverage_amount: Decimal
    
    @field_validator("coverage_amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Coverage amount must be positive")
        return v

# Usage
policy.model_dump()      # NOT .dict()
Policy.model_validate()  # NOT .parse_obj()
```

## SQLAlchemy 2.0 Async

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

async def get_policy(session: AsyncSession, policy_id: int) -> Policy | None:
    result = await session.execute(
        select(Policy).where(Policy.id == policy_id)
    )
    return result.scalar_one_or_none()

async def get_policies_by_product(
    session: AsyncSession, 
    product_id: str
) -> list[Policy]:
    result = await session.execute(
        select(Policy)
        .where(Policy.product_id == product_id)
        .order_by(Policy.created_at.desc())
    )
    return list(result.scalars().all())
```

## API Route Structure

```python
# app/api/v1/policies.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/policies", tags=["policies"])

@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(
    policy_id: int,
    session: AsyncSession = Depends(get_session)
) -> PolicyResponse:
    policy = await policy_service.get_by_id(session, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy
```

## Service Layer Pattern

```python
# app/services/policy_service.py
class PolicyService:
    async def create(
        self, 
        session: AsyncSession, 
        data: PolicyCreate
    ) -> Policy:
        policy = Policy(**data.model_dump())
        session.add(policy)
        await session.commit()
        await session.refresh(policy)
        return policy
```

## Reference Files

- [Pydantic V2 Patterns](references/pydantic-v2-patterns.md) - Migration guide and advanced patterns
- [SQLAlchemy Async](references/sqlalchemy-async.md) - Async query patterns and relationships
- [API Design](references/api-design.md) - RESTful conventions and error handling
