# Reuse Digest — 数据面板基础结构（数据流与联动框架）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + BE + Shared Contract  
> 绑定验收锚点：L1/L2、Overlays、Access Mode、Prediction Run、Perf/SLO、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/18-数据面板基础结构.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 面板布局（信息分区）
数据面板分为三块（v1 的结构化分区可复用）：
- 分析汇总区域（KPI 卡片）
- 图表区域（趋势/叠加示意）
- 风险事件时间线区域（事件追溯）

### 2.2 “计算上移、视图下沉”的数据流思想
v1 强调：核心计算应在顶层（Dashboard + Hooks）完成，DataDashboard 组件只负责展示与轻交互：
- 上游产出：
  - riskEvents（明细事件）
  - statistics（聚合统计）
  - weatherStatistics（天气基础统计）
  - 原始气象数据（dailyData 等）
- 下游展示：
  - AnalysisSummary（只渲染）
  - ChartsSection（只渲染）
  - RiskEventsTimeline（只渲染）

### 2.3 联动机制（声明式更新）
参数变化（selectedRegion/dataType/dateRange/selectedProduct）→ 顶层重新计算 → props 下发 → 面板自动刷新。
这条“单向数据流 + 声明式刷新”的思想可复用。

---

## 3. v2 化适配（必须写清楚）

### 3.1 从“前端计算上移”升级为“数据产品消费”
v2 不能把前端作为计算事实源，必须改为：
- Data Panel 消费后端 Data Products：
  - L1 Region Intelligence（时间序列 + 轻量聚合）
  - L2 Evidence（明细/半明细 + 关联，按需）
  -（必要时）Overlays / L0 的一部分摘要（供面板提示）
- 前端只做：
  - UI Orchestration（事件→状态→触发查询）
  - 渲染与轻交互状态（tab、折叠、视图切换）

### 3.2 统一输入维度（Shared Contract）
Data Panel 的任何查询必须遵循 Shared Contract 的“输入维度集合”（见 `RD-共享类型与接口契约.md`），并且：
- predicted 场景必须绑定 `prediction_run_id`（或由 active_run 解析后注入）
- 时间口径（UTC/region_tz/display）与窗口口径（time_range vs calculation_range）不得在面板侧自行推断（分别见 `RD-时间与时区口径统一.md`、`RD-计算窗口与扩展数据.md`）

### 3.3 Access Mode 与 L2 的默认策略
v2 必须把“默认展开/默认不取明细”写死：
- Demo/Public：L2 默认不加载或仅摘要；敏感字段由后端裁剪
- Partner/Admin：允许更深下钻（但仍需脱敏/审计）

### 3.4 predicted 批次一致性
- predicted 场景下，L1/L2 请求必须绑定 prediction_run_id（或 active_run 解析后注入）。
- 缓存 key 维度规则以 `RD-性能优化.md` 为准（至少包含 `access_mode`；predicted 额外包含 `prediction_run_id`）。

### 3.5 性能与请求治理
- L2 默认按需加载，避免首屏拉全量明细。
- brush/切产品等高频动作必须节流。
- 面板展开（Peek/Half/Full）不应触发额外数据（除非进入 L2 明细区并显式需要）。

### 3.6 可观测性
至少记录：
- panel_open（snap_point）、panel_section_nav
- dp_l1_query / dp_l2_query（是否命中缓存、耗时）
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 面板三分区结构清晰：汇总/图表/时间线（或等价的 v2 L1/L2 面板结构）。
- [ ] 参数变化后面板刷新稳定（无卡顿、无请求风暴），L2 明细按需加载。
- [ ] Demo/Public 下默认不拉 L2 明细或只拉摘要；Partner/Admin 下按策略允许下钻且后端裁剪生效。
- [ ] predicted 场景不混批次：同一面板刷新链路数据来自同一 prediction_run。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：Data Panel 内部自行对明细做重聚合/重计算（应由数据产品提供）。
- [ ] 禁止：面板一展开就拉全量 L2 明细（必须按需）。
- [ ] 禁止：predicted 缓存 key 缺 prediction_run_id 导致展示混批次。

---

## 5. 未决问题（Open Questions）
- Q1：v2 的 Data Panel 与 Region Intelligence Panel 是否合并为同一组件体系（Bottom Sheet），还是保留“页面下方面板”？需由 v2 页面设计最终定稿。

