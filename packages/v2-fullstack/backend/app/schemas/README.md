# Shared Contract - Pydantic Schemas

## 概述

本目录包含v2全栈架构的Shared Contract (Pydantic V2 schemas),定义了前后端之间的统一接口契约。

## 核心原则

### 1. 跨端一致性

所有schemas必须与前端TypeScript types (`frontend/src/types/shared.ts`) **完全对应**:

- 枚举值必须一致 (如 `AccessMode.DEMO_PUBLIC` ↔ `AccessMode.DEMO_PUBLIC`)
- 字段名必须一致 (使用 snake_case 在Python, camelCase 在TypeScript)
- 必填/可选字段规则必须一致
- 验证规则必须一致

### 2. 输入维度固化

所有Data Product请求必须使用 `SharedDimensions`,包含:

```python
from app.schemas import SharedDimensions

dimensions = SharedDimensions(
    region_scope=RegionScope.PROVINCE,
    region_code="CN-GD",
    time_range=TimeRange(start=..., end=...),
    data_type=DataType.HISTORICAL,
    weather_type=WeatherType.RAINFALL,
    access_mode=AccessMode.DEMO_PUBLIC,
    product_id="daily_rainfall",  # 可选
    prediction_run_id=None,       # historical必须为None
)
```

### 3. 输出DTO分类

所有Data Product响应必须使用统一的 `DataProductResponse`,包含:

- `series`: 时间序列数据 (`SeriesData`)
- `events`: 事件数据 (`EventData`)
- `aggregations`: 聚合数据 (`AggregationData`)
- `legend`: 图例与元信息 (`LegendMeta`)
- `meta`: 响应元数据 (`ResponseMeta`)

### 4. Mode裁剪规则

根据 `access_mode` 裁剪输出:

- `DEMO_PUBLIC`: 少数字、强可视化、敏感字段范围化/聚合
- `PARTNER`: 更深KPI、明细字段脱敏(可配置)
- `ADMIN_INTERNAL`: 全量字段与明细

**硬规则**: 前端隐藏不算权限,后端必须按 `access_mode` 裁剪输出。

### 5. predicted批次一致性

- `data_type=predicted` 时,`prediction_run_id` **必须**提供
- `data_type=historical` 时,`prediction_run_id` **必须**为None
- 缓存key必须包含 `prediction_run_id` (通过 `SharedDimensions.to_cache_key()`)

## 使用示例

### 创建请求维度

```python
from app.schemas import SharedDimensions, TimeRange, DataType, WeatherType, AccessMode
from datetime import datetime

dimensions = SharedDimensions(
    region_scope=RegionScope.PROVINCE,
    region_code="CN-GD",
    time_range=TimeRange(
        start=datetime(2025, 1, 1, tzinfo=timezone.utc),
        end=datetime(2025, 1, 31, 23, 59, 59, tzinfo=timezone.utc)
    ),
    data_type=DataType.HISTORICAL,
    weather_type=WeatherType.RAINFALL,
    access_mode=AccessMode.DEMO_PUBLIC,
)

# 生成缓存key
cache_key = dimensions.to_cache_key()
```

### 创建响应

```python
from app.schemas import (
    DataProductResponse,
    SeriesData,
    EventData,
    AggregationData,
    LegendMeta,
    ResponseMeta,
    TraceContext,
)

response = DataProductResponse(
    series=[
        SeriesData(
            timestamps=[datetime.now(timezone.utc)],
            values=[100.5],
            unit="mm"
        )
    ],
    events=None,
    aggregations=[
        AggregationData(
            aggregation_key="CN-GD",
            aggregation_method="sum",
            value=1250.5,
            unit="mm"
        )
    ],
    legend=LegendMeta(
        data_type=DataType.HISTORICAL,
        weather_type=WeatherType.RAINFALL,
        unit="mm",
        thresholds={"tier1": 50.0, "tier2": 100.0, "tier3": 150.0}
    ),
    meta=ResponseMeta(
        trace_context=TraceContext(
            trace_id="trace-123",
            access_mode=AccessMode.DEMO_PUBLIC,
            # ... 其他维度
        ),
        cached=False,
        response_at=datetime.now(timezone.utc)
    )
)
```

## 验证规则

### SharedDimensions验证

- `time_range.end` 必须晚于 `time_range.start`
- `region_code` 长度在2-20之间
- `prediction_run_id`:
  - `data_type=predicted` 时必须提供
  - `data_type=historical` 时必须为None

### EventData验证

- `data_type=predicted` 时 `prediction_run_id` 必须提供

## 演进策略

### 新增维度

1. 在 `SharedDimensions` 添加可选字段
2. 更新 `to_cache_key()` 方法(如果影响缓存)
3. 同步更新前端TypeScript types
4. 更新文档

### 新增DTO类型

1. 在 `shared.py` 添加新DTO类
2. 继承 `BaseModel`,使用 `model_config = ConfigDict(from_attributes=True)`
3. 同步更新前端TypeScript interface
4. 更新 `DataProductResponse` (如需要)

### 破坏性变更

避免破坏性变更。如果必须:

1. 新增版本化schema (如 `SharedDimensionsV2`)
2. 保留旧schema至少一个迁移窗口
3. 提供迁移指南
4. 在文档中标记deprecation

## 参考文档

- `docs/v2/v2实施细则/01-Shared-Contract基线-细则.md`
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`

## 常见问题

### Q: 为什么要单独的 `SharedDimensions`?

A: 统一输入维度是避免"口径漂移"的关键。所有Data Product使用同一套维度命名,确保缓存key、日志、追踪一致。

### Q: 为什么区分 `Series/Events/Aggregations`?

A: 避免在同一响应中混用不同形态的数据,导致前端解析困难。明确的DTO分类使得缓存、渲染策略更清晰。

### Q: `access_mode` 必须在哪里裁剪?

A: **后端Service层**。前端隐藏不算权限,后端必须根据 `access_mode` 裁剪输出字段/粒度。

### Q: `prediction_run_id` 为什么这么重要?

A: 预测数据"会变"。同一时间点可能被多次刷新。`prediction_run_id` 确保缓存/AI/前端使用同一批次数据,避免解释断裂。
