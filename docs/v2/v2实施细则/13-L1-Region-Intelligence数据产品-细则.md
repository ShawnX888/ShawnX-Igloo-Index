# 13 - L1 Region Intelligence Data Product（区域情报）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 13  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

L1 Region Intelligence Data Product（区域情报：Overview + 趋势 + Timeline 三泳道）

---

## 目标 / 非目标

### 目标

- 提供 L1“可解释”的后端权威数据产品输出，支撑 Region Intelligence Panel：
  - Overview：概览 KPI（少而强）
  - Timeline：Weather / Risk / Claims 三泳道在同一时间轴对齐（UTC）
  - Correlation：可选（默认折叠；MVP 可先只返回所需最小数据）
- 支撑高频交互刷选（区域/时间/天气/产品），强调**稳定与可复用**：
  - p95 < 1.5s（冷/热混合）
  - 缓存可复用（按维度）
- 明确轻/重交互边界：
  - hover 不触发 L1 请求
  - lock/CTA 才触发 L1（以及按需触发 L2）
- Mode-aware：Demo 下裁剪/摘要，Partner 脱敏，Admin 全量。

### 非目标

- 不输出 L2 明细证据链（由 L2 Evidence Data Product 提供）。
- 不在 L1 预取所有 L2（默认按需加载，避免请求风暴）。

---

## 关联的数据产品（Data Product）

本模块本身就是 Data Product：**L1 Region Intelligence**。

同时为以下模块提供输入：

- AI Insights（AI Insight 证据点与 CTA 引导）
- Map Overlays（当 Timeline brush 需要同步 overlays 时）

---

## 输入维度（最小集合）

来自 Shared Contract 的强制维度：

- `region_scope`（通常 district）
- `region_code`
- `time_range`
- `data_type`（historical/predicted）
- `weather_type`
- `product_id`（可选；风险泳道与阈值解释通常需要）
- `access_mode`
- `prediction_run_id`（predicted 必须；或由 active_run 解析并回填）

服务端内部需要：

- `region_timezone`（用于“自然日/月边界”解释与窗口对齐；见 Step 04）
- （可选）`calculation_range`（扩展窗口，仅用于计算）

---

## 输出形态

> 统一输出分类：Aggregations + Series + Events + Legend/Meta。

### 1) Overview（Aggregations）

建议最小集合（可按 Mode 裁剪）：

- policies：policy_count / coverage_amount_sum（可选）
- risk：risk_event_count（按 tier 分组）
- claims：claim_count / payout_amount_sum（Mode-aware：Demo 可区间化或只给强弱/比例）

> 强制口径（Phase 1/2）：claims 域尚未落地（Step 30 在 Phase 3），因此 L1 的 claims KPI/series/events 必须以“可见但不可用（disabled/placeholder）”返回，并在 meta 中显式声明 `claims_available=false`（字段名最终以 Shared Contract 为准）。禁止用 risk_events 或任何前端/后端推断结果伪造 claims 事实。

### 2) Timeline（三泳道，Series）

同一 UTC 时间轴：

- Weather series（unit + weather_type）
- Risk series（与产品 riskRules 对齐：rolling window 聚合结果 + thresholds/tiers）
- Claims series（建议用点状/柱状序列的聚合输入；明细点位属于 L2）

### 3) Events（可选）

用于 marker/highlight：

- risk_events（event_time_utc、tier、value、threshold、rules_hash）
- claims_events（若 L1 允许展示事件级摘要，仍需 Mode-aware）

### 4) Legend/Meta（强制）

必须包含：

- `time_range`（UTC）
- `region_timezone`
- `data_type`
- `weather_type`
- `product_id`（如适用）
- `access_mode`
- `prediction_run_id`（predicted）
- 风险阈值/tiers/unit/窗口口径（解释闭环所需）
 - **claims 可用性（强制）**：
   - `claims_available`（bool，字段名最终以 Shared Contract 为准）
   - `claims_unavailable_reason`（string，建议：`not_implemented_until_phase_3`）
   - `claims_series_status`（建议：`disabled|placeholder|ready`）

---

## Mode 规则（必须写）

### Demo/Public

- L1 必须可解释但不暴露敏感明细：
  - claims/policies 金额类 KPI 建议区间化/范围化
  - events 明细默认不下发或仅摘要
  - Correlation 默认折叠或不返回细粒度散点
 - 当 `claims_available=false`：
   - claims 相关 KPI/series 必须以 “N/A / disabled” 呈现；tooltip 解释原因；不得出现“空白但可点”的误导交互。

### Partner

- 可返回更多 KPI/趋势维度；事件字段脱敏（可配置）。

### Admin/Internal

- 可返回更全字段与更细粒度（仍需审计）。

硬规则：
- **后端强裁剪**（失败模式 A）。

---

## predicted 规则（必须写）

- predicted L1 必须绑定 `prediction_run_id`（或由 active_run 解析并回填）。
- Timeline 三泳道必须同批次（Weather/Risk/Claims 的 predicted 输入不得跨 run）。
- 缓存 key 必含 `prediction_run_id`，避免混批次（失败模式 B）。
 - predicted 与 claims 可用性必须正交：`claims_available=false` 时，不得输出 claims 结论、不得触发任何 claims 下钻意图。

---

## 性能与缓存策略

### SLO（需求级）

- L1：p95 < 1.5s（稳定优先）
- 高频交互需节流、防抖、可缓存

### 缓存 key（强制）

至少包含：

- `region_scope`、`region_code`
- `time_range`
- `data_type`
- `weather_type`
- `product_id`（如适用）
- `access_mode`
- `prediction_run_id`（predicted）

### 交互触发边界（必须）

- Hover：不得触发 L1 请求（0 重请求）
- Lock/Pareto click：允许触发 L1 最小集
- Brush：高频交互必须节流；尽量复用缓存（避免每像素一次请求）

---

## 可观测性

必须记录：

- `trace_id/correlation_id`
- `access_mode`
- `region_scope/region_code`
- `time_range`（与 calculation_range 若有）
- `region_timezone`
- `data_type` / `weather_type` / `product_id`
- `prediction_run_id`（predicted）
- 缓存命中/失效原因、数据量级（点数/事件数）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-风险分析统一入口与聚合输出.md`
- `docs/v2/v2复用逻辑摘录/RD-图表可视化.md`
- `docs/v2/v2复用逻辑摘录/RD-计算窗口与扩展数据.md`
- `docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`

### 来自 v1 的可复用资产（R0/R1）

- 可复用“统一时间轴三泳道对齐”的展示思想，但 v2 必须由后端输出对齐后的 Series/Meta，前端只渲染。

### 来自 v1 的可复用逻辑（R2）

- 风险曲线的窗口计算逻辑复用（经 Risk Calculator 实现），但 L1 输出必须裁剪到 time_range 且含解释 meta。

### 不复用内容（R3）

- 不复用“前端自行对齐 Weather/Risk/Claims 时间轴并做重计算”的路径（易产生口径漂移与掉帧）。

---

## 验收用例（可勾选）

### 功能闭环（必须）

- [ ] L1 Overview + Timeline 输出可用：Weather/Risk 泳道可用；Claims 泳道允许 disabled/placeholder（Phase 1/2），但必须可解释且不误导。
- [ ] Pareto click / lock region 触发 L1 最小集加载（hover 不触发）。

### 一致性闭环（必须）

- [ ] 同一筛选条件下，L0 KPI、L1 汇总、L2 摘要（当打开）不矛盾。
- [ ] Risk 泳道阈值/tiers/unit 与产品 riskRules 一致，且可追溯 rules_hash/version。

### 性能闭环（必须）

- [ ] L1 交互刷新 p95 < 1.5s（以日志/压测证明）。
- [ ] Brush/切换无请求风暴（节流生效）。

### Mode / 批次闭环（必须）

- [ ] Demo/Public 下敏感金额/明细被裁剪或区间化。
- [ ] predicted 下不混批次（响应显式带 run_id，三泳道同批次）。
 - [ ] 当 `claims_available=false`：响应 meta 明确声明不可用原因；前端/AI 不得伪造 claims 事实。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo/Public 抓包仍能拿到 claims/policies 明细或精确金额。  
硬规则：**BE 强裁剪**（字段/粒度）+ 一致越权响应 + 审计。

### 失败模式 B：predicted 混批次

症状：Timeline 的 Weather/Risk 来自不同 prediction_run_id，或与页面 active_run 不一致，解释断裂。  
硬规则：prediction_run_id/active_run 全链路一致；cache key 必含批次；响应显式回填 run_id。

---

## 风险与回滚策略

### 风险

- L1 未做缓存复用与节流 → 高频交互抖动/掉帧（P0/P1）。
- L1 输出缺少 legend/meta → 无法解释“为什么触发”，AI/面板解释断裂（P0）。

### 回滚策略

- 性能不达标：先降级输出（减少序列密度、关闭 Correlation/Events），并增强缓存/预聚合。
- 若发现错口径/泄露：立即收紧 Mode 裁剪策略版本，必要时禁用 L2 下钻入口以止血。

