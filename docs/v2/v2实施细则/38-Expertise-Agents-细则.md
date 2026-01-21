# 38 - Expertise Agents（Product / Risk&Claim / Policy）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 38  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Expertise Agents（Domain Agents）作为 Router Agent（Step 37）的“工具”：面向领域的只读/受控查询与解释生成（Product / Risk&Claim / Policy）

---

## 目标 / 非目标

### 目标

- 将领域知识拆分为 3 个 Expertise Agents（通过 Function Calling 作为 Router Agent 的工具）：
  - **Product Agent**：产品规则解释、可用产品选择建议（Mode-aware）
  - **Risk&Claim Agent**：风险/理赔解释与证据引用（基于 L0/L1/L2 数据产品）
  - **Policy Agent**：保单维度解释（仅在允许 Mode 下；以裁剪后的服务输出为准）
- 严格遵守 v2 的“分层与职责边界”：
  - Agent **不得**直接写数据库（只调用后端 Service/Data Product 的只读接口）
  - Service 层返回 **纯 JSON 数据**；Agent 层负责按 channel 格式化（见 Step 37）
  - L2 默认按需：Expertise Agents 不得在非显式追问/CTA 下滥用 L2
- 强化可观测性：每次工具调用可追踪到 dp_* 请求与最终 UI intent 的提议/执行/阻断。

### 非目标

- 不在本细则实现 Router Agent（见 Step 37）。
- 不在本细则实现前端 Chat UI / AI Insight 组件（见 Step 39/41）。

---

## 关联的数据产品（Data Product）

Expertise Agents 的事实依据必须来自数据产品（避免口径漂移）：

- L0 Dashboard（Step 11）
- L1 Region Intelligence（Step 13）
- L2 Evidence（Step 33，仅显式下钻/追问时）
- Map Overlays（Step 12，可用于解释阈值/图例/图层可用性）

---

## 输入维度（最小集合）

### 通用输入（所有 Expertise Agents 必须接收）

- `channel`：`text` | `voice`（用于 Router 最终格式化；工具本身可不做格式化，但必须知道约束）
- `question`（用户问题的结构化摘要或原文）
- `client_view_state`（来自前端，避免 Agent 猜测口径）：
  - `region_scope/region_code`
  - `time_range`
  - `data_type`
  - `weather_type`
  - `product_id`（可选）
  - `access_mode`
  - predicted：`prediction_run_id`
  - `capability_flags`
- `trace_id/correlation_id`

### 领域特定输入（可选）

- Product Agent：`product_query`（name/id）、`intent`（explain|compare|recommend）
- Risk&Claim Agent：`focus`（timeline_cursor / risk_event_id / claim_id）、`why_level`（summary|details）
- Policy Agent：`policy_id` 或 `policy_number`（可选，受 Mode 限制）

---

## 输出形态

> 注意：Expertise Agents 的输出应为 **纯 JSON**（结构化），由 Router Agent 统一转换为可读文本/AI Insight。

### 通用输出 Envelope（建议）

- `facts[]`：结构化事实点（来自 dp 响应的 meta/aggregations/events；包含引用的 dp 类型与 key 摘要）
- `explanations[]`：解释句子的结构化片段（Router 可渲染为文本或语音）
- `citations[]`：数据产品引用（dp_name + request_dims 摘要 + response_meta 摘要）
- `suggested_insight_cards[]`（可选）：候选 AI Insight 草案（由 Router 决策是否输出）
- `suggested_ui_intents[]`（可选）：候选 UI intents（必须可被 Step 40 门控）
- `safety`：
  - `blocked`（bool）
  - `block_reason`（如 Mode 限制/能力矩阵限制）

---

## Mode 规则（必须写）

### Demo/Public

- 禁止输出敏感口径与可识别明细：
  - 精确金额、可识别 policy/claim id、可导出/对账类建议
- 若用户请求越权内容：
  - 返回 `safety.blocked=true` + 替代解释路径（例如只给阈值/次数/区间/趋势）

### Partner

- 允许更深解释，但仍需字段级脱敏（以服务端裁剪为准）。

### Admin/Internal

- 可引用更深明细，但仍需审计与可观测链路完整。

硬规则：
- Agent 的“建议做什么（CTA）”也必须 Mode-aware（不得给 Demo 提供 Admin-only 动作）。

---

## predicted 规则（必须写）

- predicted 场景下必须顶层锁定 `prediction_run_id`：
  - Agents 不得自行切换 run
  - 引用任何 dp 证据必须同 run（L0/L1/L2/Overlays）
- claims 事实规则：
  - predicted 下不得把 historical claims 拼进 predicted 证据链（遵循 Step 33）

---

## 性能与调用预算

- 默认优先级（成本/延迟由低到高）：
  1) L1（聚合+meta）  
  2) L0（背书 KPI/TopN）  
  3) Overlays（图层解释/legend）  
  4) L2（明细证据，按需）
- 单轮工具调用预算（建议初始值）：
  - 默认最多 2 次数据产品调用；进入 why/details 才允许触发 L2（且最多 1 次）
- 失败降级：
  - L2 超时 → 回退到 L1（解释仍可闭环：阈值/次数/时间窗/趋势）

---

## 可观测性

必须记录链路（与 `v2技术方案.md` 事件命名对齐）：

- `ai_tool_call`（agent_name=product|risk_claim|policy）
- `dp_*_query` / `dp_*_response`
- `ai_intent_proposed`
- `ai_intent_blocked_by_mode`（如阻断）

必带字段：

- `trace_id/correlation_id`
- `session_id`（若在 Router 层可获得）
- `access_mode`
- `region_code/time_range/data_type/weather_type/product_id`
- predicted：`prediction_run_id`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-AI聊天窗与洞察联动.md`（两条腿：聊天窗 + AI Insight；动作必须走 Orchestration）
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`（维度统一与 DTO 分类）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（Service JSON-only、Mode/predicted 红线）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（L2 按需、避免风暴）

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] Router 能调用三个 Expertise Agents，并得到结构化 facts/citations。
- [ ] Agents 的事实引用来自数据产品（L0/L1/L2/Overlays），不自行“编造口径”。

### Mode（必须）

- [ ] Demo/Public 下，Agents 不返回敏感字段，也不建议越权动作；越权请求被 block 并给替代路径。

### predicted（必须）

- [ ] predicted 下所有引用同一 prediction_run_id；不混批次，不跨 data_type 拼证据。

### 可观测（必须）

- [ ] 每次工具调用可追踪到 dp_* 请求与 intent 的 proposed/blocked/executed。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Agents 直接输出敏感明细或引导越权 CTA，前端只是“不显示”。  
硬规则：Agent 输出/建议必须 Mode-aware；服务端裁剪兜底；前端能力矩阵二次门控。

### 失败模式 B：predicted 混批次

症状：Agents 拼装解释时混用不同 run 的 L1/L2 证据或引入 historical claims。  
硬规则：prediction_run_id 顶层锁定；L2（predicted）不拼 claims；引用 meta 必含 run_id。

---

## 风险与回滚策略

### 风险

- 工具调用过多 → 成本/延迟抖动（P0/P1）
- 解释未绑定 dp 证据 → 可解释性不可审计（P0）

### 回滚策略

- 收敛工具：只保留 Risk&Claim Agent + 只调用 L1/L0（禁用 L2）
- 收敛输出：只输出 AI Insight 草案，不输出可执行 intents（交由后续版本打开）

