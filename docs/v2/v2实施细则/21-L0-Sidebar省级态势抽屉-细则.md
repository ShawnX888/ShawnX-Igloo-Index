# 21 - L0 Sidebar（省级态势抽屉）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 21  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

L0 Sidebar（省级态势播报台）：3 Tab（Combined / Policies / Claims）+ KPI（3–5）+ Top5 排名（Ranking Click 导航）

---

## 目标 / 非目标

### 目标

- 提供“10 秒内一眼看到态势”的 L0 体验（与 `v2项目总览.md` 口径一致）：
  - 三个 Tab：Combined / Policies / Claims
  - 每 Tab：3–5 KPI + Top5 排名（可选 tiny trend）
  - Ranking Click → Map fly-to + lock region（排行榜即导航）
- 把 L0 从“UI 卡片”升级为“数据产品消费”：
  - 数据来源必须是后端 `L0 Dashboard Data Product`（Step 11）
  - 前端不做明细聚合
- 严格执行 v2 红线：
  - hover 不触发重请求（L0 侧 hover 仅 tooltip）
  - access_mode 影响展示口径与字段粒度（后端裁剪；前端降级 UX）
  - predicted 不混批次（batch 由 prediction_run_id/active_run 锁定）

### 非目标

- 不在本细则实现 AI Insight Cards（后续 Step 39）。
- 不在本细则实现 L1/L2 面板（后续 Step 26+）。

---

## 关联的数据产品（Data Product）

直接消费：

- L0 Dashboard Data Product（Step 11）

间接联动：

- Map Stage（Step 18）：Ranking click → map lock
- L1 Region Intelligence（Step 13）：锁区后触发 L1 最小集刷新（由 Orchestration 决策）

---

## 输入维度（最小集合）

> 维度命名必须与 Shared Contract 一致。

L0 请求维度（最小）：

- `region_scope=province`（固定）
- `time_range`
- `data_type`
- `weather_type`（可选：若口径随天气类型变化）
- `access_mode`
- predicted：`prediction_run_id`（或 active_run 解析后回填并锁定）

---

## 输出形态

### UI 输出

- 左侧栏（态势播报台）
  - Tab 切换
  - KPI 卡片（含单位/口径提示）
  - Top5 排名（条形/列表均可，但必须可点击）
  - “当前口径 meta”：data_type /（predicted）prediction_run_id / access_mode（可在 tooltip 或次级信息展示）

### 交互输出（给 UI Orchestration）

- `l0_tab_change(tab_id)`
- `l0_ranking_click(region_code)`（触发 Map lock）

---

## Mode 规则（必须写）

### 后端裁剪（强制前提）

- Demo/Public：金额等敏感口径可范围化/隐藏；Top5 可展示相对强弱或区间
- Partner：更细粒度，但仍可字段级脱敏
- Admin/Internal：全量口径

### 前端呈现策略

- 被裁剪字段必须有“可解释呈现”：
  - lock 图标/tooltip 说明（而不是直接消失导致演示断流）

---

## predicted 规则（必须写）

- `data_type=predicted` 时：
  - L0 请求必须绑定 `prediction_run_id`（或 active_run 解析后回填）
  - L0 的 meta 必须能表达“当前预测批次”（避免用户误以为是实时唯一结果）
- 禁止同屏混批次：L0 与 Overlays/L1 必须一致（由 Orchestration 锁定）

---

## 性能与缓存策略

### SLO（建议门槛）

- 缓存命中：p95 < 500ms（以 `v2需求分析.md` 的建议门槛为准）

### 请求治理

- L0 本身属于高频背书：必须强缓存/预聚合（后端负责）
- 前端：
  - tab switch 只触发 L0 dp 请求（或复用缓存），不得联动触发 L2
  - hover 只做 tooltip，不触发 dp 请求

---

## 可观测性

必须记录：

- `l0_tab_change`
- `l0_ranking_click`
- `dp_l0_query`（耗时/缓存命中）
- `map_lock`（由 Map Stage 输出，串联 trace）

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `time_range/data_type/weather_type`
- predicted：`prediction_run_id`
- `tab_id`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（L0 强缓存/高频治理）
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`（维度命名一致）

> 说明：L0 Sidebar 属于 v2 新的“数据产品化”呈现形态，v1 仅有概念性卡片与 mock 聚合，v2 不复用 v1 具体实现。

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] 三 Tab 可切换，KPI 与 Top5 正确展示（来自 L0 Data Product）。
- [ ] Ranking Click 能驱动 Map fly-to + lock region（并触发 L1 最小集刷新，若策略允许）。

### 红线（必须）

- [ ] hover 0 重请求；tab switch 不触发 L2；高频交互无请求风暴。
- [ ] Demo/Public 下抓包无法拿到敏感明细（后端裁剪可验证）。
- [ ] predicted 不混批次（同屏一致 prediction_run_id）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 模式下 API 仍返回敏感字段，前端只是没展示。  
硬规则：后端强裁剪；前端仅做“可见但不可用/范围化”呈现。

### 失败模式 B：predicted 混批次

症状：L0 显示的是 run A，但地图 overlays/L1 用 run B。  
硬规则：prediction_run_id 顶层锁定；query key 必含 run_id；meta 显示批次。

---

## 风险与回滚策略

### 风险

- L0 依赖明细聚合 → 性能崩（P0）。
- Mode 裁剪与 UI 不一致 → 演示断流/误导（P0/P1）。

### 回滚策略

- 若性能不达标：先收敛 KPI/Top5 数量与刷新频率，并依赖强缓存结果。
- 若 Mode 断流：提供范围化/区间化展示与 tooltip 解释，保持叙事闭环。

