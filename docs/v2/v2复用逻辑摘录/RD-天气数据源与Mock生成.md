## 模块信息

- **模块名**: 天气数据源与 Mock 生成（Deterministic Mock as Fallback）
- **Reuse Type**: R1（方法论复用，v2 数据源/服务化重写）
- **Target Home**: BE（Weather/Statistics Service）+ FE（仅用于本地开发可选）+ Shared Contract
- **绑定验收锚点**: Data Product / Prediction Run / Perf-SLO / Security / Observability

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/04-Mock数据生成器.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 从“静态 mock”升级为“运行时动态生成”

- 静态 mock 数据清空，改为根据用户选择的区域与时间范围动态生成。

### 2) 核心要求：确定性 + 增量补全 + 缓存

- **确定性**：同一区域同一时间生成的数据应一致（使用区域名称作为 seed）。
- **增量补全**：已有数据不重复生成，只补缺失时间段。
- **缓存**：缓存 key 基于区域、时间范围、数据类型（以及天气类型）。
- **性能预算**：生成/补全 2 秒内，缓存命中 100ms 内。

### 3) 数据维度与格式

- 输入维度：`region`、`dateRange`、`dataType`（historical/predicted）、`weatherType`。
- 输出：区域下各城市/区的时间序列（小时级/日级）。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) v2 的定位：Mock 是“可插拔数据源”，不得变成“口径特例”

- Mock 只能用于：
  - 本地开发；
  - Demo/Public 的离线演示（若业务允许，且严格隔离环境）。
- Mock 必须 **完全遵守** v2 的 Data Product 契约与维度，否则：
  - 联调阶段会出现“看似能跑、实际不可上线”的假一致性。

### 1) 数据源抽象（必须）

- Weather/Statistics Service 必须支持多数据源：
  - Real API（如 Weather API / 自建数据仓）；
  - Mock Generator（deterministic）。
- 切换必须通过配置/feature flag，且可审计：
  - `data_source=real|mock` 必须写入日志/trace。

### 2) v2 必备输入维度（Mock 也必须接收）

- `region_code`
- `time_range`（UTC）
- `region_timezone`（用于业务边界对齐；Mock 生成/对齐也必须遵守）
- `data_type`（historical/predicted）
- `weather_type`
- `prediction_run_id`（predicted 必须；Mock 也必须支持 run，以便一致性演练）
- `access_mode`

### 3) 确定性与可复现性（强制）

- 同一组输入维度生成的数据必须可复现：
  - seed 必须至少由（region_code, weather_type, data_type, prediction_run_id）决定；
  - 不允许在 predicted 模式下“每次刷新随机抖动但不带 run”（会破坏预测批次一致性模型）。

### 4) 缓存与增量补全（v2 约束）

- 生成器应支持：
  - 分段缓存（按时间桶）；
  - 增量补齐缺口；
  - 缓存 key 必须包含：
    - `region_code`、`weather_type`、`data_type`、`access_mode`
    - predicted 时必须包含 `prediction_run_id`
- 任何“补齐行为”必须可观测：记录补齐区间与耗时。

### 5) 数据形态与对齐口径（必须一致）

- 所有时间戳输出必须为 UTC；
- 自然日/周/月对齐必须以 `region_timezone` 为准（见 `RD-时间与时区口径统一.md`）；
- 若下游需要小时级与日级两套序列：
  - 必须明确聚合规则（sum/avg/max/min）与单位；
  - 不允许 FE 自己把小时序列随意聚合成日序列作为权威。

### 6) 安全与环境隔离（硬要求）

- 生产环境必须禁用 mock 数据源（或必须显式开启且有审计告警）。
- Demo/Public 若启用 mock：
  - 必须在 UI/日志中可识别（避免把 mock 当真实数据对外陈述）；
  - 仍需遵守 access_mode 裁剪策略。

### 7) 可观测性（必须）

每次 Weather/Stats 数据产品响应必须包含/记录：

- `data_source`（real/mock）
- 输入维度（含 `prediction_run_id`、`access_mode`、`region_timezone`）
- 缓存命中情况与生成耗时
- 数据覆盖范围（time_range 与实际覆盖范围差异）

---

## 关联模块（约束落点）

- **强约束**：`RD-多天气类型扩展.md`（weather_type 维度）
- **强约束**：`RD-计算窗口与扩展数据.md`（扩展拉取窗口与裁剪）
- **强约束**：`RD-风险计算引擎核心与策略.md`（risk 取数一致性与可追溯）

---

## 验收标准（Go/No-Go）

- **契约一致**：Mock 与 Real API 的输出字段与维度一致（可互换）。
- **predicted 一致性**：Mock predicted 必须绑定 `prediction_run_id`，同 run 可复现。
- **可观测**：能从日志追溯本次结果使用的数据源与缓存/生成行为。
- **环境隔离**：生产默认禁用 mock（或启用必须有显式审计/告警）。

---

## 反例（必须禁止）

- **反例 1**：Mock 走“特殊字段/特殊时间口径”，导致上线换真实数据源后全链路崩。
- **反例 2**：predicted mock 每次刷新随机变动但不带 `prediction_run_id`，破坏一致性模型。
- **反例 3**：缓存 key 漏掉 `access_mode` 或 `prediction_run_id`，造成跨模式/跨批次串数据。

