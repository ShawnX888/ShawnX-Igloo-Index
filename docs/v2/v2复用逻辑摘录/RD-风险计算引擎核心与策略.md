## 模块信息

- **模块名**: 风险计算引擎核心与策略（Risk Engine Core）
- **Reuse Type**: R2（逻辑复用，但必须后端重写/服务化）
- **Target Home**: BE（Risk Service + Compute Tasks）+ Shared Contract
- **绑定验收锚点**: Data Product / Prediction Run / Perf-SLO / Observability / CPU-Isolation

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/07-风险计算引擎核心.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 计算引擎只做“产品级风险事件触发条件”

- 风险引擎仅基于 `products.riskRules` 生成风险事件列表（RiskEvent[]）。
- 不涉及赔付金额/频次等保单级规则（payoutRules）。

### 2) 计算框架由三段组成：规则解析 → 计算 → 结果格式化

- **规则解析器**：解析 timeWindow/thresholds/calculation，并校验有效性。
- **计算器**：按窗口滑动（hourly/daily/weekly/monthly），聚合（sum/avg/max/min），比较阈值，生成事件。
- **结果格式化器**：输出事件列表 + 统计 + 可视化所需结构。

### 3) 扩展数据是正确性前提

- 计算应使用扩展时间范围的天气数据，确保 time_range 起点的回溯窗口完整（否则第一段结果不准）。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) 责任边界（v2 强制）

- **Risk Engine（计算内核）**：纯计算（输入：规则 + 时间序列；输出：事件/统计），不依赖 DB session。
- **Risk Service（服务层）**：
  - 取产品规则（Product Service）；
  - 取天气数据（Weather/Statistics Service）；
  - 负责时间口径对齐、扩展窗口、预测批次一致性、缓存、审计与可观测；
  - 调用 Risk Engine 得到结果并裁剪输出。
- **API/Router（路由层）**：只做参数校验与调用服务；禁止在 `async def` 里做重计算。

### 1) 必备输入维度（服务层必须显式接收/推导）

- `product_id`
- `region_code`
- `time_range`（UTC 展示窗）
- `region_timezone`（用于业务边界对齐）
- `data_type`（historical/predicted）
- `weather_type`（可从产品推导，但最终必须显式记录）
- `prediction_run_id`（predicted 必须）
- `access_mode`

> 相关口径：`RD-时间与时区口径统一.md`、`RD-计算窗口与扩展数据.md`、`RD-产品库与规则契约.md`。

### 2) 窗口语义（必须一致）

- `timeWindow.type/size/step` 的统一语义以 `RD-产品库与规则契约.md` 为准。
- `monthly` 等固定窗口必须以 `region_timezone` 的自然月边界对齐后再转换为 UTC 计算与存储。
- **输出裁剪**：事件/统计结果必须裁剪回 `time_range`（展示窗），扩展窗口只用于计算。

### 3) 事件模型（RiskEvent）最小字段集（Shared Contract）

为保障可追溯与前端一致展示，risk event 至少要包含：

- `event_time_utc`（权威时间）
- `region_code`
- `product_id`
- `weather_type`
- `data_type`
- `prediction_run_id`（predicted 必须）
- `level`（tier1/tier2/tier3）
- `value`（触发时的聚合值）
- `rule_version` 或 `rules_hash`（用于解释与审计）

### 4) 预测批次一致性（强制）

- predicted 模式下：
  - 输入必须提供/绑定 `prediction_run_id`；
  - 计算过程中不得跨 run 取数；
  - 输出必须带同一 `prediction_run_id`。

### 5) 性能与 CPU 隔离（强制）

- 风险事件计算属于 CPU/IO 混合：
  - 若仅是轻量聚合：可在服务层同步执行，但必须有预算（p95）与缓存；
  - 若涉及大范围区域、多维聚合、复杂阈值：必须下沉到异步任务（Celery）并返回任务/缓存结果。
- 任何情况下：
  - 不能在请求链路中“对全省所有城市逐条计算”而无预聚合策略；
  - 缓存 key 必须包含 `access_mode` 与（predicted 时）`prediction_run_id`。

### 6) 结果分层输出（必须可直接喂给 L0/L1/L2）

- 输出分层结构（L0 聚合 / L1/L2 解释）的**权威定义**以 `RD-风险分析统一入口与聚合输出.md` 的「3.2 统一输出形态」为准。
- 本 RD 只强调：Risk Service 至少应能产出该权威定义中的两类形态，并确保输出裁剪/Mode 裁剪/批次一致性在服务端闭环。

### 7) 可观测性（必须能复盘差异）

每次风险计算/查询必须记录：

- 输入维度（含 `time_range`、`calculation_range`、`region_timezone`、`prediction_run_id`、`access_mode`）
- 产品规则版本（`rules_hash`/`product_version`）
- 缓存命中/失效原因
- 计算耗时与数据量级（点数/城市数/窗口跨度）

---

## 关联模块（约束落点）

- **强约束**：`RD-风险分析统一入口与聚合输出.md`（后端为唯一事实源 + 输出分层）
- **强约束**：`RD-风险事件标记图层.md`（L0 聚合数据来源与一致性）
- **强约束**：`RD-图表可视化.md`（L2 解释输出与窗口口径）

---

## 验收标准（Go/No-Go）

- **职责清晰**：risk engine 纯计算，service 负责取数/对齐/一致性/裁剪，router 不做重算。
- **正确性**：使用扩展窗口计算，输出严格裁剪到 time_range。
- **predicted 一致性**：同一响应内无跨 `prediction_run_id` 混算。
- **性能**：在目标 SLO 下可稳定运行（含缓存命中策略与超限降级策略）。

---

## 反例（必须禁止）

- **反例 1**：风险计算引擎读取 `payoutRules` 或输出赔付信息（职责污染）。
- **反例 2**：未使用扩展窗口导致起点计算不准确。
- **反例 3**：在 API 路由里直接跑重计算导致请求阻塞/不可控超时。
- **反例 4**：predicted 模式下跨 run 取数或输出未带 run。

