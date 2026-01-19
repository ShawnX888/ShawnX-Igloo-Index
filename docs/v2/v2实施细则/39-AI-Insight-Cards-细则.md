# 39 - AI Insight Cards（导演式洞察卡）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 39  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

AI Insight Cards（Director Cues）：一句话结论 + 证据点 + CTA（可执行 UI Intent），用于驱动用户进入正确解释路径（而非堆文字）

---

## 目标 / 非目标

### 目标

- 在路演友好的固定区域（建议 Left Sidebar 顶部）展示 **固定 3 张洞察卡**：
  - 结论句（1 行）
  - 证据点（1–2 个数字/短证据）
  - 口径（区域/时间/产品/数据类型/批次）
  - CTA（按钮）→ 触发 UI Orchestration（Step 20）执行联动
- 洞察卡必须“证据可追溯”：
  - 证据点必须来自 Data Products（L0/L1，必要时 L2）
  - 卡片携带 scope/meta，便于审计与回放
- 约束写死以避免联动风暴：
  - 洞察卡刷新必须节流
  - CTA 才允许触发 L2（按需加载），hover/滚动不触发

### 非目标

- 不在本细则实现聊天窗（Step 41）。
- 不在本细则实现 Router Agent 与工具调用（Step 37/38）。

---

## 关联的数据产品（Data Product）

洞察卡的事实来源只能是：

- L0 Dashboard（Step 11）：省级背书 KPI/TopN（适合洞察卡的“省级对比”证据点）
- L1 Region Intelligence（Step 13）：选区概览 KPI/时间轴 meta（适合“为什么突出”的证据点）
- L2 Evidence（Step 33）：仅当 CTA 明确下钻（Open details/Explain why）时按需拉取
- Map Overlays（Step 12）：仅用于图例/阈值/图层可用性解释（不用于明细推断）

---

## 输入维度（最小集合）

来自 UI Orchestration 的 View/Access State：

- `region_scope/region_code`
- `time_range`
- `data_type`
- `weather_type`
- `product_id`（可选）
- `access_mode`
- predicted：`prediction_run_id`

触发源（用于可观测）：

- `trigger_source`：`map_lock` | `ranking_click` | `time_range_change` | `weather_type_toggle` | `product_change` | `ai_chat_submit` | `manual_refresh`

---

## 输出形态（UI）

### 卡片结构（固定，避免报表化）

每张卡片建议字段：

- `title`：一句话结论（≤ 20 字中文或等价长度）
- `evidence_points[]`（1–2 项）：
  - `{ label, value, unit?, note? }`
- `scope`：
  - `region_code/time_range/data_type/weather_type/product_id/access_mode`
  - predicted：`prediction_run_id`
- `cta[]`（最多 2 个）：
  - `label`
  - `intent_type`（见 Step 40）
  - `intent_payload`（必须可被门控与回放）

### 推荐 CTA 列表（与 `v2页面设计提案.md` 对齐）

- `Show on timeline` → `seek_timeline` + `open_panel(section=timeline, snap=half)`
- `Overlay thresholds` → `toggle_layer(thresholds_overlay=on)`（或 overlays preset）
- `Compare to province` → `open_panel(section=correlation, snap=half)`（若能力允许）
- `Open details` → `open_panel(section=details, snap=full)` + `open_details(focus=...)`（触发 L2，按需）

---

## Mode 规则（必须写）

### Demo/Public

- 内容：
  - 禁止输出敏感口径（精确金额/可识别 id）
  - 证据点以“次数/区间/阈值/趋势”优先
- CTA：
  - 禁止导出/全量明细/高风险动作
  - `Open details` 仅允许打开“摘要化 Details”（由后端 L2 裁剪兜底），或直接降级为 “Show on timeline”
 - **Claims 可用性（强制）**：
   - 当 Data Products 的 meta 声明 `claims_available=false`（字段名以 Shared Contract 为准）：
     - 禁止生成任何以 claims 为证据点的卡片
     - 禁止生成 claims 相关 CTA（例如“查看理赔明细/理赔对比”）
     - 允许生成“解释性卡片”：说明“理赔事实域尚未上线/当前不可用”，并给替代 CTA（Show on timeline / Overlay thresholds）

### Partner

- 允许更深证据点与更多 CTA，但仍需字段级脱敏与审计。

### Admin/Internal

- 可开放更强 CTA（仍需审计），但必须遵守 “AI 只能提出 intent，最终执行必须门控”。

---

## predicted 规则（必须写）

- predicted 场景洞察卡必须绑定页面 `prediction_run_id`（不得隐式切批次）
- 若洞察引用 L0/L1 的 predicted 证据：必须同批次，且 scope/meta 显式带 run_id（至少 debug）
- 与 claims 事实一致性：
  - predicted 下不得引用“正式理赔事实”作为预测证据（如需解释必须明确“无正式 claims 事实”）
 - 与 Phase 2 的 claims 可用性一致性（强制）：
   - historical/predicted 均可能 `claims_available=false`（Phase 1/2），此时不得输出任何 claims 事实类结论

---

## 性能与刷新策略

### 刷新触发（强制节流）

- 允许触发刷新：
  - map_lock / ranking_click（重交互）
  - time_range_change / weather_type_toggle / product_change（高频但必须节流）
- 禁止触发刷新：
  - hover
  - panel_snap_change
  - 列表滚动

### 节流策略（建议）

- 采用“最后一次意图 wins”的 debounce（例如 300–800ms）+ in-flight 取消（由 Query 层/Agent 层实现）
- 保证“视觉稳定”：洞察卡刷新频率不应压过用户操作节奏（路演稳定优先）

---

## 可观测性

必须记录：

- `insight_cards_refresh_requested`（trigger_source）
- `insight_cards_render_done`（card_ids、counts 摘要）
- `ai_cta_click`（cta_id、intent_type）
- `ai_intent_blocked_by_mode`（若被门控）

必带字段（与 `v2技术方案.md` 对齐）：

- `trace_id/correlation_id`
- `access_mode`
- `region_code/time_range/data_type/weather_type/product_id`
- predicted：`prediction_run_id`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-AI聊天窗与洞察联动.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（节流与风暴治理）
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`（scope 维度统一）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（Mode/predicted 红线）

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] 固定 3 张洞察卡可展示，且每张卡片包含结论/证据/口径/CTA。
- [ ] CTA 点击能触发 UI Orchestration 联动（打开面板/定位时间轴/切图层），并可观测可回放。
 - [ ] 当 `claims_available=false`：洞察卡不会输出 claims 证据点/结论；不会产生 claims 相关 CTA；UI 仍有替代解释路径（timeline/thresholds）。

### Mode（必须）

- [ ] Demo/Public 下不会展示敏感口径，也不会给出越权 CTA；越权 CTA 会被门控并降级为可用动作。

### predicted（必须）

- [ ] predicted 下洞察卡不混批次，且 scope/meta 可追溯 prediction_run_id。

### 性能（必须）

- [ ] 刷新节流生效：高频交互不会导致洞察卡闪烁/请求风暴。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 下洞察卡仍展示敏感证据点或给出越权 CTA。  
硬规则：输出与 CTA 都必须 Mode-aware；后端裁剪兜底；前端能力矩阵二次门控。

### 失败模式 B：predicted 混批次

症状：洞察卡引用旧 run 的证据或跨 run 拼装解释。  
硬规则：prediction_run_id 顶层锁定；scope/meta 显式回填 run_id；缓存 key 必含 run_id。

---

## 风险与回滚策略

### 风险

- 洞察卡刷新过频 → 路演不稳定/注意力分散（P1）
- 洞察卡过度触发 L2 → 成本高/延迟高（P0/P1）

### 回滚策略

- 收敛：洞察卡只基于 L1/L0 聚合生成，禁用 Open details CTA
- 收敛：只保留 1 张卡或只保留 “Show on timeline” 单一 CTA

