# Pydantic V2 Patterns

## Table of Contents

1. [Migration from V1](#migration-from-v1)
2. [ConfigDict Options](#configdict-options)
3. [Field Validators](#field-validators)
4. [Serialization](#serialization)
5. [Financial Precision](#financial-precision)

---

## Migration from V1

| V1 Syntax | V2 Syntax |
|-----------|-----------|
| `class Config:` | `model_config = ConfigDict(...)` |
| `@validator` | `@field_validator` |
| `.dict()` | `.model_dump()` |
| `.parse_obj()` | `.model_validate()` |
| `orm_mode = True` | `from_attributes = True` |

---

## ConfigDict Options

```python
from pydantic import BaseModel, ConfigDict

class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,      # Enable ORM mode
        str_strip_whitespace=True, # Strip whitespace from strings
        validate_assignment=True,  # Validate on attribute assignment
        use_enum_values=True,      # Use enum values instead of enum objects
        arbitrary_types_allowed=True,  # Allow non-Pydantic types
    )
```

---

## Field Validators

### Single Field Validation

```python
from pydantic import BaseModel, field_validator
from decimal import Decimal

class ClaimCreate(BaseModel):
    payout_amount: Decimal
    tier_level: str
    
    @field_validator("payout_amount")
    @classmethod
    def validate_payout(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Payout amount cannot be negative")
        return v
    
    @field_validator("tier_level")
    @classmethod
    def validate_tier(cls, v: str) -> str:
        valid_tiers = {"tier1", "tier2", "tier3"}
        if v not in valid_tiers:
            raise ValueError(f"tier_level must be one of {valid_tiers}")
        return v
```

### Multi-Field Validation

```python
from pydantic import model_validator

class PolicyCreate(BaseModel):
    coverage_start: datetime
    coverage_end: datetime
    
    @model_validator(mode="after")
    def validate_dates(self) -> "PolicyCreate":
        if self.coverage_end <= self.coverage_start:
            raise ValueError("coverage_end must be after coverage_start")
        return self
```

---

## Serialization

### Conditional Field Exclusion

```python
class PolicyResponse(BaseModel):
    id: int
    policy_number: str
    internal_notes: str | None = None
    
    model_config = ConfigDict(from_attributes=True)

# Usage
policy.model_dump(exclude={"internal_notes"})
policy.model_dump(include={"id", "policy_number"})
```

### Custom Serializers

```python
from pydantic import field_serializer

class ClaimResponse(BaseModel):
    payout_amount: Decimal
    
    @field_serializer("payout_amount")
    def serialize_amount(self, v: Decimal) -> str:
        return f"{v:.2f}"
```

---

## Financial Precision

### Decimal Field Configuration

```python
from decimal import Decimal
from pydantic import BaseModel, Field

class FinancialSchema(BaseModel):
    coverage_amount: Decimal = Field(
        ...,
        ge=Decimal("0"),
        le=Decimal("10000000"),
        decimal_places=2
    )
    payout_percentage: Decimal = Field(
        ...,
        ge=Decimal("0"),
        le=Decimal("100"),
        decimal_places=2
    )
```

### JSON Serialization with Decimal

```python
import json
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)

# In FastAPI response
from fastapi.responses import JSONResponse

class DecimalJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, cls=DecimalEncoder).encode()
```

---

## Region Schema (JSONB)

```python
from pydantic import BaseModel

class RegionSchema(BaseModel):
    country: str
    province: str | None = None
    district: str | None = None
    
    model_config = ConfigDict(extra="forbid")

class PolicyCreate(BaseModel):
    coverage_region: RegionSchema
```
