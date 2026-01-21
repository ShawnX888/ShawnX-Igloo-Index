# Reuse Digest — 分析汇总卡片（KPI 汇总）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + BE + Shared Contract  
> 绑定验收锚点：L0/L1（KPI 口径一致）、Access Mode、Prediction Run、Perf/SLO、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/19-分析汇总卡片.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 卡片内容与条件显示规则
v1 的“少而强”卡片规则可复用：
- 时间窗口（天数 + 小时）
- 平均天气数值（按产品类型决定 hourly/daily 口径）
- 总天气数值
- 风险事件数量（仅在选中产品时显示）
- 风险严重程度（仅在选中产品时显示）

### 2.2 时间窗口计算口径
- 时间窗口展示为 `X Days Y Hours`（或等价格式）。
- 基于 dateRange 的起止日期与起止小时计算得出（包括 totalHours 的隐含概念）。

### 2.3 平均值口径随产品类型切换
- 日内产品：展示 avg hourly value
- 周度/月度产品：展示 avg daily value
该逻辑本质是“展示口径跟随产品计算粒度”，可复用。

### 2.4 风险严重程度（severity）口径
v1 定义 severity 来自风险事件最高等级（tier3>tier2>tier1；无事件为 none/-）。

---

## 3. v2 化适配（必须写清楚）

### 3.1 从“v1 面板卡片”升级为 L0/L1 的 KPI 输出契约
v2 的卡片不再来自前端 hook 计算，而来自数据产品（或数据产品输出的一部分）：
- L0：省级态势 KPI（金额口径为主；Top 导航由 Pareto 承接）
- L1：选区概览 KPI（解释口径）

### 3.2 统一维度（Shared Contract）
任何 KPI 卡片都必须绑定维度：
- region_scope / region_code
- time_range
- data_type（historical/predicted）
- weather_type
- product_id（可选；风险相关 KPI 通常需要）
- access_mode
- prediction_run_id（predicted）

### 3.3 Access Mode：同一 IA 的“信息密度分级”
卡片是最容易泄露敏感口径的位置，必须 Mode-aware：
- Demo/Public：
  - 数字可范围化/区间化（尤其是金额类/敏感口径）
  - 默认不展示 L2 明细导向
- Partner：
  - 可展示更细 KPI，但明细仍需字段脱敏
- Admin/Internal：
  - 全量口径（但要审计）

### 3.4 predicted 的口径一致性
- predicted KPI 必须携带 prediction_run_id（或由 active_run 解析），并与页面其他部分一致。
- 缓存 key 维度规则以 `RD-性能优化.md` 为准（至少包含 `access_mode`；predicted 额外包含 `prediction_run_id`），避免“命中即错口径”。

### 3.5 可观测性
至少记录：
- kpi_render_done（card_ids、region_scope）
- dp_l0_query / dp_l1_query（命中/耗时）
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 时间窗口显示正确（天/小时），与 time_range 一致且可解释。
- [ ] 平均值展示口径随产品类型变化（或随产品的 timeWindow/type 映射的粒度变化）。
- [ ] 未选产品时不展示风险事件相关 KPI（或展示为禁用/提示）；选中产品后展示并与图层/时间线一致。
- [ ] Demo/Public 下敏感 KPI 以范围化/隐藏策略呈现，且后端裁剪可验证。
- [ ] predicted 场景 KPI 与页面 prediction_run 一致，不混批次。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：在 Demo/Public 下通过 KPI 卡片暴露可逆推的敏感口径（例如精确金额/明细计数）。
- [ ] 禁止：predicted KPI 未携带 prediction_run_id 仍命中缓存并展示。

---

## 5. 未决问题（Open Questions）
- Q1：v2 的 KPI 卡片是否需要区分“省级背书（L0）”与“选区概览（L1）”两套不同卡片集合？（建议：两套，且默认展示最小背书集）

