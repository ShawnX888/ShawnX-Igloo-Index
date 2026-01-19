# 11 - L0 Dashboard Data Product（省级态势）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 11  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

L0 Dashboard Data Product（省级态势：KPI + TopN 排名，Combined/Policies/Claims）

---

## 目标 / 非目标

### 目标

- 提供 L0“10 秒看懂态势”的后端权威数据产品输出：
  - Combined / Policies / Claims 三个视角
  - 每个视角：3–5 KPI + Top5（或 TopN）排名 +（可选）轻量趋势
- 强缓存/预聚合优先，支撑路演/高频交互：
  - 缓存命中 p95 < 500ms
- Ranking Click 作为导航入口：输出必须支持“排行榜 → 地图锁区”联动（包含 region_code 与必要 meta）。
- Mode-aware：Demo/Public 下隐藏敏感口径与字段；Partner/Admin 逐步开放。

### 非目标

- 不在 L0 返回明细（L2 才是证据链入口）。
- 不在 L0 做复杂相关性分析（Correlation 属于 L1/L2）。

---

## 关联的数据产品（Data Product）

本模块本身就是 Data Product：**L0 Dashboard**。

同时为 AI Insights 提供输入（洞察卡证据点）：

- AI Insights（依赖 L0 的 KPI/TopN）

---

## 输入维度（最小集合）

来自 `v2需求分析.md` 的强制维度：

- `region_scope=province`
- `region_code`（省级范围或“全局省域”标识；按实现约定）
- `time_range`
- `data_type`（historical/predicted）
- `weather_type`（可选）
- `access_mode`
- `prediction_run_id`（predicted 必须；或由 active_run 解析后显式回填）

---

## 输出形态

### 1) KPI（Aggregations）

- 每个 Tab（Combined/Policies/Claims）输出 3–5 个 KPI（可配置）。
- 每个 KPI 必须带：
  - 数值（可能被 Mode 裁剪为区间）
  - 单位（或说明）
  - 口径说明（time_range/data_type/weather_type/product 影响）

### 2) TopN 排名（Aggregations）

- TopN 条目必须包含：
  - `region_code`（用于 Map fly-to + lock）
  - `rank`
  - 指标值（Mode 可裁剪为区间/强弱）
  - 必要的比较维度（如占比/同比，MVP 可不做）

### 3) Meta/Legend（必须）

- `time_range`（UTC）
- `data_type`
- `access_mode`
- `prediction_run_id`（predicted）
- （如受 weather_type/product 影响）输出必须明确口径
- **claims 可用性（强制）**：
  - `claims_available`（bool，字段名最终以 Shared Contract 为准）
  - `claims_unavailable_reason`（string，建议：`not_implemented_until_phase_3`）

> 说明（强制口径）：Phase 1/2 的 L0 不依赖 claims 表（Step 30 在 Phase 3），因此 L0 的 Claims tab 必须以“可见但不可用（disabled/placeholder）”形态返回，且必须显式声明 `claims_available=false`，禁止通过其他事实（risk_events）伪造 claims 聚合。

---

## Mode 规则（必须写）

### Demo/Public

- KPI/排名允许范围化/区间化，避免精确金额等敏感口径。
- 禁止输出可被反推敏感明细的字段（例如过细粒度金额、内部 id）。

### Partner

- 开放更细 KPI/排名，但明细仍应受控（不落到 L2 明细级）。

### Admin/Internal

- 可返回更全 KPI/排名口径（仍需审计）。

硬规则：
- **后端强裁剪**：前端隐藏不算权限（失败模式 A）。
 - **不可用能力必须可解释**：当 `claims_available=false` 时，Claims tab 必须返回占位输出 + meta 解释，不得返回空结构导致前端误判为“接口异常”。

---

## predicted 规则（必须写）

- predicted L0 请求必须绑定 `prediction_run_id`（或由 active_run 解析并回填）。
- L0 的缓存 key 必含 `prediction_run_id`，避免混批次（失败模式 B）。
- L0 输出必须在 Meta 中显式给出 run_id，供 FE/AI 在同一时间轴叙事中对齐。
 - predicted 与 claims 可用性必须正交：
  - 即使 `data_type=historical`，Phase 1/2 仍可能 `claims_available=false`（因为 claims 域未落地）
  - 任何情况下禁止 AI/前端在 `claims_available=false` 时输出/推断 claims 结论

---

## 性能与缓存策略

### 缓存策略（强制）

L0 属于高频背书数据，必须强缓存/预聚合：

- 目标：缓存命中 p95 < 500ms
- 缓存 key 必含：
  - `region_scope`、`region_code`
  - `time_range`
  - `data_type`
  - `weather_type`（若影响口径）
  - `access_mode`
  - `prediction_run_id`（predicted）

### 交互红线（必须）

- Map Hover 不触发 L0 重请求（Hover 轻交互 0 重请求）。
- 时间刷选/切换（time_range/weather_type）需节流，并尽量复用缓存。

---

## 可观测性

必须记录：

- `trace_id/correlation_id`
- `access_mode`
- `time_range`
- `data_type`
- `prediction_run_id`（predicted）
- 缓存命中/失效原因（尤其 active_run 切换）
- 输出口径摘要（如是否区间化、是否隐藏金额）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-风险分析统一入口与聚合输出.md`（统一入口与聚合输出）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（L0 强缓存/预聚合）

### 来自 v1 的可复用资产（R0/R1）

- 可复用“排行榜作为导航入口”的交互思想，但 v2 必须由后端输出稳定的 TopN 数据产品（避免前端自行 group-by）。

### 来自 v1 的可复用逻辑（R2）

- 不适用（L0 作为数据产品形态属于 v2 系统化产物）。

### 不复用内容（R3）

- 不复用“前端拿明细做 group-by 排名”的路径（性能与审计风险高）。

---

## 验收用例（可勾选）

### 功能闭环（必须）

- [ ] Combined/Policies/Claims 三个 Tab 的 KPI + Top5 可用（Phase 1/2 允许 Claims 为 disabled/placeholder，但必须可解释且不误导）。
- [ ] Top5 点击可驱动 Map fly-to + lock（至少能通过 region_code 定位）。

### 性能闭环（必须）

- [ ] 缓存命中 p95 < 500ms（以压测/日志证明）。
- [ ] 高频切换（区域/时间/天气）无请求风暴（节流生效）。

### Mode / 批次闭环（必须）

- [ ] Demo/Public 下敏感字段不可通过接口获取（后端强裁剪）。
- [ ] predicted 场景响应显式带 prediction_run_id，且不混批次。
 - [ ] 当 `claims_available=false`：响应 meta 明确声明不可用原因；Claims tab 不返回伪造聚合；前端可稳定渲染“不可用”状态。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo/Public 抓包仍能拿到精确金额/敏感字段。  
硬规则：**BE 强裁剪** + 一致越权响应 + 审计。

### 失败模式 B：predicted 混批次

症状：L0 命中旧 run 缓存但页面已切换新 run，导致解释断裂。  
硬规则：cache key 必含 prediction_run_id；active_run 切换触发缓存隔离/失效；响应显式回填 run_id。

---

## 风险与回滚策略

### 风险

- L0 若不强缓存：首屏慢、路演翻车（P0）。
- L0 若用明细聚合：数据量上来性能崩（P0/P1）。

### 回滚策略

- 性能不达标：先降级输出（减少 KPI/TopN 复杂度、关闭轻趋势），并提高缓存 TTL/预聚合强度。
- 若出现错口径/泄露：立即收紧 Mode 裁剪策略并回滚到保守版本。

