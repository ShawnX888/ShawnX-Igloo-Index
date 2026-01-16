# Reuse Digest — 图表可视化（趋势图 / 风险叠加 / 事件时间线）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + BE + Shared Contract  
> 绑定验收锚点：L1/L2（解释闭环）、Overlays、Access Mode、Prediction Run、Perf/SLO、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/20-图表可视化.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 三类图表构成（结构可复用）
v1 图表区域包含三块：
1) 天气数值柱状图（hourly/daily 可切换）
2) 天气数据 + 风险叠加示意图（仅选产品时显示，叠加 thresholds）
3) 风险事件触发时间线（仅选产品时显示）

### 2.2 视图切换（hourly/daily）与产品类型联动
- 默认 daily view，但允许手动切换到 hourly。
- 选中日内产品时自动切换到 hourly；周度/月度产品自动切换到 daily。

### 2.3 “两类窗口”的关键概念区分（v1 最容易丢失的逻辑）
v1 强调必须区分：
- **时间窗口（Time Range）**：用户在 Map Settings 中选择的 dateRange（决定图表显示区间）
- **数据计算窗口（Calculation Window）**：产品 riskRules.timeWindow.size 定义的回溯窗口（决定每个数据点纵轴值如何计算）

### 2.4 风险叠加图的纵轴值计算（核心可复用逻辑）
对图表上每个点（t 或 d）：
- 回溯取 `[t - size, ..., t]` 或 `[d - size, ..., d]` 的基础天气数据
- 按 riskRules.calculation.aggregation（sum/avg 等）计算累计值
- 用 riskRules.thresholds 生成阈值参考线（阶梯线/参考线）
- 用 riskEvents 在图上打点并按 tier 分级着色

### 2.5 扩展数据获取（为了解决窗口起点缺数据）
v1 提出：需要先获取扩展时间范围的数据（useExtendedWeatherData），确保时间窗口起始位置也能正确回溯计算纵轴值，然后再过滤回用户 time_range 显示。

### 2.6 风险事件时间线展示策略
时间线只展示核心事件信息（时间戳、级别、类型、描述），产品/区域/天气类型等元信息不重复展示（已在汇总卡片展示）。

---

## 3. v2 化适配（必须写清楚）

### 3.1 图表的数据来源必须“后端数据产品化”
v2 不再依赖前端 hooks 做事实计算：
- L1 Region Intelligence 数据产品应提供：
  - Weather 序列（hourly/daily 或可切换粒度）
  - Risk 序列（用于叠加图的计算结果或必要的中间量）
  - Claims 序列（v2 新增泳道）
  - thresholds/units/legend 元信息（用于解释）
- L2 Evidence 数据产品提供：
  - 事件明细/关联（按需加载）

> v1 的“计算窗口回溯逻辑”仍可复用为算法要求，但应迁到 BE compute 层（或数据产品层）完成。

### 3.2 Calculation Window 与 Time Range 的契约化
v2 必须把这两个窗口写入契约与验收，避免后续 agent 误实现：
- time_range：用户选择，决定显示区间
- calculation_window：来自产品 riskRules（并受时区/数据粒度影响），决定计算纵轴值
- 若后端返回的是“已计算后的序列”，也必须在 legend/metadata 中说明 calculation_window 参数（否则不可解释）

### 3.3 predicted 批次一致性（强制）
- predicted 图表序列必须绑定 prediction_run_id（或 active_run 解析），并与地图 overlays / KPI / AI 一致。
- 缓存 key 维度规则以 `RD-性能优化.md` 为准（至少包含 `access_mode`；predicted 额外包含 `prediction_run_id`）。

### 3.4 Access Mode 与 L2 明细的默认策略
- Demo/Public：L2 默认不加载或仅摘要；图表不应暴露可逆推明细的敏感信息。
- Partner/Admin：允许更深下钻，但字段脱敏/审计必须生效。

### 3.5 性能与交互治理
- brush/hover/缩放等高频交互必须节流，避免请求风暴。
- 图表渲染需做采样/虚拟化（当数据点很多）。

### 3.6 可观测性
至少记录：
- chart_view_mode_change（hourly/daily）
- timeline_brush（range）
- dp_l1_query / dp_l2_query（命中/耗时）
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 图表三块可用：趋势图、风险叠加图、事件时间线（选产品后出现后两者）。
- [ ] viewMode 自动切换规则正确：日内→hourly；周/月→daily；且允许手动切换（按产品能力限制）。
- [ ] 风险叠加图的“Time Range vs Calculation Window”口径正确：窗口起点计算不丢失（有扩展数据或后端已正确计算）。
- [ ] predicted 场景不混批次：切 active_run 后图表与 legend 同步刷新。
- [ ] Demo/Public 下不暴露敏感明细；L2 需显式动作才加载。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：把 time_range 当成 calculation_window（导致纵轴值错误，尤其窗口起点）。
- [ ] 禁止：predicted 图表未绑定 prediction_run_id 仍命中缓存并展示。
- [ ] 禁止：刷选/缩放导致每次交互都触发 L2 明细查询。

---

## 5. 未决问题（Open Questions）
- Q1：v2 的风险叠加图是由 BE 返回“已计算序列”，还是返回基础序列 + 前端计算？（建议：BE 返回已计算序列，保证一致性与可测性）

