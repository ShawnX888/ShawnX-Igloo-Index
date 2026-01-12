# SQLAlchemy 2.0 Async Patterns

## Table of Contents

1. [Session Setup](#session-setup)
2. [Query Patterns](#query-patterns)
3. [Relationships](#relationships)
4. [PostGIS Integration](#postgis-integration)
5. [Transaction Management](#transaction-management)

---

## Session Setup

### Engine and Session Factory

```python
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/db"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)
```

### Dependency Injection

```python
from typing import AsyncGenerator

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
```

---

## Query Patterns

### Basic Queries

```python
from sqlalchemy import select, and_, or_

# Single record
async def get_by_id(session: AsyncSession, id: int) -> Policy | None:
    result = await session.execute(
        select(Policy).where(Policy.id == id)
    )
    return result.scalar_one_or_none()

# Multiple records with conditions
async def get_active_policies(
    session: AsyncSession,
    product_id: str
) -> list[Policy]:
    result = await session.execute(
        select(Policy)
        .where(
            and_(
                Policy.product_id == product_id,
                Policy.coverage_end >= datetime.utcnow()
            )
        )
        .order_by(Policy.created_at.desc())
    )
    return list(result.scalars().all())
```

### Aggregation Queries

```python
from sqlalchemy import func

async def get_policy_stats(
    session: AsyncSession,
    product_id: str
) -> dict:
    result = await session.execute(
        select(
            func.count(Policy.id).label("count"),
            func.sum(Policy.coverage_amount).label("total_coverage")
        )
        .where(Policy.product_id == product_id)
    )
    row = result.one()
    return {
        "count": row.count,
        "total_coverage": row.total_coverage
    }
```

### Pagination

```python
async def get_paginated(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 20
) -> tuple[list[Policy], int]:
    # Count total
    count_result = await session.execute(
        select(func.count(Policy.id))
    )
    total = count_result.scalar_one()
    
    # Get page
    offset = (page - 1) * page_size
    result = await session.execute(
        select(Policy)
        .order_by(Policy.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    return list(result.scalars().all()), total
```

---

## Relationships

### Model Definition with TYPE_CHECKING

```python
from typing import TYPE_CHECKING, List
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.claim import Claim

class Policy(Base):
    __tablename__ = "policies"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    policy_number: Mapped[str] = mapped_column(unique=True)
    
    # Relationship
    claims: Mapped[List["Claim"]] = relationship(
        back_populates="policy",
        lazy="selectin"
    )
```

### Eager Loading

```python
from sqlalchemy.orm import selectinload, joinedload

# selectinload for one-to-many
async def get_policy_with_claims(
    session: AsyncSession, 
    policy_id: int
) -> Policy | None:
    result = await session.execute(
        select(Policy)
        .where(Policy.id == policy_id)
        .options(selectinload(Policy.claims))
    )
    return result.scalar_one_or_none()

# joinedload for many-to-one
async def get_claim_with_policy(
    session: AsyncSession,
    claim_id: int
) -> Claim | None:
    result = await session.execute(
        select(Claim)
        .where(Claim.id == claim_id)
        .options(joinedload(Claim.policy))
    )
    return result.scalar_one_or_none()
```

---

## PostGIS Integration

### Model with Geometry

```python
from geoalchemy2 import Geometry
from sqlalchemy.orm import Mapped, mapped_column

class RiskEvent(Base):
    __tablename__ = "risk_events"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    location: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326)
    )
    region_polygon: Mapped[str] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326),
        nullable=True
    )
```

### Spatial Queries

```python
from geoalchemy2 import func as geo_func
from sqlalchemy import func

# Point within polygon
async def get_events_in_region(
    session: AsyncSession,
    polygon_wkt: str
) -> list[RiskEvent]:
    result = await session.execute(
        select(RiskEvent)
        .where(
            geo_func.ST_Within(
                RiskEvent.location,
                geo_func.ST_GeomFromText(polygon_wkt, 4326)
            )
        )
    )
    return list(result.scalars().all())

# Distance calculation
async def get_nearby_events(
    session: AsyncSession,
    lat: float,
    lng: float,
    radius_km: float
) -> list[RiskEvent]:
    point = geo_func.ST_SetSRID(
        geo_func.ST_MakePoint(lng, lat), 4326
    )
    result = await session.execute(
        select(RiskEvent)
        .where(
            geo_func.ST_DWithin(
                geo_func.Geography(RiskEvent.location),
                geo_func.Geography(point),
                radius_km * 1000  # meters
            )
        )
    )
    return list(result.scalars().all())
```

---

## Transaction Management

### Explicit Transaction

```python
async def create_policy_with_claims(
    session: AsyncSession,
    policy_data: PolicyCreate,
    claims_data: list[ClaimCreate]
) -> Policy:
    async with session.begin():
        policy = Policy(**policy_data.model_dump())
        session.add(policy)
        await session.flush()  # Get policy.id
        
        for claim_data in claims_data:
            claim = Claim(
                policy_id=policy.id,
                **claim_data.model_dump()
            )
            session.add(claim)
        
        # Auto-commit on context exit
    
    await session.refresh(policy)
    return policy
```

### Row Locking (FOR UPDATE)

```python
async def lock_and_update(
    session: AsyncSession,
    policy_id: int,
    new_amount: Decimal
) -> Policy:
    async with session.begin():
        result = await session.execute(
            select(Policy)
            .where(Policy.id == policy_id)
            .with_for_update()
        )
        policy = result.scalar_one()
        policy.coverage_amount = new_amount
    return policy
```
