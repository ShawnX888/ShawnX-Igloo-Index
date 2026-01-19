# 40 - AI CTA → UI Orchestration 联动（Intent Execution）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 40  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

AI CTA → UI Orchestration 联动：将 Router Agent/Insight Cards 产生的结构化 UI intents 通过“门控 + 节流 + 可回放”执行到前端状态机与数据产品请求层

---

## 目标 / 非目标

### 目标

- 把 AI 的动作从“口头建议”变成 **结构化 intent**，并通过 Orchestration 统一执行：
  - intent 必须可验证（schema）
  - intent 必须可门控（Mode/能力矩阵/predicted 批次锁定）
  - intent 必须可观测、可回放（事件链闭环）
- 防止 v2 三条红线被 AI 侧绕过：
  - **权限旁路**：任何 intent 执行前必须做 access_mode + capability_flags 校验
  - **预测混批次**：intent 不得隐式切换 prediction_run；predicted 下顶层锁定 run_id
  - **交互风暴**：AI 触发的状态变更也必须遵守节流边界（brush/toggle 不能风暴）

### 非目标

- 不在本细则实现具体的 Insight Cards UI（Step 39）。
- 不在本细则实现后端路由/Agent（Step 37）。

---

## 关联的数据产品（Data Product）

intent 执行的结果通常会触发以下 dp 请求（由 Query 层完成）：

- L0 Dashboard（Step 11）
- Map Overlays（Step 12）
- L1 Region Intelligence（Step 13）
- L2 Evidence（Step 33，仅 `open_details` 等显式下钻 intent 触发）

---

## 输入维度（最小集合）

### 1) Intent 输入（来自 Router/Insight Cards）

- `intent_id`（幂等/可追踪）
- `intent_type`（枚举，见下）
- `payload`（结构化）
- `origin`：`chat` | `insight_card`
- `trace_id/correlation_id`
- `proposed_scope`（建议必须包含，便于门控与审计）：
  - `region_scope/region_code`
  - `time_range`
  - `data_type`
  - `weather_type`
  - `product_id`
  - `access_mode`
  - predicted：`prediction_run_id`

### 2) 执行上下文（来自 UI Orchestration）

- `current_view_state`（同上维度）
- `capability_flags`（Details/Compare/Export…）
- `is_animating`（动画 gate）

---

## 输出形态

### 1) 执行结果（建议）

- `executed`（bool）
- `blocked_reason`（若 blocked）
- `state_patch`（应用到 Orchestration 的状态变更摘要）
- `dp_side_effects`（将触发哪些 dp 请求；仅摘要，用于观测）

### 2) 事件输出（可观测）

- `ai_intent_proposed`
- `ai_intent_validated`
- `ai_intent_blocked_by_mode`
- `ai_intent_executed`

---

## Intent Schema（强制固化）

> 这里定义“允许的最小 intent 集合”。任何新增 intent 必须先入契约与门控表。

### A) 低风险 intents（默认允许，仍需 Mode 校验）

- `open_panel`：`{ snap: "peek"|"half"|"full", section: "overview"|"timeline"|"correlation"|"details" }`
- `seek_timeline`：`{ cursor_time_utc: string, highlight?: { type, id? } }`
- `toggle_layer`：`{ layer_id: string, on: boolean }`

### B) 中风险 intents（默认需要 capability_flags）

- `set_filters`：
  - `{ region_code?, region_scope?, time_range?, data_type?, weather_type?, product_id? }`
  - 约束：不得隐式改写 access_mode；predicted 下不得隐式切换 prediction_run_id
- `compare`（可选）：
  - `{ baseline_region_code, compare_region_code }`（若 capability 允许）

### C) 高风险 intents（默认严格门控）

- `open_details`（触发 L2）：
  - `{ focus_type: "risk_event"|"claim"|"time_cursor", focus_id?, cursor_time_utc?, page_size? }`
  - 约束：只能由显式 CTA（Open details/Explain why）触发；不得被 hover/刷选间接触发
- `export` / `share`（若未来支持）：
  - 默认 Demo/Public 禁用

---

## 门控规则（强制）

### 1) Mode 门控（强制）

- Demo/Public：
  - 默认阻断：`export`、全量 `open_details`（允许摘要化 details 需 capability 显式开启）
  - 允许：`open_panel`、`seek_timeline`、基础 `toggle_layer`、安全 `set_filters`
- Partner/Admin：
  - 按 capability_flags 开放更高风险 intents

### 2) predicted 门控（强制）

- predicted 下：
  - intent 不得隐式切换 prediction_run（任何切换必须是显式“切批次”交互，且会清空旧数据）
  - 触发 dp 请求必须携带当前锁定的 prediction_run_id

### 3) 风暴门控（强制）

- 对高频类 intent（set_filters、toggle_layer）必须节流/合并：
  - “最后一次 wins”
  - in-flight 取消（由 Query 层执行）
- 动画 gate：
  - `is_animating=true` 时，允许先更新 UI 状态，但 dp 请求的 commit 必须延后（避免动画期重请求/重绘）

---

## 执行流程（推荐实现）

1) `ai_intent_proposed`：记录 intent + scope + origin  
2) Schema validate：校验 intent_type 与 payload  
3) Gate check：
   - access_mode + capability_flags
   - predicted run lock
   - storm/animation gate
4) 执行：
   - 应用 `state_patch`
   - 触发/延后 dp 请求（TanStack Query）
5) `ai_intent_executed` 或 `ai_intent_blocked_by_mode`

---

## 性能与缓存策略

- 所有 dp 请求必须遵循缓存 key 维度（见 `v2技术方案.md` 12.3）：
  - 至少包含 `access_mode`
  - predicted 额外包含 `prediction_run_id`
- intent 执行不得引入 hover→L2 的旁路：hover 仍是 0 重请求。

---

## 可观测性

必须记录（与 `v2技术方案.md` 一致）：

- `ai_intent_proposed/validated/executed/blocked_by_mode`
- `dp_*_query`（由 Query 层打点）
- `ui_render_done`

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `region_code/time_range/data_type/weather_type/product_id`
- predicted：`prediction_run_id`
- `intent_id/intent_type/origin`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-AI聊天窗与洞察联动.md`（AI 只能提出 intent，执行必须门控）
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`（维度统一）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（节流/hover 0 重请求）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（Mode/批次红线）

---

## 验收用例（可勾选）

### 执行闭环（必须）

- [ ] 点击洞察卡 CTA 能生成 intent，并通过 Orchestration 执行到正确的 UI 状态与 dp 请求。

### Mode（必须）

- [ ] Demo/Public 下越权 intents 被阻断并给出替代路径（blocked_intents 可观测）。

### predicted（必须）

- [ ] predicted 下 intent 不会隐式切批次；所有 dp 请求携带锁定 prediction_run_id；不混批次。

### 性能（必须）

- [ ] 高频 intents 节流生效（不产生请求风暴）；动画期 commit 延后生效。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 仍可通过 AI CTA 触发 L2 全量明细或导出。  
硬规则：执行前必须 Mode + capability 门控；服务端裁剪兜底；blocked 可观测。

### 失败模式 B：predicted 混批次

症状：AI intent 触发时未携带 run_id 或隐式切 run，导致解释断裂。  
硬规则：prediction_run_id 顶层锁定；query key 含 run_id；intent scope 显式回填。

---

## 风险与回滚策略

### 风险

- intent schema 不收敛 → 无法门控与审计（P0）
- 误触发 L2 → 成本与延迟抖动（P0/P1）

### 回滚策略

- 只保留低风险 intents（open_panel/seek_timeline/toggle_layer），禁用 open_details
- 强制所有 AI intents 只做 UI 呈现，不触发 dp（临时止血）

