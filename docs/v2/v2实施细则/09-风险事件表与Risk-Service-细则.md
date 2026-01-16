# 09 - 风险事件表 + Risk Service（risk_events）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 09  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

风险事件表（`risk_events`）+ Risk Service（风险事件权威源：持久化/查询/裁剪/批次一致性）

---

## 目标 / 非目标

### 目标

- 将 v1 的前端风险事件计算结果升级为 v2 的**可审计事实**：
  - risk_events 持久化（historical/predicted 分流）
  - predicted 版本化（prediction_run_id/active_run）
  - 可追溯规则版本（rules_hash/product_version）
- 在服务层闭环三大系统性风险控制：
  - 口径漂移（后端唯一事实源）
  - 权限旁路（Mode 裁剪）
  - 预测混批次（run_id 一致性）
- 为数据产品层提供稳定输入：
  - L1 Timeline（Risk 泳道 series + 事件 markers）
  - L2 Evidence（事件明细 + 解释 meta）
  - Overlays（地图聚合输入与 legend）

### 非目标

- Risk Service 不生成 claims（赔付计算属于 Claim Service/Claim Calculator）。
- 不在本细则中实现 L0/L1/L2/Overlays 的“数据产品聚合查询”全量逻辑（它们会复用 Risk Service，但各自有独立的数据产品细则）。

---

## 关联的数据产品（Data Product）

- L1 Region Intelligence：Risk 泳道（Series/Events）
- L2 Evidence：风险事件明细（Events）
- Map Overlays：Risk overlays（Aggregations + Legend）
- AI Insights：洞察证据点（Events/Aggregations）

---

## 输入维度（最小集合）

> Risk Service 对外遵循 Shared Contract；对内与 Risk Calculator、Weather Service、Product Service 协作。

- `region_scope` / `region_code`
- `time_range`（UTC；展示窗）
- `data_type`（historical/predicted）
- `weather_type`（可从产品推导，但最终必须显式记录）
- `product_id`
- `access_mode`
- `prediction_run_id`（predicted 必须；或由 active_run 解析后显式回填）

（内部计算场景额外）：
- `calculation_range`（UTC；扩展计算窗）
- `region_timezone`
- `rules_hash/product_version`

---

## 输出形态

### 1) RiskEvent（事件输出）

至少包含：

- `event_time_utc`
- `region_code`
- `product_id`
- `weather_type`
- `data_type`
- `prediction_run_id`（predicted 必须）
- `level`（tier1/tier2/tier3）
- `value`（触发聚合值）
- `threshold_value`
- `rules_hash`/`product_version`

### 2) 聚合与解释 Meta（供数据产品/前端）

- 事件计数（按 tier 分组）
- 阈值/单位/窗口口径（legend/meta）
- 裁剪说明（mode-aware）

---

## Mode 规则（必须写）

RiskEvent 的字段本身通常不含 PII，但仍必须 Mode-aware（尤其是与 claims 关联时的下钻能力）：

### Demo/Public

- 允许事件级展示（用于解释），但对“可下钻到 L2 明细”的能力进行限制：
  - L2 证据链可只给摘要或禁用（由数据产品层决策）
- 若 risk_event 包含任何内部字段（如内部 id），必须裁剪。

### Partner / Admin

- 允许更细字段与更深下钻（仍必须审计）。

硬规则：
- **后端裁剪**：前端隐藏不算权限。

---

## predicted 规则（必须写）

### 规则 1：predicted 必须绑定 prediction_run_id（强制）

- 请求 predicted：必须提供 run_id，或服务端解析 active_run 并在响应中显式回填 run_id。
- 查询/聚合/返回不得跨 run。

### 规则 2：risk_events 唯一约束（建议）

根据 `docs/v2/v2架构升级-全栈方案.md`：

- historical 唯一性：同一 product、region、timestamp、weather_type、tier_level 只能有一条
- predicted 唯一性：额外包含 prediction_run_id

### 规则 3：回滚与保留

- predicted 不覆盖旧批次；通过切换 active_run 实现回滚（见 Step 03）。

---

## 性能与缓存策略

### L0/L1/Overlays 的性能边界（与 Risk Service 的关系）

Risk Service 必须能支撑：

- L1 高频交互刷新（p95 < 1.5s 目标由数据产品层负责，但 Risk Service 需可缓存可复用）
- Overlays 强缓存（命中 p95 < 800ms）

### 缓存 key（强制）

Risk 查询/聚合缓存 key 必含：

- `access_mode`
- `region_scope` / `region_code`
- `time_range`
- `data_type`
- `weather_type`
- `product_id`
- predicted 额外含 `prediction_run_id`

### Hover 红线（与 Risk Service 的协作要求）

Risk Service 必须支持“轻量 tooltip 所需的最小聚合结果”可从 Overlays/L0/L1 缓存命中获得，避免 hover 触发明细查询。

---

## 可观测性

Risk Service 必须记录：

- 关键维度：trace_id/correlation_id、region_code、time_range、data_type、weather_type、product_id、access_mode、prediction_run_id
- 产品规则版本：rules_hash/product_version
- 计算耗时与数据量级（点数、窗口跨度）
- 缓存命中/失效原因（尤其 active_run 切换、mode_policy_version 变更）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-风险计算引擎核心与策略.md`
- `docs/v2/v2复用逻辑摘录/RD-风险分析统一入口与聚合输出.md`
- `docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md`
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`

### 来自 v1 的可复用资产（R0/R1）

- 可复用“风险事件字段与阈值解释”的展示思路，但 v2 必须把事件持久化并纳入批次/Mode/审计闭环。

### 来自 v1 的可复用逻辑（R2）

- 风险事件识别算法逻辑可复用（通过 Step 08 Risk Calculator 实现），但服务层必须负责取数/对齐/裁剪/批次一致性。

### 不复用内容（R3）

- 不复用“前端计算并直接驱动 UI 作为事实源”的链路。

---

## 验收用例（可勾选）

### 一致性与批次（必须）

- [ ] historical risk_event 不包含 prediction_run_id，predicted risk_event 必包含 prediction_run_id。
- [ ] predicted 模式下同一请求链路不出现跨 run 的 risk_events。
- [ ] active_run 切换后不会复用旧批次缓存。

### 口径一致性（必须）

- [ ] 同一筛选条件下，Risk overlays（聚合）与 L1 Timeline（序列）不矛盾。
- [ ] risk_event 可追溯到产品规则版本（rules_hash/product_version）。

### Mode（必须）

- [ ] Demo/Public 下不会返回被策略禁止的内部字段，且 L2 下钻能力按 Mode 限制。

---

## 风险与回滚策略

### 风险

- 失败模式 A：后端未裁剪，Demo 能拿到不应暴露字段（P0）。
- 失败模式 B：predicted 混批次（P0）。
- 未记录规则版本 → 解释漂移（P0/P1）。

### 回滚策略

- predicted：切换 active_run 回滚并失效缓存（与 Step 03 一致）。
- 风险事件计算口径错误：回滚产品规则版本或禁用产品（is_active=false），并支持重算与差异核对。

