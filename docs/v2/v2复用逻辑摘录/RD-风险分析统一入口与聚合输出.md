## 模块信息

- **模块名**: 风险分析统一入口与聚合输出（Single Source of Truth）
- **Reuse Type**: R1（架构思想复用，v2 责任边界重写）
- **Target Home**: BE（Risk/Statistics Data Products + Compute）+ FE（UI Orchestration + Query Governance）
- **绑定验收锚点**: Data Product / Access Mode / Prediction Run / Perf-SLO / Observability

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/补充-风险计算架构升级方案.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 目标：实现“唯一事实来源”，风险计算从 UI/静态数据中抽离

- v1 指出的问题：
  - 风险计算逻辑分散在 UI 组件与模拟数据中（例如 initialRiskData），导致口径漂移与维护成本高。
- v1 的方向：
  - 建立统一入口（`useRiskAnalysis`）作为风险计算唯一入口；
  - 协调产品规则、天气数据、计算引擎；
  - 输出同时覆盖“地图聚合展示”和“面板详细分级统计”；
  - 扩展数据支持：为窗口起点回溯计算提供扩展数据；
  - 过滤：最终只展示用户窗口内的结果。

### 2) 输出的分层语义（非常重要）

- 地图层需要“按城市聚合的事件总量”（不分级），用于 Marker 视觉反馈。
- 面板层需要“按 Tier 分级的统计 + 事件列表”，用于解释与证据链。
- 天气基础统计与风险事件统计应解耦（单一职责）。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) v2 的“唯一事实来源”必须落在后端（而不是 FE Hook）

- v2 禁止把 CPU/一致性关键逻辑放在 FE：
  - 风险事件识别（尤其是 predicted）必须由 BE 计算并带审计/可追溯；
  - FE 的 Hook 只负责：
    - 统一输入维度（UI Orchestration）；
    - 请求治理（节流/去抖/缓存/并发取消）；
    - 将 BE 的输出映射到 L0/L1/L2 视图。

### 1) 统一输入维度（必须贯穿所有风险相关数据产品）

- `region_code`
- `product_id`
- `time_range`（展示窗口，UTC）
- `data_type`（historical/predicted）
- `weather_type`（如适用/可推导）
- `prediction_run_id`（predicted 必须）
- `access_mode`
- `trace_id/correlation_id`（观测）

> 备注：窗口扩展与对齐规则由 BE 承担，详见 `RD-计算窗口与扩展数据.md` 与 `RD-时间与时区口径统一.md`。

### 2) 统一输出形态：同一请求，返回“多粒度结果”，但语义必须清晰分层

> **本节是风险相关 Data Product 的“输出分层权威定义”**：后续任何模块（地图标记、面板、KPI、AI）若需要引用 L0/L1/L2 的输出结构，应以本节为准，避免重复写导致口径漂移。

为避免 FE 二次口径，风险相关 Data Product 至少需要区分：

- **L0 聚合（地图层）**：
  - `aggregations.by_city.total_event_count`（不分级）；
  - 可选：`severity_hint` 仅用于颜色/大小（必须可解释，且 Mode 下可裁剪）。
- **L1/L2 解释（面板层）**：
  - `statistics.by_tier`（Tier1/2/3 计数/占比/触发阈值说明）；
  - `risk_events[]`（事件列表，严格裁剪到 `time_range`）；
  - `evidence`（可选：对某事件的“为什么触发”解释，受 Access Mode 控制）。

### 3) 职责边界：天气基础统计必须解耦

- 风险计算服务只负责：
  - 根据产品 `riskRules` 识别风险事件；
  - 提供与风险相关的聚合与解释输出。
- 天气统计服务只负责：
  - 基础趋势与指标（sum/avg/max/min 等），不产生“风险事件”。
- UI 组合呈现，但不得让其中一方代替另一方做口径推断。

### 4) Access Mode：后端裁剪为准（FE 不得用隐藏冒充权限）

- Demo/Public：
  - 允许只返回“聚合级”或模糊化后的统计（例如范围、TopN、去标识字段）；
  - L2 证据链可默认不返回或返回摘要。
- Partner/Admin：
  - 允许返回更完整的 tiers、阈值解释、事件细节与证据链。
- 要求：同一请求在不同 Mode 下，**字段级裁剪必须可审计**（日志/指标）。

### 5) Prediction Run 一致性：风险输出必须绑定批次

- predicted 模式下，风险事件/聚合输出必须带 `prediction_run_id`；
- 同一响应内禁止跨 run 混算；
- 回滚/切换 active run 时，风险聚合与天气序列必须同步切换。

### 6) 性能与交互边界（强制）

- hover 不得触发风险重算/重拉（除非是纯缓存命中、且明确为轻量数据产品）。
- 地图 Marker/热力图的数据产品必须可走缓存/预聚合（H3/分桶），并绑定 `access_mode` 与 `prediction_run_id`（如适用）。

### 7) 可观测性（必须能定位“为什么这次结果不同”）

- 每次风险计算/查询必须记录：
  - 输入维度（含 `access_mode`、`prediction_run_id`、`time_range`、`calculation_range`）；
  - 使用的产品规则版本（`product_version` 或 hash，至少能追溯）；
  - 输出裁剪/降级原因（Mode、数据不足、阈值缺失等）。

---

## 关联模块（约束落点）

- **强约束**：`RD-数据面板基础结构.md`（面板只消费 BE 输出，FE 不得做风险识别）
- **强约束**：`RD-风险事件标记图层.md`（L0 聚合来源必须一致，且可缓存）
- **强约束**：`RD-分析汇总卡片.md`（KPI/风险统计的口径不得在 FE 自算）
- **强约束**：`RD-计算窗口与扩展数据.md`（窗口扩展与输出裁剪）

---

## 验收标准（Go/No-Go）

- **唯一事实源**：
  - FE 侧不存在“根据天气序列自行推导风险事件”的逻辑（除纯展示 demo mock 外）。
- **分层输出**：
  - L0（地图）与 L1/L2（面板）的风险口径来自同一后端规则与批次，可追溯一致。
- **Mode 裁剪可审计**：
  - 不同 `access_mode` 返回字段差异可解释且可追踪。
- **predicted 一致性**：
  - 任意一次 predicted 查询都明确绑定 `prediction_run_id`，且无跨 run 混算。

---

## 反例（必须禁止）

- **反例 1**：为了快，在 FE 里用天气序列直接算风险事件（导致跨端不一致、不可审计）。
- **反例 2**：地图层与面板层分别用不同逻辑/不同时间口径生成风险统计（同屏自相矛盾）。
- **反例 3**：用“前端隐藏字段/按钮”冒充权限控制（后端仍返回敏感字段）。
- **反例 4**：predicted 风险事件与天气序列来自不同 `prediction_run_id`，但 UI 仍拼在同一视图中。

