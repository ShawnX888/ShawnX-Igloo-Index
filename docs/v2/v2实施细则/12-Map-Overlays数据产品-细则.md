# 12 - Map Overlays Data Product（地图叠加层）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 12  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Map Overlays Data Product（Weather/Risk/Claims/Thresholds 的可渲染聚合结果 + Legend 元信息）

---

## 目标 / 非目标

### 目标

- 为 Map Stage 提供“可直接渲染”的聚合输出，避免前端拿海量明细二次聚合导致掉帧。
- 覆盖基础叠加层：
  - Weather overlays（historical/predicted 分层表达）
  - Risk overlays（与产品 riskRules 绑定：tiers/thresholds/unit）
  - Claims overlays（Mode-aware：Demo 仅聚合/弱化金额）
  - Thresholds overlays（阈值提示层，解释用）
- 强缓存优先，支撑高频交互：
  - 缓存命中 p95 < 800ms
- Legend/Meta 必须完整、可解释、可审计：
  - 单位、阈值、tiers、data_type、(predicted) prediction_run_id、口径说明

### 非目标

- 不在本数据产品中返回 L2 明细（证据链由 L2 Evidence Data Product 提供）。
- 不实现前端图层/粒子效果与 WebGL 细节（FE Map Stage 细则承接）。

---

## 关联的数据产品（Data Product）

本模块本身就是 Data Product：**Map Overlays**。

同时影响：

- L0/L1 的 hover tooltip（禁止 hover 触发重请求，因此 tooltip 应尽量来自 overlays 轻量数据）
- AI Insights（需要 overlays 的 legend/口径作为解释补充）

---

## 输入维度（最小集合）

来自 `v2需求分析.md` 的强制维度：

- `region_scope`（province/district）
- `region_code`（可选：若 overlays 支持“全省范围 + 细分 district”聚合，则 region_code 表示当前省域）
- `time_range`
- `data_type`（historical/predicted）
- `weather_type`
- `product_id`（可选，但 Risk overlays 通常需要）
- `access_mode`
- `prediction_run_id`（predicted 必须；或由 active_run 解析后回填）

---

## 输出形态

### 1) 渲染聚合（必须可直接喂给地图）

至少支持“按 region_scope 的区域聚合”：

- province 级：省内各区县聚合（或省级聚合视需求）
- district 级：区县内聚合（MVP 可先不做更细）

输出建议包含：

- `region_code`
- `value`（聚合值：例如降雨强度/风险强度/理赔强弱）
- （可选）`bucket`（区间化后的档位，用于 Demo 模式）
- （可选）`geometry_ref`（前端如何定位渲染区域：由 region_code 与边界数据映射）

### 2) Legend/Meta（强制）

每个 overlay 必须包含：

- `unit`
- `data_type`
- `weather_type`
- `product_id`（如适用）
- `prediction_run_id`（predicted）
- `tiers/thresholds`（risk overlays 或 thresholds overlays）
- `access_mode`
- 口径说明（time_range、聚合方式、是否区间化）

---

## Mode 规则（必须写）

### Demo/Public

- 重点：避免暴露敏感金额粒度与可反推明细的信息。
- Claims overlays：
  - 默认只输出“强弱/区间”或聚合摘要（不输出精确金额点位）
- Risk/Weather overlays：
  - 可正常输出（用于解释），但仍可做粒度降级（例如仅日级聚合）

### Partner

- 可输出更细的聚合值，但仍需避免过度暴露（尤其 claims 的精确金额到小区域）。

### Admin/Internal

- 可输出更细粒度聚合（仍需审计）。

硬规则：
- **后端裁剪**：前端隐藏不算权限。

---

## predicted 规则（必须写）

- predicted overlays 必须绑定 `prediction_run_id`（或由 active_run 解析并回填）。
- 缓存 key 必含 `prediction_run_id`，避免混批次（失败模式 B）。
- Legend 必须体现 prediction_run_id 与口径（避免 UI/AI 解释断裂）。

---

## 性能与缓存策略

### SLO（需求级）

- Overlays（缓存命中）：p95 < 800ms
- 地图交互优先：pan/zoom/hover 不掉帧（后端需要保证响应稳定 + 前端避免重计算）

### 缓存 key（强制）

至少包含：

- `region_scope`、`region_code`
- `time_range`
- `data_type`
- `weather_type`
- `product_id`（如适用）
- `access_mode`
- `prediction_run_id`（predicted）

### 分层策略（建议）

- 与缩放级别相关的 overlays 可以分层缓存（MVP 可先按 region_scope 做两层：province/district）。

---

## 可观测性

必须记录：

- `trace_id/correlation_id`
- `access_mode`
- `region_scope` / `region_code`
- `time_range`
- `data_type` / `weather_type`
- `product_id`（如适用）
- `prediction_run_id`（predicted）
- 缓存命中率、命中/失效原因（active_run 切换、mode_policy_version 变更）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-风险分析统一入口与聚合输出.md`
- `docs/v2/v2复用逻辑摘录/RD-图层控制与联动边界.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`

### 来自 v1 的可复用资产（R0/R1）

- 图层体系与 legend 的表达思路可复用，但 v2 必须把聚合放到服务端输出，前端只渲染。

### 来自 v1 的可复用逻辑（R2）

- 不适用（Overlays 作为数据产品是 v2 的系统化产物）。

### 不复用内容（R3）

- 不复用“前端拿明细做二次聚合/二次分桶”的路径（性能与审计风险高）。

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] Weather/Risk/Claims/Thresholds overlays 至少支持基础开关所需的输出形态。
- [ ] Legend 清晰表达单位/阈值/tiers/data_type；predicted 额外体现 prediction_run_id。

### 性能（必须）

- [ ] 缓存命中 p95 < 800ms（以日志/压测证明）。
- [ ] hover 不触发 overlays 的“重计算型请求风暴”（节流与缓存生效）。

### Mode / 批次（必须）

- [ ] Demo/Public 下 claims overlays 不暴露精确金额粒度（区间化/强弱化）。
- [ ] predicted 下不混批次（cache key 含 run_id，响应显式回填 run_id）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo/Public 抓包仍能拿到 claims 精确金额/可反推明细信息。  
硬规则：**BE 强裁剪**（字段/粒度）+ 审计。

### 失败模式 B：predicted 混批次

症状：active_run 已切换，但 overlays 仍命中旧 run 缓存，地图展示与 AI 解释断裂。  
硬规则：cache key 必含 prediction_run_id；切换触发缓存隔离/失效；响应显式回填 run_id。

---

## 风险与回滚策略

### 风险

- Overlays 走 OLTP 明细聚合 → 数据量上来后端与前端都崩（P0）。
- Demo 下 claims 粒度过细 → 敏感信息泄露（P0）。

### 回滚策略

- 性能不达标：优先降级 overlays 输出粒度（例如只出 bucket/强弱），并提高缓存/预聚合强度。
- 泄露风险：立即切换到更保守的 Mode 裁剪策略版本（mode_policy_version），并下线相关 overlays 细粒度能力。

