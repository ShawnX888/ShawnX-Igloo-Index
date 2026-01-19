# 33 - L2 Evidence Data Product（证据链明细）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 33  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

L2 Evidence Data Product（证据链明细）：风险事件 ↔ 理赔 ↔ 天气证据 ↔ 规则口径（Mode-aware，按需加载）

---

## 目标 / 非目标

### 目标

- 提供 L2 “证据链”后端权威输出，支撑：
  - L2 Details 面板（Step 35）
  - AI Insight Cards 的 “See more / Explain why” CTA 下钻（Phase 3）
- 明确 L1 与 L2 的职责边界：
  - L1：可复用的聚合与趋势（Overview + Timeline）
  - L2：重查询的明细/半明细证据（默认不预取，按需加载）
- 严格遵守 v2 三条红线：
  - **权限旁路**：L2 默认含敏感字段，必须后端按 Mode 强裁剪/脱敏
  - **预测混批次**：predicted 下必须绑定 prediction_run_id；不得跨批次拼接证据
  - **交互风暴**：hover/brush/toggle 禁止触发 L2；仅 click lock + CTA 才允许

### 非目标

- 不在本细则定义前端面板 UI 交互细节（由 Step 35 承接）。
- 不做“全量明细导出/对账”能力（若需要单独立项与合规评审）。

---

## 关联的数据产品（Data Product）

本模块本身就是 Data Product：**L2 Evidence**。

依赖并协同：

- 输入依赖：Risk Service（Step 09）、Claim Service（Step 30）、Weather Service（Step 07）、Product Service（Step 05）
- 上游协同：L1 Region Intelligence（Step 13）作为“轻量入口/摘要”

---

## 输入维度（最小集合）

来自 Shared Contract 的强制维度：

- `region_scope`
- `region_code`
- `time_range`
- `data_type`（historical/predicted）
- `weather_type`
- `product_id`（可选：证据链通常与产品绑定）
- `access_mode`
- `prediction_run_id`（predicted 必须；或由 active_run 解析并回填）

L2 的“下钻焦点”（建议固化为契约扩展字段）：

- `focus_type`：`risk_event` | `claim` | `time_cursor`
- `focus_id`（risk_event_id/claim_id；当 focus_type 需要时）
- `cursor_time_utc`（当 focus_type=time_cursor）

分页/体量控制（建议）：

- `page_size`（默认小，受 Mode/能力影响）
- `cursor`（分页游标）

---

## 输出形态

> L2 输出必须“可解释、可回指、可裁剪”。建议结构化为 sections，避免前端二次拼装口径。

### 1) Meta（强制）

- `time_range`（UTC）
- `region_timezone`（用于解释频次/窗口边界；来源必须可追溯）
- `region_scope/region_code`
- `data_type`
- `weather_type`
- `product_id`
- `access_mode`
- predicted：`prediction_run_id`
- `rules_hash/product_version`（若与产品绑定）
- （可选）`calculation_range`（如使用扩展窗口，仅用于审计/排障）

### 2) Evidence Sections（建议最小集）

- `summary`：
  - 本次下钻的摘要结论（可由服务端生成，避免前端拼字）
  - KPI（Mode-aware：金额/敏感字段需裁剪）
- `risk_events`：
  - 事件列表（分页），每条包含：`event_time_utc`、tier、value、threshold、rules_hash、（predicted）prediction_run_id
- `claims`：
  - 与 risk_events 相关联的 claims（或按 focus 提供）
  - 备注：claims 只对应 historical（见 predicted 规则）
- `weather_evidence`：
  - 与 focus 对应的天气证据片段（小窗序列/关键点），带 unit 与口径说明
- `rule_explanation`：
  - riskRules/payoutRules 的必要解释字段（Mode-aware；Demo 可摘要）

### 3) 回指信息（强制）

- `map_ref`：region_code（必要时包含 center/zoom 的内部引用，不得依赖外部自由文本）
- `timeline_ref`：focus 时间点/时间窗（UTC），可回指到 L1 Timeline

---

## Mode 规则（必须写）

### Demo/Public

- 默认不返回可逆推敏感明细：
  - claims 金额类字段：区间化/范围化或隐藏
  - policy_id：摘要化
  - 列表默认更小 page_size，且禁用导出
- 可返回“解释闭环所需的最小证据”：tier、阈值、单位、时间窗、次数等（不泄露金额明细）

### Partner

- 允许更细证据，但需字段级脱敏（可配置）与审计。

### Admin/Internal

- 可返回更完整字段与更深证据链（仍需审计）。

硬规则：
- **后端强裁剪**：前端隐藏不算权限。

---

## predicted 规则（必须写）

### 批次一致性（强制）

- `data_type=predicted` 时，必须绑定 `prediction_run_id`（或由 active_run 解析并回填）
- L2 响应中所有 predicted 证据必须来自同一 run（不得拼接不同批次）

### claims 的处理（强制）

- claims 是事实表，只包含 historical
- 当 `data_type=predicted`：
  - `claims` section 默认返回空，并在 meta/summary 中明确“predicted 下无正式理赔事实”
  - 禁止为了“好看”把 historical claims 拼进 predicted 的 L2（会造成解释混乱与批次混用）

---

## 性能与缓存策略

### 请求治理（强制）

- hover/brush/toggle：禁止触发 L2
- 仅允许由：
  - click lock + “See more / Explain why” CTA
  - 或面板进入 L2 section 的显式用户动作
 触发 L2 请求（与 Step 20 联动矩阵一致）

### 缓存策略（建议保守）

- L2 默认短 TTL 或不缓存（敏感 + 重查询）；是否缓存由治理决定
- 若缓存：
  - cache key 必含：
    - `access_mode`
    - `region_scope/region_code`
    - `time_range`
    - `data_type`
    - `weather_type`
    - `product_id`
    - predicted：`prediction_run_id`
    - `focus_type`/`focus_id`（避免串用）

### 体量门槛（必须量化）

- 每次响应必须有“体量上限”：
  - 最大 events 数量（分页）
  - 最大 weather evidence 点数
  - 最大 claims 条数

---

## 可观测性

必须记录链路：

- `ui_intent(see_more/explain)` → `dp_l2_request` → `dp_l2_response` → `ui_render_done`

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `region_scope/region_code`
- `time_range`
- `data_type/weather_type/product_id`
- predicted：`prediction_run_id`
- `focus_type/focus_id`
- 响应体量指标（counts）与耗时

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`（输入维度/DTO 分类/可观测字段）
- `docs/v2/v2复用逻辑摘录/RD-数据面板基础结构.md`（L2 默认按需加载与三分区思想）
- `docs/v2/v2复用逻辑摘录/RD-图表可视化.md`（UTC 时间轴回指）
- `docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md`（业务边界解释）
- `docs/v2/v2复用逻辑摘录/RD-计算窗口与扩展数据.md`（calculation_range 与裁剪）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（L2 重查询治理）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（Mode 强裁剪与职责边界）

---

## 验收用例（可勾选）

### 功能闭环（必须）

- [ ] CTA 触发 L2 请求后，返回可解释的证据链：risk_events ↔（historical）claims ↔ weather evidence ↔ rules。
- [ ] L2 能回指地图与 L1 时间轴（UTC）。

### 红线（必须）

- [ ] hover/brush/toggle 不触发 L2（0 重请求）。
- [ ] Demo/Public 下敏感字段被裁剪/脱敏（抓包可验证）。
- [ ] predicted 不混批次：L2 响应显式带 prediction_run_id 且不跨 run 拼接。

### 体量与性能（必须）

- [ ] L2 有分页与体量上限，不会一次返回海量明细导致 UI 卡死。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo/Public 通过抓包仍能拿到 claims 精确金额/可识别 policy_id/证据链明细。  
硬规则：后端按 access_mode 强裁剪 + 审计；前端仅做降级 UX。

### 失败模式 B：predicted 混批次

症状：L2 把 predicted risk_event 与 historical claims 拼接，或混用不同 prediction_run 的 risk_events，导致解释断裂。  
硬规则：predicted L2 只输出同 run 的 predicted 证据；claims 仅 historical；不得跨 data_type 拼接。

---

## 风险与回滚策略

### 风险

- L2 默认全量拉取 → 请求风暴/体验崩（P0）
- Mode 裁剪不严 → 敏感泄露（P0）

### 回滚策略

- 先收敛：L2 只允许 CTA 触发；默认 page_size 更小；必要时临时关闭 L2 下钻入口止血
- 发现泄露：立即收紧 mode_policy_version 并回滚到更保守策略；审计并清理缓存

