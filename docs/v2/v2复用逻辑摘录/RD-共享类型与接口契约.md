## 模块信息

- **模块名**: 共享类型与接口契约（Shared Contract）
- **Reuse Type**: R1（组织方法复用，v2 全栈化重写）
- **Target Home**: Shared Contract（跨 FE/BE 的 DTO/维度定义）+ BE Schemas + FE Types
- **绑定验收锚点**: Data Product / Access Mode / Prediction Run / Consistency / Observability

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/02-项目结构优化与类型定义.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 类型系统先行：核心数据模型必须有统一定义

- 区域：Region / AdministrativeRegion
- 数据：WeatherData / DateRange / WeatherType / DataType
- 产品：Product / RiskRule / PayoutRule / Threshold / TimeWindow
- 风险：RiskEvent / RiskStatistics
- 接口：DataGenerator / ProductLibrary / RiskCalculationEngine / MapService

### 2) 类型文件分域组织，降低耦合

- types 以 domain 拆分（region/data/product/risk/map/common）
- 通过 index 统一导出

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) v2 的目标：跨端“同一套输入维度 + 同一套输出 DTO”，避免口径漂移

v2 的核心不是“把 TS 类型写全”，而是把 **Data Product 的输入维度** 与 **输出 DTO** 固化成 Shared Contract：

- FE/BE 必须共享同一套维度名与语义；
- 任何新增字段必须通过契约升级流程，而不是临时在某端加字段。

### 1) v2 必须固化的“输入维度集合”（最小集）

以下维度必须在 Shared Contract 中定义，并在所有相关 Data Product 中复用：

- `region_code`
- `time_range`（UTC）
- `data_type`（historical/predicted）
- `weather_type`
- `product_id`
- `access_mode`
- `prediction_run_id`（predicted 必须）

扩展维度（可选，但一旦使用必须入契约）：

- `region_timezone`
- `layer_id`（Map overlays）
- `granularity`（hourly/daily）
- `trace_id/correlation_id`

### 2) “时间字段”契约（强制）

- 存储与传输使用 UTC；
- 业务边界对齐使用 `region_timezone`；
- 展示时区仅用于 UI 渲染，不得写入 DTO 作为权威时间。

> 参见：`RD-时间与时区口径统一.md`、`RD-计算窗口与扩展数据.md`。

### 3) 事件/序列/聚合的 DTO 分类（建议强制）

Shared Contract 中建议明确三类输出 DTO，避免混用：

- **Series（时间序列）**：按时间点输出 value + unit + timestamps。
- **Events（事件列表）**：RiskEvent 等离散事件，必须包含 rule_version/rules_hash 与 prediction_run_id（predicted）。
- **Aggregations（聚合结果）**：按城市/网格/层级聚合的统计结果，必须标注聚合维度与口径。

### 4) 规则/产品 DTO 的边界（强制）

- 产品规则（products）必须区分 `riskRules` 与 `payoutRules`；
- risk 相关 DTO 不得携带 payout 计算结果；
- claim 相关 DTO 不得依赖 predicted 数据生成正式理赔。

> 参见：`RD-产品库与规则契约.md`。

### 5) Access Mode 与字段裁剪（必须体现在 DTO 策略中）

Shared Contract 需要明确：

- 哪些字段在 Demo/Public 下可被裁剪/模糊化；
- 哪些字段在 Admin/Internal 下才返回（例如 evidence/debug 字段）；
- 裁剪必须在后端完成并可审计（而不是 FE 隐藏）。

### 6) 演进与兼容策略（必须）

- DTO 变更必须具备：
  - 版本号或向后兼容策略（新增字段优先、禁止破坏性重命名）；
  - 迁移窗口（FE/BE 同步升级）；
  - 变更记录（why + impact）。

### 7) 可观测性字段约定（建议强制）

所有关键 Data Product 响应应包含/记录：

- `request_id/trace_id`
- `access_mode`
- `prediction_run_id`（如适用）
- `product_version` 或 `rules_hash`

---

## 关联模块（约束落点）

- **强约束**：`RD-风险计算引擎核心与策略.md`（事件字段最小集）
- **强约束**：`RD-多天气类型扩展.md`（weather_type 维度与 unit）
- **强约束**：`RD-产品库与规则契约.md`（产品 DTO 的两层规则）

---

## 验收标准（Go/No-Go）

- **维度统一**：同一维度（如 `prediction_run_id`、`access_mode`）在所有相关 API/缓存 key/日志中命名一致。
- **跨端一致**：FE 不存在“自己定义一套 DTO 字段名/语义”的分叉实现。
- **演进可控**：契约升级能做到向后兼容或有明确迁移窗口。

---

## 反例（必须禁止）

- **反例 1**：FE 用 `dateRange`/`dataType`，BE 用 `time_range`/`source_type`，导致缓存/联动无法统一。
- **反例 2**：把 “debug 字段/证据链”在 Demo/Public 下直接返回，靠前端隐藏冒充权限。
- **反例 3**：同一个 risk event 在不同接口里字段含义不同（例如 timestamp 有时是 local、有时是 UTC）。

