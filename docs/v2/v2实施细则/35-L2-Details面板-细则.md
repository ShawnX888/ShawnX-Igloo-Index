# 35 - L2 Details 面板（证据链 UI）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 35  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

L2 Details 面板（Region Intelligence Panel 的 Details section）：消费 L2 Evidence Data Product，展示“风险事件 ↔ 理赔 ↔ 天气证据 ↔ 规则口径”的可回指证据链（Mode-aware，按需加载）

---

## 目标 / 非目标

### 目标

- 落地 v2 的 L2 证据链 UI 闭环（与 `v2页面设计提案.md` 对齐）：
  - 默认折叠/不打断主舞台；仅在 “See more / Insight CTA: Open details” 触发进入
  - 按时间倒序列出 Evidence items（风险事件 ↔ 理赔摘要/条目 ↔ 规则提示）
  - 点击条目可 **回指 Timeline（UTC）** 与 **回指地图**（高亮/必要时 fly-to）
- 严格遵守 v2 三条红线：
  - **权限旁路**：Details 默认是敏感区，必须 Mode-aware（后端裁剪，前端仅做可用性解释）
  - **预测混批次**：predicted 下 L2 必须绑定 prediction_run_id；不得跨批次/跨 data_type 拼证据
  - **交互风暴**：hover/brush/toggle 禁止触发 L2；只有 CTA / row click 才允许
- 体验可解释：
  - 每条证据必须能说明：时间点、触发 tier、阈值/单位、（historical）理赔结果、以及“为何关联”
  - 在 Demo/Public 下，Details 仍能给出“解释闭环”但不泄露敏感字段（金额/可识别 id）

### 非目标

- 不在本细则实现 L2 Evidence 的后端接口与数据拼装（由 Step 33 承接）。
- 不实现导出/批量下载明细（高风险能力，需单独立项与合规审查）。

---

## 关联的数据产品（Data Product）

- L2 Evidence Data Product（Step 33）：本面板的唯一事实源（明细/半明细 + 关联）
- L1 Region Intelligence（Step 13）：用于时间轴回指与轻量上下文（不用于拼装 L2 明细）
- Map Overlays（Step 12）：用于地图高亮/tooltip 的轻量复用（不触发 L2）

---

## 输入维度（最小集合）

来自 UI Orchestration（Step 20）的状态域（命名必须与 Shared Contract 一致）：

- `region_scope` / `region_code`
- `time_range`
- `data_type`
- `weather_type`
- `product_id`（可选，但 Details 通常与产品相关）
- `access_mode`
- predicted：`prediction_run_id`
- `panel_snap` / `panel_section=details`

L2 下钻焦点（来自 Step 33 的契约扩展，前端负责传递）：

- `focus_type`：`risk_event` | `claim` | `time_cursor`
- `focus_id`（若需要）
- `cursor_time_utc`（若需要）
- 分页：`page_size`、`cursor`

---

## 输出形态（UI）

### 1) Details 结构（建议）

- 顶部 Summary Strip（来自 L2 summary）：
  - 1 句话结论（可折叠）
  - 口径 chips：region/time_range/data_type/weather_type/product/access_mode（predicted 显示 run_id，至少在 debug）
- Evidence List（虚拟列表 + 分页）：
  - Evidence Card：
    - Header：事件时间（UTC→本地展示）、tier badge、data_type
    - Risk：trigger_value、threshold_value、unit、rules_hash/version（Demo 可隐藏 hash，仅显示版本/摘要）
    - Claims：claim_count（必要时）+（Mode-aware）金额摘要/区间（historical 才可有）
    - Weather Evidence：小片段 sparkline 或关键点摘要（不允许拉全量）
    - CTA：`Highlight on Timeline` / `Locate on Map`（不触发 L2，仅改变呈现）
- 空态/禁用态：
  - Demo/Public：Details 受限时展示 “可见但不可用” + tooltip（解释为何受限、如何获得更多权限）
  - predicted：解释“predicted 下无正式理赔事实”（与 Step 33 一致）

### 2) 事件输出（给 UI Orchestration）

- `panel_open(snap=half|full, section=details, focus=...)`
- `l2_row_click(focus_type, focus_id, cursor_time_utc)`
- `timeline_seek(cursor_time_utc)`（回指）
- `map_highlight(region_code, optional_marker_ref)`

---

## Mode 规则（必须写）

### Demo/Public

- Details 默认折叠；进入后：
  - claims 金额类字段：必须区间化/隐藏（依赖后端裁剪）；前端不得自行拼精确金额
  - policy_id / claim_id / risk_event_id：默认不展示可识别 id（可用摘要标识）
  - page_size 更小 + 强化空态/解释（避免把 Demo 做成“报表导出器”）

### Partner

- 允许更细字段与更深证据（仍需字段级脱敏 + 审计）。

### Admin/Internal

- 允许更全字段与更深证据链（仍需审计）。

硬规则：
- “前端隐藏 ≠ 权限”，敏感字段必须由后端按 access_mode 强裁剪（失败模式 A）。

---

## predicted 规则（必须写）

### 批次一致性（强制）

- `data_type=predicted` 时，L2 请求必须携带页面锁定的 `prediction_run_id`
- UI 不得在一次 Details 会话中切 run（除非显式切换 predicted 批次，并清空旧数据）

### claims 呈现（强制）

- claims 为事实表，只对应 historical（Step 30/33）
- predicted 下：
  - Details 允许展示 predicted 风险/天气证据
  - `claims` 信息必须为空或仅显示“无正式理赔事实”的解释（不得把 historical claims 拼进 predicted 证据链）

---

## 性能与缓存策略

### 请求治理（强制）

- 禁止触发 L2 的动作：hover、brush、layer toggle、panel snap（peek/half/full）
- 允许触发 L2 的动作：
  - `See more` / `Insight CTA: Open details`
  - Details 内显式分页加载（Load more）

### UI 性能（建议）

- Evidence List 必须虚拟化（避免 1000+ rows 卡死）
- 进入 Details section 不应导致地图掉帧（主舞台优先）

---

## 可观测性

必须形成链路（与 Step 20/33 对齐）：

- `ui_intent(open_details)` → `state_transition(panel_section=details)` → `dp_l2_evidence_query` → `dp_l2_response` → `ui_render_done(section=details)`

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `region_scope/region_code`
- `time_range`
- `data_type/weather_type/product_id`
- predicted：`prediction_run_id`
- `focus_type/focus_id`
- 列表体量（row_count/page_count）与耗时

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-数据面板基础结构.md`（L2 默认按需加载与分区思想）
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`（维度命名、DTO 分类、可观测字段）
- `docs/v2/v2复用逻辑摘录/RD-图表可视化.md`（UTC 时间轴回指）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（请求治理与虚拟化/降级）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（Mode 强裁剪与职责边界）

---

## 验收用例（可勾选）

### L2 闭环（必须）

- [ ] 通过 CTA 进入 Details，能看到证据链条目（风险↔理赔↔天气↔规则提示），且可回指 Timeline 与地图。

### 红线（必须）

- [ ] hover/brush/toggle 不触发 L2（0 重请求）。
- [ ] Demo/Public 下敏感字段不可获取（抓包可验证，后端裁剪生效）。
- [ ] predicted 不混批次，且 predicted 下不把 historical claims 拼进证据链。

### 性能（必须）

- [ ] 列表虚拟化 + 分页；大量条目时不阻塞 UI；面板展开不拖垮地图交互。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo/Public 抓包能拿到精确金额/可识别 id；Details 只是“不显示”。  
硬规则：后端强裁剪；前端只做禁用解释与降级 UX。

### 失败模式 B：predicted 混批次

症状：Details 里混用不同 run 的 predicted 证据，或把 historical claims 塞进 predicted 证据链。  
硬规则：L2 必须绑定 prediction_run_id；claims 仅 historical；不得跨 data_type 拼接。

---

## 风险与回滚策略

### 风险

- Details 默认加载明细或过大 page_size → 请求风暴/卡死（P0）
- Mode 裁剪缺陷 → 敏感泄露（P0）

### 回滚策略

- 强制收敛：Details 仅 CTA 触发 + 更小 page_size + 更严格体量上限
- 发现泄露：立即收紧 mode_policy_version 并回滚到保守策略；清理 L2 缓存与审计

