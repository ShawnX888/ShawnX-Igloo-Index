# 05 - 产品表 + Product Service（Products）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 05  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

产品表（`products`）+ Product Service（产品配置权威源：riskRules / payoutRules）

---

## 目标 / 非目标

### 目标

- 建立 v2 的**产品配置权威源**：`products` 表 + Product Service，取代 v1 前端静态 productLibrary。
- 明确并强制执行 **riskRules 与 payoutRules 的职责隔离**：
  - riskRules：只用于 risk_events 触发与可视化
  - payoutRules：只用于 claims 计算与解释展示（且 predicted 不生成正式 claims）
- 支撑 FE 的 Product Selector：按 `weather_type` 动态过滤可选产品，单选 1 个产品叠加。
- 支撑可追溯性：产品规则必须可追溯版本（`version` 或 `rules_hash`），用于解释与审计。

### 非目标

- MVP 不做“后台可编辑产品配置”的完整 CMS（可先 seed 静态配置入库）。
- 不在本细则实现风险计算或理赔计算（分别由 Step 08 / Phase 3 的 Claim Calculator 承接）。

---

## 关联的数据产品（Data Product）

本模块为以下数据产品提供权威规则来源：

- L0 Dashboard（当 KPI/排行口径与产品相关时）
- L1 Region Intelligence（Risk 泳道与阈值/单位/tiers）
- L2 Evidence（风险事件解释时必须能追溯规则版本）
- Map Overlays（Risk overlays 的 legend/阈值解释）
- AI Insights（洞察必须能引用正确规则口径，且 Mode-aware）

---

## 输入维度（最小集合）

> 本模块作为“规则权威源”，自身查询主要维度是产品筛选维度；当被 Risk/Claims 依赖时，必须携带 Shared Contract 的关键维度用于审计。

### 产品查询（对外）

- `weather_type`（可选：用于过滤）
- `is_active`（可选：默认 true）
- `access_mode`（必须：产品规则也属于受控信息）

### 被其他模块调用（内部）

至少必须能记录：

- `product_id`
- `access_mode`
- （如适用）`data_type`、`prediction_run_id`（用于审计“解释链路”）

---

## 输出形态

### 1) Product 列表（用于 FE Product Selector）

最小字段集（建议）：

- `id`
- `name`
- `weather_type`
- `type`
- `icon`
- `description`（可选）
- `is_active`
- `version` 或 `rules_hash`

### 2) Product 详情（用于规则解释与计算引擎）

包含：

- `riskRules`（完整）
- `payoutRules`（按 Mode 裁剪；见下）
- 规则 meta：`version/rules_hash`、`updated_at`

---

## 接口策略（读写分离）

### 对外读路径（可公开）

- `GET /products`（筛选 + 列表）
- `GET /products/{id}`（详情）

### 内部写路径（不对外公开）

- 产品写入/更新通过 internal 接口完成（与 policies/claims/risk_events 保持一致的写策略）
- 仅 Admin/Internal 可调用，用于 seed/修复/回填
- 建议接口：
  - `POST /internal/products`
  - `PUT /internal/products/{id}`

---

## Mode 规则（必须写）

> 产品规则本身也可能包含敏感口径（尤其 payoutRules），因此必须后端 Mode-aware 裁剪。

### Demo/Public

- 产品列表：返回必要展示字段即可（id/name/icon/weather_type/type/简述/version）。
- 产品详情：
  - `riskRules`：允许返回（用于阈值解释与风险可视化）。
  - `payoutRules`：建议只返回“教育展示摘要”或不返回（由策略决定），避免让 Demo 暴露过深赔付细则。

### Partner

- 可返回更完整规则用于审计/对齐，但仍需字段级策略（例如隐藏内部备注/不对外字段）。

### Admin/Internal

- 可返回完整 riskRules + payoutRules（仍需审计）。

硬规则：
- **后端裁剪**：前端隐藏不算权限。

---

## predicted 规则（必须写）

产品规则本身不随 predicted 变化，但解释链路必须可追溯：

- risk_events / overlays / AI insights 在 predicted 下引用规则时，必须能记录：
  - `product_id`
  - `product_version` 或 `rules_hash`
  - `prediction_run_id`（predicted）

禁止：
- predicted 场景用“最新产品规则”去解释历史 risk_event（规则变化会导致解释失真）。最低要求是 **risk_event 记录规则 hash/version**（由 Step 09 承接字段落地）。

---

## 性能与缓存策略

### 产品规则缓存（后端）

- 产品列表与详情适合强缓存（产品变更频率低）。
- 缓存 key 必含：
  - `access_mode`（因为 payoutRules 可能裁剪不同）
  - `product_id`（详情）
  - `weather_type`/`is_active`（列表）

### 版本化策略（建议）

二选一（MVP 可先用 version）：

- `version`（可读版本号，便于人工审计）
- `rules_hash`（对 riskRules/payoutRules 做 hash，便于比对差异）

---

## 可观测性

必须能在风险/理赔/AI 链路中追溯产品规则：

- `product_id`
- `product_version` 或 `rules_hash`
- （建议）riskRules 的关键摘要（timeWindow/thresholds/calculation/unit）以 hash 形式记录，避免日志过大

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md`
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`

### 来自 v1 的可复用资产（R0/R1）

- 可复用 v1 产品配置结构思想（JSON 结构），但必须迁移到 DB + Service，且通过 v2 契约校验（weather_type 一致性、timeWindow 语义、tiers 完整）。

### 来自 v1 的可复用逻辑（R2）

- riskRules/payoutRules 的职责隔离与 timeWindow 语义可复用，但必须以 v2 统一语言固化，并由后端 gate 校验。

### 不复用内容（R3）

- 不复用“前端静态 products.ts 作为权威源”的模式。

---

## 验收用例（可勾选）

### 规则隔离（必须）

- [ ] Risk 计算路径只读取 riskRules，不读取 payoutRules。
- [ ] Claims 计算路径读取 payoutRules，但 predicted 不生成正式 claims。

### 契约与校验（必须）

- [ ] `products.weather_type` 与 `riskRules.weatherType`（如存在）一致，否则发布失败。
- [ ] `riskRules.thresholds` 包含 tier1/tier2/tier3。
- [ ] `riskRules.timeWindow` 完整声明 type/size/(step)，且 step 语义统一。

### Mode（必须）

- [ ] Demo/Public 下 payoutRules 不会被完整下发（按策略裁剪/摘要/不返回）。
- [ ] 不同 access_mode 的产品详情缓存不会串数据（cache key 含 access_mode）。

---

## 风险与回滚策略

### 风险

- 失败模式 A：产品接口在 Demo 下返回完整 payoutRules → 敏感口径外泄（P0）。
- 规则变更不追溯：导致 risk_event/AI 解释随版本漂移，出现“同一事件不同解释”（P0）。

### 回滚策略

- 产品规则发布必须可回滚（至少能切回上一版本或上一 rules_hash）。
- 一旦发现规则错误：优先下线产品（is_active=false）或回滚版本，并记录审计说明。

