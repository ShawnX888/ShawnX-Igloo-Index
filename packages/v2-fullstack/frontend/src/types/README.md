# Shared Contract - TypeScript Types

## 概述

本目录包含v2全栈架构的Shared Contract (TypeScript types),定义了前端与后端之间的统一接口契约。

## 核心原则

### 1. 跨端一致性

所有types必须与后端Pydantic schemas (`backend/app/schemas/shared.py`) **完全对应**:

- 枚举值必须一致 (如 `AccessMode.DEMO_PUBLIC` ↔ `AccessMode.DEMO_PUBLIC`)
- 字段名对应关系:
  - Python: `snake_case` ↔ TypeScript: `camelCase` (API层自动转换)
  - 或统一使用 `snake_case` (推荐,减少转换复杂度)
- 必填/可选字段规则必须一致
- 验证规则必须一致

### 2. 输入维度固化

所有Data Product请求必须使用 `SharedDimensions`:

```typescript
import { SharedDimensions, RegionScope, DataType, WeatherType, AccessMode } from '@/types';

const dimensions: SharedDimensions = {
  region_scope: RegionScope.PROVINCE,
  region_code: 'CN-GD',
  time_range: {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-31T23:59:59Z',
  },
  data_type: DataType.HISTORICAL,
  weather_type: WeatherType.RAINFALL,
  access_mode: AccessMode.DEMO_PUBLIC,
  product_id: 'daily_rainfall',  // 可选
  prediction_run_id: undefined,  // historical必须为undefined
};
```

### 3. 输出DTO分类

所有Data Product响应遵循 `DataProductResponse` 格式:

```typescript
interface DataProductResponse {
  series?: SeriesData[];      // 时间序列
  events?: EventData[];       // 事件数据
  aggregations?: AggregationData[];  // 聚合数据
  legend: LegendMeta;        // 图例与元信息
  meta: ResponseMeta;        // 响应元数据
}
```

### 4. Mode裁剪规则

根据 `access_mode` 前端呈现不同能力:

- `DEMO_PUBLIC`: 简化展示、隐藏复杂功能按钮(但后端已裁剪数据)
- `PARTNER`: 更多分析工具、部分明细
- `ADMIN_INTERNAL`: 全量功能、全量明细

**硬规则**: 前端只控制UI展示,真正的权限裁剪在后端。

### 5. predicted批次一致性

- `data_type=predicted` 时,`prediction_run_id` **必须**提供
- `data_type=historical` 时,`prediction_run_id` **必须**为undefined
- 使用 `toCacheKey(dimensions)` 生成缓存key,自动包含 `prediction_run_id`

## 使用示例

### 创建请求维度

```typescript
import {
  SharedDimensions,
  RegionScope,
  DataType,
  WeatherType,
  AccessMode,
  validateSharedDimensions,
  toCacheKey,
} from '@/types';

const dimensions: SharedDimensions = {
  region_scope: RegionScope.PROVINCE,
  region_code: 'CN-GD',
  time_range: {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-31T23:59:59Z',
  },
  data_type: DataType.HISTORICAL,
  weather_type: WeatherType.RAINFALL,
  access_mode: AccessMode.DEMO_PUBLIC,
};

// 验证
const { valid, errors } = validateSharedDimensions(dimensions);
if (!valid) {
  console.error('Invalid dimensions:', errors);
  return;
}

// 生成缓存key
const cacheKey = toCacheKey(dimensions);
```

### 使用TanStack Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { SharedDimensions, DataProductResponse } from '@/types';

async function fetchDataProduct(
  dimensions: SharedDimensions
): Promise<DataProductResponse> {
  const response = await fetch('/api/v1/data-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dimensions),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch data product');
  }
  
  return response.json();
}

function useDataProduct(dimensions: SharedDimensions) {
  return useQuery({
    queryKey: ['data-product', toCacheKey(dimensions)],
    queryFn: () => fetchDataProduct(dimensions),
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}
```

### 创建TraceContext

```typescript
import { createTraceContext, SharedDimensions } from '@/types';

const traceContext = createTraceContext(dimensions, 'custom-trace-id');

// 发送到后端
fetch('/api/v1/data-product', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Trace-Id': traceContext.trace_id,
  },
  body: JSON.stringify(dimensions),
});
```

## 验证规则

### validateSharedDimensions

```typescript
import { validateSharedDimensions, DataType } from '@/types';

const { valid, errors } = validateSharedDimensions({
  // ...
  data_type: DataType.PREDICTED,
  prediction_run_id: undefined,  // ❌ 错误: predicted需要prediction_run_id
});

if (!valid) {
  console.error('Validation errors:', errors);
  // ['prediction_run_id is required when data_type is predicted']
}
```

## 辅助函数

### toCacheKey

生成一致的缓存key:

```typescript
import { toCacheKey } from '@/types';

const key1 = toCacheKey(dimensions1);
const key2 = toCacheKey(dimensions2);

if (key1 === key2) {
  console.log('Same cache entry');
}
```

### createTraceContext

创建追踪上下文:

```typescript
import { createTraceContext } from '@/types';

const traceContext = createTraceContext(dimensions);
// 自动生成 trace_id, 包含所有关键维度
```

## 类型守卫

```typescript
function isHistoricalData(
  response: DataProductResponse
): boolean {
  return response.legend.data_type === DataType.HISTORICAL;
}

function isPredictedData(
  response: DataProductResponse
): boolean {
  return response.legend.data_type === DataType.PREDICTED;
}

// 使用
if (isPredictedData(response)) {
  console.log('Prediction run:', response.legend.prediction_run_id);
}
```

## 演进策略

### 新增维度

1. 在 `SharedDimensions` 添加可选字段
2. 更新 `toCacheKey` 函数(如果影响缓存)
3. 同步更新后端Pydantic schema
4. 更新文档

### 新增DTO类型

1. 在 `shared.ts` 添加新interface
2. 同步更新后端Pydantic schema
3. 更新 `DataProductResponse` (如需要)

### 破坏性变更

避免破坏性变更。如果必须:

1. 新增版本化type (如 `SharedDimensionsV2`)
2. 保留旧type至少一个迁移窗口
3. 提供迁移指南
4. 在文档中标记deprecation

## 参考文档

- `docs/v2/v2实施细则/01-Shared-Contract基线-细则.md`
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`

## 常见问题

### Q: 为什么TypeScript和Python字段名不一致?

A: Python使用 `snake_case`,TypeScript使用 `camelCase`。但在API层我们统一使用 `snake_case` 以减少转换复杂度。

### Q: 如何确保前后端类型一致?

A: 
1. 定期运行验收测试(步骤01的验收用例)
2. 使用代码生成工具(可选,未来)
3. 在PR review中检查

### Q: `prediction_run_id` 什么时候需要?

A: 当 `data_type === DataType.PREDICTED` 时必须提供。如果不提供,`validateSharedDimensions` 会报错。

### Q: 如何处理Decimal类型?

A: 后端使用 `Decimal`,前端接收为 `string`。在需要计算时转为 `number`,显示时保持 `string` 精度。

```typescript
// 接收
const amount: string = event.amount; // "1234.56"

// 计算
const numericAmount = parseFloat(amount);

// 显示
<div>{amount} CNY</div> // 保持精度
```
