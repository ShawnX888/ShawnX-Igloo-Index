# 34 - Claims Overlay（理赔叠加层 / 地图图层）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 34  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Claims Overlay（理赔叠加层）：Map Stage 上的“可渲染聚合”图层（消费 Map Overlays Data Product，Mode-aware）

---

## 目标 / 非目标

### 目标

- 在 Map Stage 上提供“理赔强弱”的空间表达，用于态势与解释补充：
  - province 视角：展示省内各 district 的 claims 强弱（推荐点位/气泡图，避免重 polygon）
  - district 视角：MVP 可先不下钻更细（以性能为先）
- 强制“数据产品化”与红线对齐：
  - 数据来源必须是 Map Overlays Data Product（Step 12）中的 claims overlays（**禁止**前端拿 claims 明细二次聚合）
  - hover 只做 UI 高亮/tooltip（≤3 指标），不得触发 L2
  - layer toggle 默认只影响呈现；需要刷新 overlays 时必须节流
- Mode-aware：
  - Demo/Public：只显示区间/强弱（避免暴露精确金额）
  - Partner/Admin：允许更细聚合（仍需脱敏/审计策略）

### 非目标

- 不在本图层加载/展示 L2 证据链明细（由 Step 33/35 承接）。
- 不在本图层调用任何 Google Maps web service APIs（避免 key 暴露与合规风险；若有需要必须走后端代理）。

---

## 关联的数据产品（Data Product）

- Map Overlays（Step 12）：Claims overlays + legend/meta（唯一事实源）
- L0/L1：tooltip 可复用 overlays 轻量指标（但不得触发重请求）

---

## 输入维度（最小集合）

来自 UI Orchestration（Step 20）的状态域：

- `region_scope` / `region_code`
- `time_range`
- `data_type`
- `weather_type`（不一定影响 claims，但作为全局维度必须进入 query key，避免串用）
- `product_id`（通常不影响 claims，但同理进入 key）
- `access_mode`
- predicted：`prediction_run_id`

图层控制维度：

- `layer_id = "claims_overlay"`（建议入 Shared Contract 的 layer_id 枚举）
- `layer_state.on/off`

---

## 输出形态（渲染输入）

> 输出来自 Overlays DP。前端只做“join + style”，不做口径计算。

渲染数据建议最小字段集：

- `region_code`
- `value`（聚合强度；Demo 可用 bucket/ordinal）
- `bucket`（推荐：Demo/Public 输出）
- （可选）`center`（lat/lng；来自 centers 数据集，用于点位渲染）

Legend/Meta（必须展示/可用于 tooltip）：

- `time_range`
- `data_type`
- `access_mode`
- claims 口径说明（是否区间化/是否隐藏金额）

---

## Mode 规则（必须写）

### Demo/Public

- 默认仅展示：
  - claim_count（或其 bucket）
  - payout_amount_sum：禁止精确值（可不返回或仅 bucket/强弱）
- tooltip（≤3 指标）：
  - 建议只显示“理赔强弱/次数/趋势提示”，不显示精确金额

### Partner

- 可展示更细聚合值，但仍需脱敏策略（例如金额范围化）。

### Admin/Internal

- 可展示更细聚合值（仍需审计与告警）。

硬规则：
- 裁剪必须在后端（Overlays DP）完成；前端不得自行“隐藏=权限”。

---

## predicted 规则（必须写）

硬规则（与 Step 30/31/33 一致）：

- claims 为历史事实：**predicted 不生成正式 claims**

因此前端策略必须固定：

- 当 `data_type=predicted`：
  - Claims Overlay 必须为“可见但不可用（disabled）”状态（与 `RD-图层控制与联动边界.md` 一致）
  - tooltip 解释：predicted 下无正式理赔事实，可切回 historical 查看
- 禁止在 predicted 视图下“偷偷叠加 historical claims”以填充图层（会造成口径混用与解释断裂）

---

## 合规与安全（强制）

### Key 安全（提醒性，但必须写进工程基线）

- Web service API keys 不应暴露在浏览器；需要时使用后端代理与 IP 限制 key（官方建议）：
  - `https://developers.google.com/maps/api-security-best-practices?utm_source=gmp-code-assist`

### Web service 内容与缓存限制（提醒性）

- 若未来引入 Geocoding/Places 等 web service 结果用于 UI 文本，必须遵守对应 policies 与缓存限制（place_id 例外等）：
  - `https://developers.google.com/maps/documentation/geocoding/policies?utm_source=gmp-code-assist`

> 本步骤的 Claims Overlay 数据来自自有 claims 聚合，不涉及直接使用 Google web service Content；但仍必须遵守 Maps JS API 的 attribution 与条款，不得移除/遮挡。

---

## 性能与缓存策略

### 请求策略（强制）

- 默认：Claims Overlay 不单独触发请求，依赖 Overlays DP 的合并响应（更易缓存、避免风暴）
- 若支持按 layer_id 拉取 overlays：
  - toggle 触发 overlays 刷新必须节流/去抖（不得每次点击都打满请求）

### 渲染策略（建议）

- 优先点位/气泡图（join region_code → center），避免对 polygon 做大规模 fill（与 weather heatmap 叠加时更稳定）
- 大量点位时：
  - 限制最大可见点数量或抽样
  - 低性能设备/移动端降级（见 RD-性能优化.md）

---

## 可观测性

必须记录：

- `layer_toggle`（claims_overlay on/off）
- `dp_overlays_request`（若触发；命中缓存/耗时）
- `ui_render_done`（渲染完成；可选记录点数/帧率告警）

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `region_scope/region_code`
- `time_range`
- `data_type/weather_type/product_id`
- predicted：`prediction_run_id`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-图层控制与联动边界.md`（toggle/禁用态/联动边界）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（渲染与节流、移动端降级）
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`（维度与 layer_id 枚举建议）

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] historical 下 Claims Overlay 可渲染（点位/强弱），legend/meta 解释清晰。
- [ ] tooltip ≤3 指标且来自已加载/缓存数据（不触发 L2）。

### Mode（必须）

- [ ] Demo/Public 下不展示精确金额（后端已裁剪/区间化；抓包可验证）。

### predicted（必须）

- [ ] predicted 下 Claims Overlay 为禁用态且解释清晰；不混用 historical claims 填充。

### 性能（必须）

- [ ] toggle/brush 不产生 overlays 请求风暴；地图主舞台不掉帧（可观测可证明）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo/Public 仍能通过 overlays 返回精确金额或可反推明细的信息。  
硬规则：Overlays DP 后端强裁剪；前端仅做“禁用解释”与样式弱化。

### 失败模式 B：predicted 混批次

症状：predicted 视图下叠加 historical claims 造成口径混用；或 overlays 缓存串用不同 run。  
硬规则：predicted 下 claims overlay 禁用；Overlays 缓存 key 必含 prediction_run_id（predicted）与 access_mode。

---

## 风险与回滚策略

### 风险

- 明细误用：前端改为拉 claims 明细聚合 → 性能崩 + 泄露风险（P0）
- 叠加视觉干扰：与 weather heatmap 同时开启导致信息过载（P1）

### 回滚策略

- 优先回滚为“只显示 bucket/强弱”版本，减少渲染负担与敏感暴露
- 若性能不达标：强制关掉 claims overlay 默认开启，改为手动开关 + 更严格节流

