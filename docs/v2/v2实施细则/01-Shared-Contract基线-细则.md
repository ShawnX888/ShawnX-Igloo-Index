# 01 - Shared Contract 基线（维度/DTO/口径）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 01  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Shared Contract 基线（维度/DTO/口径）

---

## 目标 / 非目标

### 目标

- 固化 **v2 统一语言与输入维度**，让 FE/BE/缓存/日志/AI 的“口径与字段名”一致，避免口径漂移。
- 固化 **Data Product（L0/L1/L2/Overlays/AI Insights）** 的最小请求维度与最小响应形态分类（Series/Events/Aggregations + Legend 元信息）。
- 固化 **缓存 key 维度规则**：至少包含 `access_mode`；predicted 场景额外包含 `prediction_run_id`（或 active_run 标识）。
- 固化 **可观测字段规范**：trace_id/correlation_id + 关键维度字段，支撑“为何不一致/为何命中错口径”的排障。

### 非目标

- 不在本细则中定义具体 API 路由（REST path）或数据库表结构细节（由 BE 领域细则承接）。
- 不在本细则中定义 UI 组件结构或交互状态机（由 FE Orchestration/页面细则承接）。
- 不在本细则中引入 v1 文档内容作为依据（仅可通过 Reuse Digest 进入）。

---

## 关联的数据产品（Data Product）

本模块是所有数据产品的“底座契约”，覆盖：

- L0 Dashboard
- L1 Region Intelligence
- L2 Evidence
- Map Overlays
- AI Insights

---

## 输入维度（最小集合）

> 统一维度命名必须与 `docs/v2/v2需求分析.md` 保持一致；任何新增维度必须先更新 Shared Contract，再进入实现。

- `region_scope`（province/district/…）
- `region_code`
- `time_range`
- `data_type`（historical/predicted）
- `weather_type`
- `product_id`（可选）
- `access_mode`（Demo/Public、Partner、Admin/Internal）
- `prediction_run_id`（predicted 必须；historical 必须为空）

---

## 输出形态

> 目的：把“返回什么”从 UI 组件上升为稳定的跨端 DTO 分类，避免同一响应里混杂明细/聚合/图例导致复用困难。

### 输出 DTO 分类（必须统一）

- **Aggregations（聚合）**：KPI/TopN/按区域聚合统计等
- **Series（时间序列）**：时间轴三泳道（Weather/Risk/Claims）及趋势序列
- **Events（事件）**：risk_events、claim_events（若前端需要事件级渲染）
- **Legend / Meta（图例与元信息）**：
  - units（单位）、tiers/thresholds（阈值/分档）、data_type、weather_type、(predicted) prediction_run_id
  - 口径说明字段（必须 Mode-aware）

---

## Mode 规则（必须写）

> 本模块定义“裁剪维度进入缓存 key 与日志”，裁剪策略的细项由 Step 02 细则落地为矩阵。

- **Demo/Public**
  - 输出字段允许被裁剪（尤其金额、明细、内部 id、敏感口径）
  - 仍必须返回足够的“解释闭环”信息（例如区间化/聚合摘要 + 口径说明）
- **Partner**
  - 可返回更细 KPI/排行；明细字段需脱敏（可配置）
- **Admin/Internal**
  - 可返回全量字段与明细（仍需审计）

硬规则：
- **前端隐藏不算权限**：后端必须按 `access_mode` 裁剪输出。

---

## predicted 规则（必须写）

硬规则：
- `data_type='predicted'` 时：请求与响应必须包含 `prediction_run_id`（或由服务端 active_run 解析后在响应中显式回填）。
- 同一请求链路中不得混用不同 prediction_run 的数据（包括 AI 工具调用）。
- 缓存 key 必须包含 `prediction_run_id`（或 active_run 标识）以避免混批次。

---

## 性能与缓存策略

### 缓存 key 维度（强制）

缓存 key 组成至少包含：

- `region_scope`
- `region_code`（或聚合维度的 region_scope + region_set）
- `time_range`
- `data_type`
- `weather_type`
- `product_id`（可选但一旦影响口径必须入 key）
- `access_mode`
- `prediction_run_id`（predicted 必须）

### 节流边界（与契约相关的硬约束）

- Hover 轻交互：**不允许触发 L1/L2 明细重请求**（即使有 endpoint 也不得在 hover 调用）。
- Brush/切换类交互：契约必须允许“可复用缓存”（同维度的不同时间窗组合）并支持服务端/前端节流策略。

---

## 可观测性

### 必带字段（日志/Tracing/埋点）

每次 Data Product 请求/响应（以及 AI tool call）至少携带：

- `trace_id` / `correlation_id`
- `access_mode`
- `region_scope`（如适用）
- `region_code`（如适用）
- `time_range`（如适用）
- `data_type`
- `weather_type`
- `product_id`（如适用）
- `prediction_run_id`（predicted）

### 建议事件命名（用于统一排障口径）

- 前端交互：map_hover、map_lock、pareto_click、time_range_change、timeline_brush、weather_type_toggle、layer_toggle、panel_snap_change、ai_insight_click、ai_cta_click
- 后端数据产品：dp_l0_dashboard_query、dp_l1_region_intelligence_query、dp_l2_evidence_query、dp_overlays_query
- AI：ai_tool_call、ai_intent_proposed、ai_intent_blocked_by_mode、ai_intent_executed

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`

### 来自 v1 的可复用资产（R0/R1）

- 仅复用“分层与契约先行”的思想；任何 v1 字段/接口/实现细节不得直接进入本契约（必须经 Reuse Digest v2 化）。

### 来自 v1 的可复用逻辑（R2）

- 不适用（本模块是跨端契约基线，属于 v2 新增治理对象）。

### 不复用内容（R3）

- 不允许“私有字段先上实现后补文档”的做法（视为高风险，拒绝合入）。

---

## 验收用例（可勾选）

### 一致性（必须）

- [ ] 任意 Data Product 请求都能用同一套维度命名表达（无别名漂移）。
- [ ] `access_mode` 必入缓存 key，predicted 必入 `prediction_run_id`（或等价 active_run 标识）。
- [ ] 响应内存在 Legend/Meta 能明确：单位/阈值/tiers/data_type（predicted 额外含 run_id）。

### 可观测（必须）

- [ ] 日志/Tracing 中能用 trace_id 串起：ui_intent → dp_request → dp_response → ui_render_done。
- [ ] 可以通过日志直接判断“是否混批次/是否命中错口径缓存”（含关键维度字段）。

---

## 风险与回滚策略

### 风险

- 契约字段命名不统一导致：缓存误命中、AI/前端解释断裂、排障困难。
- 缓存 key 漏维度导致：Mode 串数据、predicted 混批次。

### 回滚策略

- 对外契约变更必须版本化（至少在文档层 + DTO 层），允许短期双写/兼容。
- 一旦发现“错口径缓存”，优先回滚到“禁用该类缓存/强制带齐维度”的策略，而非临时在前端补丁绕过。

