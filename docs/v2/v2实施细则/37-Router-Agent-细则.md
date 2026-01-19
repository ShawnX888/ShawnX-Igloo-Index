# 37 - Router Agent（NLU + 路由 + 格式化）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 37  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Router Agent（Supervisor Agent）：统一入口完成 NLU/意图识别/路由决策/Tool Calling/响应格式化（按 channel=text|voice），并对所有输出与动作执行 **Mode-aware** 治理

---

## 目标 / 非目标

### 目标

- 落地 v2 的 AI 架构主张（以 `v2架构升级-全栈方案.md` 为准）：
  - Router Agent 作为单入口：NLU + Orchestration + Tool Calling + Response Formatting
  - 后续可挂载 Expertise Agents（Step 38）作为“工具”
- 把 AI 从“聊天回答”升级为“导演式联动”（与 `RD-AI聊天窗与洞察联动.md` 对齐）：
  - 输出不仅是文本，还包含 **Insight Cards + CTA + UI Intent**
  - 所有 intent 必须走前端 UI Orchestration 的统一入口（避免绕过节流/Mode/批次）
- 严格遵守平台级硬规则（跨层）：
  - Service Layer **只返回纯 JSON 数据**，不得返回 Markdown/表格（Agent 负责格式化）
  - AI 不得直接写数据库（只能调用后端服务能力的只读/受控接口）
  - predicted 一致性：同一会话链路 `prediction_run_id` 顶层锁定，不混批次
  - Access Mode：输出文本/卡片/CTA 都必须 Mode-aware（避免越权引导）

### 非目标

- 不在本细则实现具体 Expertise Agents（Step 38）。
- 不在本细则实现前端 Chat UI/Insight Cards 组件（Step 39/41/40 承接）。

---

## 关联的数据产品（Data Product）

Router Agent 的“取证/解释”必须基于数据产品（避免口径漂移）：

- L0 Dashboard（Step 11）
- L1 Region Intelligence（Step 13）
- L2 Evidence（Step 33）
- Map Overlays（Step 12，可选用于解释图例/阈值）

---

## 输入维度（最小集合）

### 1) Agent 输入（API 请求体/WS 消息）

- `session_id`
- `channel`：`text` | `voice`
- `user_input`（文本或转写文本）
- `client_view_state`（强烈建议：把前端当前维度作为上下文输入，避免 AI 猜测）：
  - `region_scope/region_code`
  - `time_range`
  - `data_type`
  - `weather_type`
  - `product_id`（可选）
  - `access_mode`
  - predicted：`prediction_run_id`（或 active_run 等价注入）
  - `capability_flags`（前端能力矩阵快照：Details/Compare/Export…）
- `trace_id/correlation_id`

### 2) 工具调用输入（由 Router Agent 组装）

- 统一使用 Shared Contract 维度命名（见 `RD-共享类型与接口契约.md`）
- predicted：任何 dp 请求都必须携带 `prediction_run_id`（避免混批次）

---

## 输出形态

### 1) 统一响应 Envelope（建议）

> 注意：这里描述“应返回的数据形态”，不是强制具体字段名；字段名一旦确定需进入 Shared Contract。

- `assistant_message`（给人看的文本，text/voice 由 Router Agent 生成）
- `insight_cards[]`（导演式洞察卡）：
  - `title`（一句话结论）
  - `evidence_points[]`（1–2 个数字/短证据，来自数据产品 meta/aggregations）
  - `scope`（region/time_range/product/data_type/prediction_run_id）
  - `cta[]`（可执行动作：Show on timeline / Open details / Overlay thresholds…）
- `ui_intents[]`（结构化意图）：
  - `type`：`set_filters` | `open_panel` | `seek_timeline` | `toggle_layer` | `open_details` | ...
  - `payload`：仅包含 Shared Contract 维度与 UI Orchestration 可执行的字段
- `tool_trace[]`（可选：调试/审计用途，Demo 默认关闭）
- `meta`：
  - `access_mode`
  - predicted：`prediction_run_id`
  - `blocked_intents[]`（若被 Mode/能力矩阵拦截，需说明原因）

### 2) channel='voice' 规则（强制）

- 语音模式只输出 1–2 句摘要（不念表格、不念长列表）
- 仍可返回 ui_intents/insight_cards（供前端驱动 UI），但语音文本必须短

---

## Mode 规则（必须写）

### Demo/Public

- 文本输出：
  - 避免敏感口径（精确金额/可识别保单/理赔 id）
  - 解释以“阈值/次数/区间/趋势”为主
- CTA：
  - 禁止引导/触发导出、全量明细、Admin-only 动作
  - `open_details` 若允许也必须是“摘要化 Details”（由后端 L2 裁剪保证）
- 如果用户请求越权：
  - 返回可解释的拒绝原因（friendly），并给替代路径（例如转到 Timeline/Correlation）

### Partner/Admin

- 按能力矩阵开放更深解释与更强 CTA，但仍需字段级脱敏与审计。

硬规则：
- **输出必须 Mode-aware**：不仅是数据返回裁剪，连“建议做什么”都必须受限（ai_intent_blocked_by_mode）。

---

## predicted 规则（必须写）

- predicted 场景必须顶层锁定 `prediction_run_id`：
  - Router Agent 不能“自行选择最新 run”并隐式切换
  - 若后端提供 active_run：第一次 dp 响应回填 run_id 后，Agent 必须在本会话内沿用
- 禁止混用不同 prediction_run 的证据拼装解释：
  - L0/L1/L2/Overlays 的引用必须同批次
  - 引用时在 meta 中带出 run_id（至少 debug）

---

## 性能与可靠性

- Router Agent 不做重计算：
  - 一切计算事实来自数据产品与服务层
- 工具调用预算（建议）：
  - 单轮对话最多 N 次数据产品调用（N 初始可为 2–4），优先复用 L1/L0 聚合，不滥用 L2
  - L2 默认按需（仅在用户显式追问“why/details”或 CTA 触发）
- 失败降级：
  - 若 L2 超时：退化为 L1 的解释（聚合 + meta），并提示可稍后再试
  - 若 predicted 批次不可用：提示并建议切回 historical（不自动切换）

---

## 可观测性

必须形成链路（与 `v2技术方案.md` 建议事件一致）：

- `chat_submit` → `ai_tool_call` → `dp_*_query` → `dp_*_response` → `ai_intent_proposed` → `ai_intent_blocked_by_mode|ai_intent_executed` → `ui_render_done`

必带字段：

- `trace_id/correlation_id`
- `session_id`
- `access_mode`
- `region_code/time_range/data_type/weather_type/product_id`
- predicted：`prediction_run_id`
- `tool_name`、`latency_ms`、`cache_hit`（如适用）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-AI聊天窗与洞察联动.md`（聊天窗 + 洞察卡 + CTA→Orchestration）
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`（维度统一、DTO 分类、可观测字段）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（Service JSON-only、Mode/批次红线）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（L2 按需、避免风暴）

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] Router Agent 能根据用户输入生成：文本解释 +（可选）洞察卡 + 可执行 UI intents。
- [ ] intents 能驱动 UI Orchestration（不绕过），并触发对应数据产品刷新。

### Mode（必须）

- [ ] Demo/Public 下不会输出敏感口径，也不会建议/触发越权动作；越权会产生 blocked_intents 与替代路径。

### predicted（必须）

- [ ] predicted 下所有 dp 引用同一 prediction_run_id；不会隐式切批次；解释可追溯 run_id。

### 可观测（必须）

- [ ] 一次对话可追踪到：工具调用、数据产品请求、intent 提议/阻断/执行、最终渲染完成。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Agent 输出/CTA 绕过 Mode 限制，导致 Demo 仍能引导拿到敏感明细。  
硬规则：Agent 输出与 intent 必须 Mode-aware；后端裁剪兜底；前端能力矩阵二次门控。

### 失败模式 B：predicted 混批次

症状：Agent 引用不同 prediction_run 的证据拼装解释，导致“看似合理但不可审计”。  
硬规则：prediction_run_id 顶层锁定；dp 请求与缓存 key 必含 run_id；解释 meta 显式回填。

---

## 风险与回滚策略

### 风险

- 过度调用 L2 → 成本高/延迟高/体验抖动（P0/P1）
- 意图执行绕过 Orchestration → 请求风暴/越权（P0）

### 回滚策略

- 收敛：仅输出洞察卡 + 少量安全 intents（open_panel/seek_timeline），禁用 open_details/导出类 intent
- 若出现越权：立即加强 Mode gate（blocklist）并收紧后端裁剪策略版本；审计并清理缓存

