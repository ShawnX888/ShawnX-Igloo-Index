# Step 01: Shared Contract 基线 - 实施细则

**步骤编号**: 01  
**步骤名称**: Shared Contract 基线（维度/DTO/口径）  
**Phase**: 0 (契约基线 + 红线固化)  
**Reuse Type**: — (新建)  
**依赖**: 无  

---

## 1. 目标与交付物

### 1.1 目标

建立跨端统一的类型契约，防止口径漂移、权限旁路和预测批次混算。

### 1.2 交付物

- [ ] `docs/v2/Shared-Contract.md` - 类型定义规范文档
- [ ] `packages/v2-fullstack/frontend/src/types/` - TypeScript 类型定义
- [ ] `packages/v2-fullstack/backend/app/schemas/shared.py` - Pydantic Schema 定义

---

## 2. 统一输入维度（Unified Input Dimensions）

### 2.1 必需维度（所有 Data Product 必须支持）

| 维度 | 类型 | 说明 | 验证规则 |
|------|------|------|---------|
| `region_code` | string | 统一区域编码（如 "CN-11-0101"） | 非空，格式验证 |
| `time_range` | TimeRange | 时间范围（UTC） | start < end |
| `data_type` | DataType | 数据类型（historical/predicted） | 枚举值 |
| `weather_type` | WeatherType | 天气类型（rainfall/wind/temperature） | 枚举值 |
| `product_id` | string \| null | 产品ID | 可选 |
| `access_mode` | AccessMode | 访问模式（demo/partner/admin） | 枚举值 |
| `prediction_run_id` | string \| null | 预测批次ID（predicted时必需） | predicted时非空 |

### 2.2 可选扩展维度

| 维度 | 类型 | 说明 |
|------|------|------|
| `region_scope` | RegionScope | 区域层级（province/district） |
| `region_timezone` | string | 区域时区（如 "Asia/Shanghai"） |
| `granularity` | Granularity | 数据粒度（hourly/daily） |
| `layer_id` | string | 地图图层ID |

### 2.3 可观测性字段（Observability Fields）

| 字段 | 类型 | 说明 |
|------|------|------|
| `trace_id` | string | 请求追踪ID |
| `correlation_id` | string | 关联ID |
| `request_timestamp` | datetime | 请求时间（UTC） |

---

## 3. 枚举类型定义（Enumerations）

### 3.1 DataType（数据类型）

```
historical - 历史数据（不可变）
predicted  - 预测数据（易变，需批次管理）
```

### 3.2 WeatherType（天气类型）

```
rainfall     - 降雨
wind         - 风
temperature  - 温度
humidity     - 湿度
pressure     - 气压
```

### 3.3 AccessMode（访问模式）

```
demo     - Demo/Public（路演默认，数据脱敏）
partner  - Partner（合作伙伴，部分脱敏）
admin    - Admin/Internal（内部，全量数据）
```

### 3.4 RegionScope（区域层级）

```
province - 省级
district - 区/县级
```

### 3.5 Granularity（数据粒度）

```
hourly  - 小时级
daily   - 日级
weekly  - 周级
monthly - 月级
```

---

## 4. 核心数据结构（Core Data Structures）

### 4.1 TimeRange（时间范围）

```typescript
interface TimeRange {
  start: string;  // ISO 8601 UTC (e.g., "2025-01-01T00:00:00Z")
  end: string;    // ISO 8601 UTC
}
```

### 4.2 Region（区域）

```typescript
interface Region {
  code: string;           // 统一区域编码
  scope: RegionScope;     // 区域层级
  name: string;           // 区域名称
  timezone: string;       // 时区（如 "Asia/Shanghai"）
  geometry?: GeoJSON;     // 几何边界（可选）
}
```

---

## 5. 输出 DTO 分类（Output DTO Categories）

### 5.1 Series（时间序列）

用于展示随时间变化的数据（如天气趋势、风险累计值）。

```typescript
interface SeriesDataPoint {
  timestamp: string;      // UTC ISO 8601
  value: number;
  unit: string;
}

interface SeriesResponse {
  data_type: DataType;
  weather_type?: WeatherType;
  series: SeriesDataPoint[];
  metadata: ResponseMetadata;
}
```

### 5.2 Events（事件列表）

用于展示离散事件（如风险事件、理赔记录）。

```typescript
interface EventBase {
  id: string;
  timestamp: string;      // UTC ISO 8601
  region_code: string;
  data_type: DataType;
}

interface RiskEvent extends EventBase {
  product_id: string;
  weather_type: WeatherType;
  tier_level: TierLevel;   // tier1/tier2/tier3
  trigger_value: number;
  threshold_value: number;
  prediction_run_id?: string;
}

interface EventsResponse<T extends EventBase> {
  events: T[];
  total: number;
  metadata: ResponseMetadata;
}
```

### 5.3 Aggregations（聚合结果）

用于展示统计汇总（如KPI、排名）。

```typescript
interface AggregationDimension {
  name: string;
  values: string[];
}

interface AggregationResponse {
  dimensions: AggregationDimension[];
  metrics: Record<string, number>;
  aggregation_scope: string;
  metadata: ResponseMetadata;
}
```

---

## 6. Response Metadata（响应元数据）

所有 Data Product 响应必须包含的元数据：

```typescript
interface ResponseMetadata {
  trace_id: string;
  correlation_id?: string;
  access_mode: AccessMode;
  prediction_run_id?: string;
  cache_hit: boolean;
  generated_at: string;     // UTC ISO 8601
}
```

---

## 7. Access Mode 裁剪规则（Field Pruning Rules）

### 7.1 字段级裁剪

| 字段类别 | Demo | Partner | Admin |
|---------|------|---------|-------|
| 基础信息 | ✅ | ✅ | ✅ |
| 金额明细 | ❌ 范围化 | ⚠️ 脱敏 | ✅ 完整 |
| 个人/组织信息 | ❌ | ⚠️ 部分 | ✅ 完整 |
| 内部ID/调试字段 | ❌ | ❌ | ✅ |

### 7.2 粒度级裁剪

| 数据粒度 | Demo | Partner | Admin |
|---------|------|---------|-------|
| 省级聚合 | ✅ | ✅ | ✅ |
| 区县级聚合 | ⚠️ Top5 | ✅ | ✅ |
| 明细记录 | ❌ | ⚠️ 采样/摘要 | ✅ |

---

## 8. 缓存 Key 维度规则（Cache Key Rules）

### 8.1 必需维度

所有缓存 key 必须包含：
- `region_code`
- `time_range` (序列化后)
- `data_type`
- `weather_type`
- `access_mode`

### 8.2 Predicted 数据额外维度

- `prediction_run_id` (必须)

### 8.3 缓存 Key 格式

```
dp:{data_product}:{access_mode}:{region_code}:{time_range_hash}:{data_type}:{weather_type}[:prediction_run_id]
```

示例：
```
dp:l0_dashboard:demo:CN-11:abc123:historical:rainfall
dp:l1_region:admin:CN-11-0101:def456:predicted:wind:run_20250120_001
```

---

## 9. 时间字段契约（Time Field Contract）

### 9.1 三层时间口径

| 层级 | 格式 | 用途 |
|-----|------|------|
| Storage & Transport | UTC ISO 8601 | 数据库存储、API传输 |
| Business Boundary | region_timezone | 业务边界对齐（"per day"等） |
| Presentation | User local timezone | UI展示 |

### 9.2 时间字段命名约定

| 字段名 | 格式 | 说明 |
|-------|------|------|
| `*_timestamp` / `*_time` | UTC ISO 8601 | 权威时间戳 |
| `*_at` | UTC ISO 8601 | 审计时间（created_at, updated_at） |
| `time_range` | TimeRange | 时间范围（UTC） |
| `calculation_range` | TimeRange | 计算窗口（含扩展，UTC） |

---

## 10. 契约演进策略（Contract Evolution）

### 10.1 版本控制

- API 路径包含版本号：`/api/v1/`
- Schema 变更记录在 `CHANGELOG.md`
- 破坏性变更需要新版本号

### 10.2 向后兼容原则

- 新增字段：✅ 允许（可选字段）
- 重命名字段：❌ 禁止（使用新字段+废弃标记）
- 删除字段：❌ 禁止（使用废弃标记）
- 修改字段类型：❌ 禁止（使用新字段）

### 10.3 迁移窗口

破坏性变更需要提前通知，并提供：
- 迁移指南
- 兼容性适配层（如需要）
- 最短6个月的并行支持期

---

## 11. 验收标准（Acceptance Criteria）

### 11.1 维度统一

- [ ] 所有维度在 TypeScript 和 Pydantic 中命名一致
- [ ] 枚举值在前后端保持同步
- [ ] 时间字段格式统一为 UTC ISO 8601

### 11.2 类型安全

- [ ] TypeScript 类型定义完整，无 `any` 类型
- [ ] Pydantic Schema 包含完整的验证规则
- [ ] 所有必需字段标记为 required

### 11.3 文档完整性

- [ ] 每个维度都有清晰的说明
- [ ] 每个枚举类型都有完整的值列表
- [ ] 缓存 key 规则有明确示例

### 11.4 可追溯性

- [ ] 所有响应包含 `trace_id`
- [ ] Predicted 数据包含 `prediction_run_id`
- [ ] 响应元数据包含 `access_mode`

---

## 12. 实施步骤（Implementation Steps）

1. **创建类型定义文档**（本文档）
2. **创建 TypeScript 类型**
   - 创建 `frontend/src/types/shared/` 目录
   - 定义枚举、接口、类型别名
3. **创建 Pydantic Schema**
   - 创建 `backend/app/schemas/shared.py`
   - 定义枚举、BaseModel、验证器
4. **同步验证**
   - 编写类型一致性测试
   - 验证序列化/反序列化

---

## 13. 相关文档

- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`
- `docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md`
- `docs/v2/v2技术方案.md` - Section 12（系统约定）

---

**创建日期**: 2026-01-20  
**状态**: ✅ 规范完成  
**下一步**: 实施 TypeScript 类型定义和 Pydantic Schema
