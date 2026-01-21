# 20 - UI Orchestration（状态机 + 联动矩阵）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 20  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

UI Orchestration（Zustand：View/Access State；TanStack Query：Server State；状态机 S0–S3 + 联动矩阵 + 请求治理）

---

## 目标 / 非目标

### 目标

- 建立 v2 前端**唯一事实来源**（Single Source of Truth）：
  - View State（选区/时间窗/天气类型/产品/图层开关/面板 snap point…）
  - Access State（access_mode、capability flags、predicted 批次锁定）
  - Server State（L0/L1/L2/Overlays 的请求与缓存）由 TanStack Query 统一管理
- 固化 v2 的交互红线与治理：
  - hover：0 次 L1/L2 明细重请求（仅高亮 + tooltip）
  - brush/toggle：节流/去抖，避免请求风暴
  - predicted：全链路绑定 `prediction_run_id`（或 active_run 解析后回填并锁定）
  - Mode：后端强裁剪；前端仅做“可见但不可用”降级 UX
- 使所有交互“可解释、可回放、可观测”：
  - 统一事件命名（ui_intent）→ 状态变更（state_transition）→ dp 请求（dp_request）→ 渲染完成（ui_render_done）

### 非目标

- 不在本细则实现具体 UI 组件（L0 Left HUD Rail、Top Bar、Panel 等由各自步骤实现）。
- 不在本细则定义后端权限系统；只定义 Mode-aware 的前端呈现与请求维度约束。

---

## 关联的数据产品（Data Product）

UI Orchestration 负责统一调度以下数据产品请求与刷新策略：

- L0 Dashboard
- Map Overlays
- L1 Region Intelligence
- L2 Evidence（后续）

---

## 输入维度（最小集合）

> 维度命名必须与 Shared Contract 一致（见 `RD-共享类型与接口契约.md`）。

- `region_scope` / `region_code`
- `time_range`
- `data_type`（historical/predicted）
- `weather_type`
- `product_id`（可选）
- `access_mode`
- `prediction_run_id`（predicted 必须；或 active_run 解析后回填并锁定）

扩展（前端内部状态，但影响请求治理）：

- `panel_snap`（collapsed/peek/half/full）
- `panel_section`（overview/timeline/correlation/details）
- `layer_state`（layer_id → on/off）
- `is_animating`（地图动画 gate）

---

## 输出形态

### 1) 状态机（S0–S3）

与 `v2页面设计提案.md` 对齐：

- S0 初始（Left HUD Rail 可见；Panel Collapsed/Peek）
- S1 区域锁定（Map lock；Left HUD Rail 高亮选区；AI Insight 状态更新/轮动（节流）；面板默认不打断）
- S2 情报面板打开（Half；定位到目标 section）
- S3 分析模式（Full；sticky nav）

### 2) 联动矩阵（Trigger → Actions）

必须覆盖并写死以下规则（摘要，详细触发见 v2 页面设计）：

- hover：只 UI 高亮/tooltip（≤3 指标）；**不得**触发 L1/L2
- map click lock / pareto click：允许触发 L1 最小集（可缓存），不强制展开面板
- AI Insight click / CTA：允许打开面板并触发 L2（按需加载，按 Mode 裁剪）
- time brush：节流触发 L0/L1/Overlays 刷新
- weather_type toggle：同步更新 overlays + 产品列表 + L1 timeline（节流）

---

## Mode 规则（必须写）

- `access_mode` 必须进入：
  - Query key（避免缓存串用）
  - Capability gating（哪些动作可执行、哪些 CTA 可触发）
  - 默认展开策略（Demo 默认更轻）
- 禁止把 Mode 当纯前端隐藏：后端必须裁剪；前端负责解释与降级 UX（lock + tooltip）。

---

## predicted 规则（必须写）

### 批次锁定（强制）

- `data_type=predicted` 时，必须保证同一“用户交互链路”内所有 dp 请求使用同一 `prediction_run_id`。
- 若后端提供 active_run 解析：第一次响应必须回填批次标识，前端把它锁定为当前页面批次（避免解释断裂）。

### 缓存 key（强制）

- predicted query key 必含 `prediction_run_id`（见 `RD-性能优化.md`）。

---

## 性能与缓存策略

### 请求治理（强制）

- hover：0 明细重请求
- brush：节流（避免每像素一次请求）
- layer toggle：默认只改呈现；若触发 overlays 刷新必须节流；不得触发 L2

### TanStack Query 约束（强制）

- 所有 dp 数据获取必须走 Query（禁止 useEffect 拉数据）
- query key 至少包含：
  - `access_mode`
  - `region_scope/region_code`
  - `time_range`
  - `data_type`
  - `weather_type`
  - `product_id`（如影响口径）
  - predicted：`prediction_run_id`

---

## 可观测性

必须形成链路：

- `ui_intent` → `state_transition` → `dp_request` → `dp_response` → `ui_render_done`

必带字段（至少）：

- `trace_id/correlation_id`
- `access_mode`
- `region_code/time_range/data_type/weather_type/product_id`
- predicted：`prediction_run_id`
- `is_animating`（动画期间应延后 commit）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`
- `docs/v2/v2复用逻辑摘录/RD-页面间联动.md`

### 来自 v1 的可复用资产（R0/R1）

- 复用“中心化入口统一调度状态与联动”的思想，但 v2 必须把“计算事实源”从前端迁移为“数据产品消费”。

### 不复用内容（R3）

- 不复用“组件内散落请求/散落口径推断”的实现方式。

---

## 验收用例（可勾选）

### 联动闭环（必须）

- [ ] L0 Pareto click → Map lock →（可选）L1 刷新不打断地图主舞台。
- [ ] AI Insight click / CTA → 面板打开到 Half 并定位 section → 按需加载（允许）L2。

### 红线（必须）

- [ ] hover 0 次 L1/L2 明细重请求；brush/toggle 无请求风暴（可观测可证明）。
- [ ] predicted 不混批次（同一链路同一 prediction_run_id）。
- [ ] access_mode 不串缓存，且越权动作在前端表现为“可见但不可用”。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 通过抓包仍可拿到敏感字段/明细；或 Demo 命中 Admin 缓存。  
硬规则：后端裁剪 + query key 含 access_mode；前端仅做降级 UX。

### 失败模式 B：predicted 混批次

症状：同屏 overlays 与 L1 使用不同 prediction_run，导致解释断裂。  
硬规则：prediction_run_id 顶层锁定；所有 query key 必含 run_id；动画期延后 commit。

---

## 风险与回滚策略

### 风险

- 状态域混杂（View/Access/Server State 不分离）→ 竞态与不可测试（P0/P1）。
- 高频交互未节流 → 请求风暴/掉帧（P0）。

### 回滚策略

- 先收敛触发面：只允许 click/CTA 触发 L1/L2；hover 仅高亮；逐步放开。
- 将请求集中迁移到 Query 层，清除组件内的临时 fetch/useEffect。

