# 26 - Region Intelligence Panel 基础结构（Bottom Sheet）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 26  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Region Intelligence Panel（区域情报面板 / Bottom Sheet）基础结构：Peek/Half/Full snap + sections（Overview/Timeline/Correlation/Details）+ 与 Map Stage 联动

---

## 目标 / 非目标

### 目标

- 落地 v2 的“地图主舞台 + 情报面板”信息架构：
  - Map 始终可用（面板展开不拖垮地图交互）
  - 面板支持 Peek/Half/Full 三档 snap point（与 v2 状态机 S0–S3 对齐）
- 固化面板结构与导航（section）：
  - Overview（KPI 汇总）
  - Timeline（三泳道）
  - Correlation（默认折叠/可选）
  - Details（L2 明细入口，Mode-aware，默认按需）
- 数据流 v2 化：面板只消费数据产品，不在面板内部做重计算：
  - L1 Region Intelligence Data Product（Step 13）
  - L2 Evidence Data Product（后续 Step 33/35；本步只留接口与触发约束）
- 联动边界写死（避免交互风暴）：
  - hover 不触发 L1/L2
  - click lock / ranking click：允许触发 L1 最小集，但默认不自动打开到 Full
  - AI Insight click / CTA：允许打开到 Half/Full 并定位 section；L2 仅在明确动作下加载

### 非目标

- 不在本细则实现 Timeline 的具体渲染（Step 27/28）。
- 不在本细则实现 L2 明细内容（Step 35）。

---

## 关联的数据产品（Data Product）

直接消费：

- L1 Region Intelligence Data Product（Step 13）

按需消费（后续）：

- L2 Evidence Data Product（Step 33）

---

## 输入维度（最小集合）

> 维度命名必须与 Shared Contract 一致。

- `region_scope` / `region_code`
- `time_range`
- `data_type`
- `weather_type`
- `product_id`（可选；Timeline Risk 泳道通常需要）
- `access_mode`
- predicted：`prediction_run_id`

面板内部 UI 状态（可序列化/可观测）：

- `panel_snap`：collapsed/peek/half/full
- `panel_section`：overview/timeline/correlation/details

---

## 输出形态

### UI 输出

- Bottom Sheet 容器（Peek/Half/Full）
- Section 导航（tabs/sticky nav 均可）
- 加载/空态/错误态（必须明确且可解释）

### 事件输出（给 UI Orchestration）

- `panel_open(snap, section)`
- `panel_close()`
- `panel_snap_change(from,to)`
- `panel_section_nav(to_section)`

---

## Mode 规则（必须写）

- Demo/Public：
  - Details（L2）默认不可用或仅摘要；显示 lock + tooltip 解释
  - claims/policies 金额类 KPI 在 Overview 必须范围化/区间化（后端裁剪为准）
- Partner/Admin：
  - 允许更深 section（Correlation/Details）与更细字段（仍需脱敏/审计）

硬规则：
- Mode 裁剪必须由后端执行；前端只负责“呈现 + 不可用提示”。

---

## predicted 规则（必须写）

- 面板展示 predicted 时：
  - L1 响应必须显式回填 `prediction_run_id`（或与 active_run 等价）
  - Timeline 三泳道必须同批次（见 Step 13/27）
- L2（后续）按需加载时也必须使用同一 `prediction_run_id`（不得混批次）

---

## 性能与缓存策略

### 默认策略（强制）

- 面板展开不应自动触发 L2 明细加载（避免首屏明细风暴）
- snap 变化（peek/half/full）不应额外触发 dp 请求（除非进入需要数据的 section 且明确缺失）

### 交互治理（强制）

- panel section nav：优先复用已加载的 L1 数据；需要 L2 时必须显式动作（AI Insight click / CTA / row click）
- brush/切产品等高频交互由 Orchestration 节流并驱动刷新

---

## 可观测性

必须记录：

- `panel_open` / `panel_close` / `panel_snap_change` / `panel_section_nav`
- `dp_l1_query`（命中/耗时）
- `dp_l2_query`（后续；命中/耗时）
- `ui_render_done`（section=..., points_count/events_count 摘要）

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `region_code/time_range/data_type/weather_type/product_id`
- predicted：`prediction_run_id`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-数据面板基础结构.md`
- `docs/v2/v2复用逻辑摘录/RD-分析汇总卡片.md`
- `docs/v2/v2复用逻辑摘录/RD-图表可视化.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`

---

## 验收用例（可勾选）

### 结构与联动（必须）

- [ ] 支持 Peek/Half/Full；不影响地图交互（主舞台优先）。
- [ ] Pareto click / map lock 不强制打断打开面板到 Full；AI Insight click/CTA 可打开并定位 section。

### 数据治理（必须）

- [ ] 面板只消费 L1 数据产品；不在面板内部对明细做重聚合。
- [ ] L2 明细默认按需加载（显式动作才触发）。

### 红线（必须）

- [ ] hover 0 次 L1/L2 明细重请求；高频交互有节流，无请求风暴。
- [ ] predicted 不混批次：panel/L1/L2 使用同 prediction_run_id。
- [ ] Demo/Public 下 L2 不可越权获取敏感明细（后端裁剪可验证）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 仍可通过 L2 接口拿到敏感明细，面板只是“没显示”。  
硬规则：后端裁剪 + 一致越权响应；前端只做 lock+tooltip。

### 失败模式 B：predicted 混批次

症状：面板 Timeline 与地图 overlays 或 L2 明细使用不同 prediction_run，解释断裂。  
硬规则：prediction_run_id 顶层锁定；所有 query key 含 run_id；响应 meta 显式回填。

---

## 风险与回滚策略

### 风险

- 面板一展开就拉 L2 明细 → 请求风暴与权限风险（P0）。
- snap/section 触发多次重渲染 → 地图掉帧（P0/P1）。

### 回滚策略

- 先强制“按需加载 L2”与更保守的 section 触发策略；稳定后再逐步增强。
- 若性能不稳：先禁用 Full 的复杂动效与 heavy section，保留 Timeline 最小集。

