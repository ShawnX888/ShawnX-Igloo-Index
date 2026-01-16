# Reuse Digest — AI 聊天窗与洞察联动

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + BE + Shared Contract  
> 绑定验收锚点：AI Insights、Access Mode、Observability、Perf/SLO

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/17-AI对话集成.md`
- （关联依赖）`docs/v1/03-Google-Maps-API配置与初始化.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 Chat UI（聊天窗）必须具备的行为
- **必须集成 Google Contextual View AI kit**（v1 用 `gmp-place-contextual` Web Component 思路）作为聊天窗 UI。
- **聊天窗需要可折叠/最小化**，并保持与地图等高的可用布局（v1 为“地图右侧 1/4 宽度”；v2 可调，但“可控占位 + 不遮挡主舞台”的目标不变）。
- **聊天窗必须能接收用户自然语言输入**，并在成功解析后驱动全局参数变更：
  - 行政区域（国家/省/市区）
  - data_type（historical/predicted）
  - time_range（起止）
  - product（产品）

### 2.2 参数提取与“全局状态同步”
- **AI 输出必须可被解析为结构化参数**，并更新全局状态（v1 通过 setter 更新 `selectedRegion/dataType/dateRange/selectedProduct`）。
- **状态同步是双向的**：
  - AI 解析→更新全局状态→触发地图与数据刷新
  - 用户手动操作→更新全局状态→聊天窗应能反映当前参数（至少在 UI 上呈现当前筛选状态）

### 2.3 Grounding/Context Token 概念（可复用但需 v2 化）
- v1 的核心思想是：通过 Grounding 产生一个 **context token** 供 contextual widget 使用，并从同一响应中提取结构化参数。
- 需要保留“**token 与参数提取**”的双产出模式，但 v2 必须把“参数提取结果”落到 v2 的统一维度与契约中（见第 3 节）。

### 2.4 性能/可靠性要求（可复用）
- AI 响应时间需有上限与降级（v1 给出：对话响应 3s 内、参数更新 1s 内、组件加载 2s 内）。
- 必须处理失败：组件加载失败、grounding 失败、参数提取不准确（需提供提示与可恢复路径）。

---

## 3. v2 化适配（必须写清楚）

### 3.1 v2 的“AI 两条腿”：聊天窗 + 导演式洞察卡并存
- **聊天窗是必须保留的稳定入口**：用户表达需求、追问解释、兜底交互。
- **洞察卡（Insight Cards）是 v2 主线**：一句话结论 + CTA（可执行 UI Intent），用于“导演式联动”与叙事节奏控制。
- 两者并存的关键：洞察卡的 CTA 与聊天窗的解析结果，都必须走 **同一条 UI Orchestration 入口**（避免绕过 Mode/批次/节流）。

### 3.2 输入维度（统一契约）
任何由聊天窗产生、或由洞察卡触发的数据请求，都必须显式携带/推导 v2 维度：
- region_scope / region_code
- time_range
- data_type（historical/predicted）
- weather_type
- product_id（可选）
- access_mode（Demo/Public、Partner、Admin/Internal）
- prediction_run_id（predicted 场景；或通过 active_run 解析后等价注入）

### 3.3 Access Mode 规则（强制）
- **聊天内容与洞察内容必须 Mode-aware**：
  - Demo/Public：避免敏感口径/明细引导；CTA 不能建议越权动作（如导出/全量明细）。
  - Partner：允许更深解释，但仍要字段级脱敏（由 BE 裁剪保证）。
  - Admin/Internal：允许全量解释与更强操作（仍需审计）。
- **动作执行必须 Mode 校验**：AI 只能“提出 intent”，最终执行由 UI Orchestration + 后端权限裁剪共同保证。

### 3.4 Prediction Run 规则（强制）
- predicted 场景下，聊天窗触发的查询/洞察卡触发的查询必须与页面批次一致：
  - 缓存 key 维度规则以 `RD-性能优化.md` 为准（至少包含 `access_mode`；predicted 额外包含 `prediction_run_id`）
  - 禁止从历史批次缓存拼装解释（避免“解释断裂”）

### 3.5 可观测性（强制）
至少要能追踪：
- 用户输入（chat_submit）→ 解析（ai_tool_call/ai_parse_done）→ 参数变更（state_change）→ 数据产品请求（dp_*）→ 渲染完成（ui_render_done）
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 用户在聊天窗输入自然语言后，系统能更新：region、time_range、data_type、product（至少其中 2 项），并触发对应数据产品刷新。
- [ ] 聊天窗解析失败时，UI 有明确提示且不破坏当前页面状态（可重试/可手动修正）。
- [ ] Demo/Public 模式下，聊天窗与洞察卡不会引导用户进入不可用或敏感能力（例如 L2 明细全量/导出）。
- [ ] predicted 场景下，聊天触发的数据请求与页面 active_run 一致，不发生混批次。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：聊天窗直接绕过 UI Orchestration 改写状态并触发 L2 明细重请求（应先进入锁区/See more/CTA 的重交互路径）。
- [ ] 禁止：洞察卡 CTA 在 Demo/Public 下触发“导出/全量明细/敏感口径”。
- [ ] 禁止：predicted 场景未携带 prediction_run_id（或未绑定 active_run）直接命中缓存并返回结果。

---

## 5. 未决问题（Open Questions）
- Q1：聊天窗与手动控制（Top Bar/Left Sidebar/Panel）是否“互斥”还是“并存+可最小化”？（建议 v2：并存，但可最小化，不强互斥）
- Q2：聊天窗是否需要在 UI 上显示当前 access_mode 与 prediction_run_id（至少在 Admin/Internal 或 debug 模式显示）？

