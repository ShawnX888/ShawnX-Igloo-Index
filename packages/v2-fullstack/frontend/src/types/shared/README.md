# Shared Types - v2 Shared Contract

## 概述

这个目录包含了前后端共享的类型定义，确保跨端一致性。这些类型定义是 v2 架构的核心契约。

## 文件结构

```
shared/
├── enums.ts           # 枚举类型定义
├── common.ts          # 通用数据结构
├── data-products.ts   # 数据产品DTO
├── index.ts           # 统一导出
└── README.md          # 本文档
```

## 使用示例

### 1. 导入枚举类型

```typescript
import { DataType, WeatherType, AccessMode } from '@/types/shared';

const queryParams = {
  data_type: DataType.Historical,
  weather_type: WeatherType.Rainfall,
  access_mode: AccessMode.Demo
};
```

### 2. 使用类型守卫

```typescript
import { isDataType, isWeatherType } from '@/types/shared';

function processData(type: unknown) {
  if (isDataType(type)) {
    // TypeScript 现在知道 type 是 DataType
    console.log(`Valid data type: ${type}`);
  }
}
```

### 3. 构建查询参数

```typescript
import { BaseQueryParams, TimeRange } from '@/types/shared';

const query: BaseQueryParams = {
  region_code: 'CN-11-0101',
  time_range: {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-31T23:59:59Z'
  },
  data_type: DataType.Historical,
  weather_type: WeatherType.Rainfall,
  access_mode: AccessMode.Demo
};
```

### 4. 处理响应数据

```typescript
import { SeriesResponse, EventsResponse, RiskEvent } from '@/types/shared';

// 时间序列响应
const seriesData: SeriesResponse = await api.getWeatherSeries(query);
seriesData.series.forEach(point => {
  console.log(`${point.timestamp}: ${point.value} ${point.unit}`);
});

// 事件响应
const eventsData: EventsResponse<RiskEvent> = await api.getRiskEvents(query);
eventsData.events.forEach(event => {
  console.log(`Risk ${event.tier_level} at ${event.timestamp}`);
});
```

### 5. 处理分页数据

```typescript
import { PaginatedResponse, PaginationParams } from '@/types/shared';

const pagination: PaginationParams = {
  page: 1,
  page_size: 20
};

const result: PaginatedResponse<RiskEvent> = await api.getRiskEventsPaginated({
  ...query,
  ...pagination
});

console.log(`Total: ${result.total}, Pages: ${result.total_pages}`);
```

## 重要约定

### 1. 时间格式

**所有时间字段必须使用 UTC ISO 8601 格式**：

```typescript
// ✅ 正确
const timestamp = '2025-01-20T15:30:00Z';

// ❌ 错误
const timestamp = '2025-01-20 15:30:00';
const timestamp = new Date().toLocaleString();
```

### 2. Predicted 数据必须包含 prediction_run_id

```typescript
// ✅ 正确 - predicted 数据包含 run_id
const query: BaseQueryParams = {
  // ... 其他字段
  data_type: DataType.Predicted,
  prediction_run_id: 'run_20250120_001'  // ✅ 必需
};

// ❌ 错误 - predicted 数据缺少 run_id
const query: BaseQueryParams = {
  // ... 其他字段
  data_type: DataType.Predicted
  // prediction_run_id 缺失！
};
```

### 3. Access Mode 驱动字段可见性

不同的 access_mode 会影响后端返回的字段：

```typescript
// Demo 模式 - 部分字段可能被裁剪或脱敏
const demoQuery = { ...query, access_mode: AccessMode.Demo };

// Admin 模式 - 返回完整数据
const adminQuery = { ...query, access_mode: AccessMode.Admin };
```

### 4. 响应元数据追踪

所有响应都包含元数据用于追踪和调试：

```typescript
const response: SeriesResponse = await api.getData(query);

console.log('Trace ID:', response.metadata.trace_id);
console.log('Cache Hit:', response.metadata.cache_hit);
console.log('Access Mode:', response.metadata.access_mode);
```

## 类型一致性检查

### 前端类型检查

```bash
cd frontend
npm run typecheck
```

### 与后端类型对比

定期检查前后端类型是否一致：

1. 枚举值必须完全匹配
2. 字段名必须完全匹配（使用 snake_case）
3. 必需/可选字段标记必须一致

## 修改类型定义

⚠️ **重要**：修改共享类型时必须：

1. 更新文档 `docs/v2/v2实施细则/01-Shared-Contract-实施细则.md`
2. 同步更新 TypeScript 类型（本目录）
3. 同步更新 Pydantic Schema (`backend/app/schemas/shared.py`)
4. 更新 CHANGELOG
5. 通知前后端团队

## 相关文档

- [Step 01 实施细则](../../../../../../docs/v2/v2实施细则/01-Shared-Contract-实施细则.md)
- [v2 技术方案](../../../../../../docs/v2/v2技术方案.md)
- [v2 项目总览](../../../../../../docs/v2/v2项目总览.md)
