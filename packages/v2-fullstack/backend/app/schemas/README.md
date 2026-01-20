# Backend Schemas - v2 Pydantic Schemas

## 概述

这个目录包含所有 Pydantic Schema 定义，用于：
- API 请求验证
- 响应序列化
- 数据转换

## 文件结构

```
schemas/
├── shared.py          # 共享类型（与前端同步）
├── product.py         # 产品相关 Schema
├── policy.py          # 保单相关 Schema
├── claim.py           # 理赔相关 Schema
├── risk_event.py      # 风险事件相关 Schema
├── weather.py         # 天气数据相关 Schema
└── README.md          # 本文档
```

## 使用示例

### 1. 请求验证

```python
from fastapi import APIRouter
from app.schemas.shared import BaseQueryParams, SeriesResponse

router = APIRouter()

@router.post("/weather/series", response_model=SeriesResponse)
async def get_weather_series(params: BaseQueryParams):
    # Pydantic 自动验证 params
    # - region_code 非空
    # - time_range.end > time_range.start
    # - predicted 时 prediction_run_id 必需
    return await service.get_series(params)
```

### 2. 响应序列化

```python
from app.schemas.shared import KPIMetric, KPIResponse, ResponseMetadata
from datetime import datetime

# 构建响应
kpis = [
    KPIMetric(name="total_policies", value=1234, unit="count"),
    KPIMetric(name="total_premium", value=5678900.00, unit="CNY")
]

metadata = ResponseMetadata(
    trace_id=request.state.trace_id,
    access_mode=params.access_mode,
    cache_hit=False,
    generated_at=datetime.utcnow()
)

response = KPIResponse(kpis=kpis, metadata=metadata)

# Pydantic 自动序列化为 JSON
return response
```

### 3. 数据转换（ORM to Schema）

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.policy import Policy
from app.schemas.policy import PolicyResponse

async def get_policy(session: AsyncSession, policy_id: int) -> PolicyResponse:
    result = await session.execute(
        select(Policy).where(Policy.id == policy_id)
    )
    policy = result.scalar_one_or_none()
    
    if not policy:
        return None
    
    # Pydantic V2: model_validate with from_attributes=True
    return PolicyResponse.model_validate(policy)
```

### 4. Access Mode 裁剪

```python
from app.schemas.shared import AccessMode, ClaimEvent
from typing import Optional
from decimal import Decimal

def prune_claim_event(
    event: ClaimEvent, 
    access_mode: AccessMode
) -> ClaimEvent:
    """根据 Access Mode 裁剪敏感字段"""
    if access_mode == AccessMode.DEMO:
        # Demo 模式：隐藏金额明细
        event.payout_amount = None
    elif access_mode == AccessMode.PARTNER:
        # Partner 模式：金额脱敏（只保留范围）
        if event.payout_amount:
            event.payout_amount = round_to_range(event.payout_amount)
    
    # Admin 模式：返回完整数据
    return event

def round_to_range(amount: Decimal) -> Decimal:
    """将金额四舍五入到范围"""
    if amount < 1000:
        return Decimal(500)
    elif amount < 10000:
        return Decimal(5000)
    else:
        return Decimal(10000)
```

## Pydantic V2 关键语法

### 1. model_config（替代 class Config）

```python
from pydantic import BaseModel, ConfigDict

class MySchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,      # ✅ V2 语法
        str_strip_whitespace=True,
        validate_assignment=True
    )
    
    # class Config:  # ❌ V1 语法，禁止使用
    #     orm_mode = True
```

### 2. @field_validator（替代 @validator）

```python
from pydantic import BaseModel, field_validator

class TimeRange(BaseModel):
    start: datetime
    end: datetime
    
    @field_validator("end")  # ✅ V2 语法
    @classmethod
    def validate_end_after_start(cls, v: datetime, info) -> datetime:
        if "start" in info.data and v <= info.data["start"]:
            raise ValueError("end must be after start")
        return v
    
    # @validator("end")  # ❌ V1 语法，禁止使用
```

### 3. model_dump()（替代 dict()）

```python
schema_instance = MySchema(...)

# ✅ V2 语法
data = schema_instance.model_dump()
data_json = schema_instance.model_dump_json()

# ❌ V1 语法，禁止使用
# data = schema_instance.dict()
# data_json = schema_instance.json()
```

### 4. model_validate()（替代 parse_obj()）

```python
# ✅ V2 语法
schema = MySchema.model_validate(orm_object)
schema = MySchema.model_validate({"field": "value"})

# ❌ V1 语法，禁止使用
# schema = MySchema.parse_obj(orm_object)
```

## 金融计算精度

⚠️ **重要**：所有金额字段必须使用 `Decimal` 类型，禁止使用 `float`。

```python
from decimal import Decimal
from pydantic import BaseModel, Field

class ClaimEvent(BaseModel):
    # ✅ 正确 - 使用 Decimal
    payout_amount: Decimal = Field(..., description="赔付金额")
    payout_percentage: Decimal = Field(..., description="赔付百分比")
    
    # ❌ 错误 - 禁止使用 float
    # payout_amount: float
```

## 时间字段处理

### UTC 时间存储

```python
from datetime import datetime
from pydantic import BaseModel, Field

class EventBase(BaseModel):
    # 时间字段使用 datetime（Pydantic 自动处理 ISO 8601）
    timestamp: datetime = Field(..., description="事件时间（UTC）")
    
    # FastAPI 会自动序列化为 ISO 8601 格式
    # "2025-01-20T15:30:00Z"
```

### 时区转换（业务逻辑层处理）

```python
from datetime import datetime
from zoneinfo import ZoneInfo

def convert_to_region_tz(
    utc_time: datetime, 
    region_timezone: str
) -> datetime:
    """将 UTC 时间转换为区域时区"""
    return utc_time.replace(tzinfo=ZoneInfo("UTC")).astimezone(
        ZoneInfo(region_timezone)
    )
```

## 验证规则

### 1. 枚举验证

```python
from pydantic import BaseModel, field_validator
from app.schemas.shared import DataType

class MyParams(BaseModel):
    data_type: DataType  # 自动验证枚举值
```

### 2. 条件验证

```python
@field_validator("prediction_run_id")
@classmethod
def validate_prediction_run_id_for_predicted(
    cls, v: Optional[str], info
) -> Optional[str]:
    if "data_type" in info.data:
        if info.data["data_type"] == DataType.PREDICTED and not v:
            raise ValueError(
                "prediction_run_id is required when data_type is 'predicted'"
            )
    return v
```

### 3. 范围验证

```python
from pydantic import BaseModel, Field

class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
```

## 类型一致性

### 与前端类型对比

定期检查 Schema 是否与前端 TypeScript 类型一致：

| Python Schema | TypeScript Type | 注意事项 |
|--------------|----------------|---------|
| `DataType.HISTORICAL` | `DataType.Historical` | 枚举值一致 |
| `datetime` | `string` (ISO 8601) | 自动序列化 |
| `Decimal` | `number` | JSON 序列化 |
| `Optional[str]` | `string \| null` | 可选字段 |

### 运行验证测试

```bash
cd backend
pytest tests/schemas/test_shared_schemas.py
```

## 修改 Schema

⚠️ **重要**：修改 Schema 时必须：

1. 更新文档 `docs/v2/v2实施细则/01-Shared-Contract-实施细则.md`
2. 同步更新 TypeScript 类型
3. 同步更新本文件（`shared.py`）
4. 更新相关 API 路由
5. 更新单元测试
6. 通知前端团队

## 相关文档

- [Step 01 实施细则](../../../../../../docs/v2/v2实施细则/01-Shared-Contract-实施细则.md)
- [Pydantic V2 Migration Guide](https://docs.pydantic.dev/latest/migration/)
- [FastAPI with Pydantic V2](https://fastapi.tiangolo.com/tutorial/body/)
