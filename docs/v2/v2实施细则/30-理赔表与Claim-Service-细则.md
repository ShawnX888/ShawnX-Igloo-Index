# 30 - 理赔表 + Claim Service（Claims）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 30  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

理赔单表（`claims`）+ Claim Service（理赔权威源：仅历史生成、可追溯、Mode-aware 输出裁剪）

---

## 目标 / 非目标

### 目标

- 建立 v2 的理赔权威事实源：`claims` 表 + Claim Service（查询 + 内部创建/修复接口）。
- 明确与产品规则的职责边界（来自 `RD-产品库与规则契约.md`）：
  - claims 计算只消费 `payoutRules`
  - risk 计算只消费 `riskRules`（避免职责污染）
- 与 v2 三条红线对齐：
  - **权限旁路**：claims 明细与敏感口径必须由后端按 Mode 强裁剪
  - **预测混批次**：predicted 不生成正式 claims（v2 约束）
  - **交互风暴**：claims 明细属于 L2（默认按需加载），不能在高频交互下默认全量拉取
- 为后续 Step 32（理赔计算任务）提供幂等写入与并发安全基础（唯一约束/索引/可追溯字段）。

### 非目标

- 不在本细则实现理赔计算逻辑（由 Step 31 Claim Calculator 承接）。
- 不在本细则实现 L2 Evidence Data Product（由 Step 33 承接）。

---

## 关联的数据产品（Data Product）

本模块为以下数据产品提供事实输入：

- L0 Dashboard（Claims tab KPI/TopN，建议预聚合/强缓存）
- L1 Region Intelligence（Claims 泳道聚合序列，明细属于 L2）
- L2 Evidence（风险事件 ↔ 理赔关联明细，Mode-aware）
- Claims Overlay（前端图层，Mode-aware 聚合）

---

## 输入维度（最小集合）

### Claim 查询（对外/内部）

- `policy_id`（可选）
- `region_scope/region_code`（可选；用于聚合与过滤）
- `time_range`（可选；用于时间窗过滤）
- `product_id`（可选）
- `access_mode`（必填：决定字段/粒度/能力裁剪）

### Claim 写入（内部：任务/修复）

至少必须能记录（用于幂等与审计）：

- `policy_id`
- `product_id`
- `tier_level`
- `triggered_at_utc`（或 claim 归属的 period_end_utc）
- `payout_percentage`（Decimal）
- `payout_amount`（Decimal）
- `currency`（可选，默认与保单/产品约定）
- `source`（task/manual_repair/backfill…）
- `rules_hash/product_version`（来自产品规则）

---

## 输出形态

### 1) Claim 明细（Mode-aware）

建议最小字段集（按 Mode 裁剪）：

- `id`
- `policy_id`（Demo 可摘要化/不可逆）
- `product_id`
- `region_code`（用于 L2 回指/地图定位；或可由 policy/coverage_region 推导）
- `tier_level`（tier1/tier2/tier3）
- `triggered_at_utc`（UTC；或 `period_start_utc/period_end_utc`）
- `payout_percentage`（Decimal；Demo 可范围化或隐藏）
- `payout_amount`（Decimal；Demo 可区间化/隐藏）
- `status`（computed/approved/paid/voided…，可先最小化）
- `rules_hash/product_version`

### 2) Claim 聚合（用于数据产品）

Aggregations：

- claim_count
- payout_amount_sum（Decimal）
- （可选）按 tier/product/region 分组

---

## Mode 规则（必须写）

### Demo/Public

- 默认不返回可逆推的敏感字段：
  - `policy_id`：摘要化
  - `payout_amount`：区间化/范围化或不返回
  - 明细列表默认不暴露（由 L2 Evidence 决策：可仅摘要）

### Partner

- 允许更多字段，但仍需字段级脱敏（可配置）。

### Admin/Internal

- 可返回更全字段与更细粒度，但必须可审计（谁在什么 Mode 下查询了哪些字段）。

硬规则：
- 后端强裁剪；前端隐藏不算权限。

---

## predicted 规则（必须写）

硬规则（来自 `v2需求分析.md` 与 `RD-产品库与规则契约.md`）：

- **predicted 不生成正式 claims**（不写入 claims 表）。
- claims 表只存储 historical（事实记录）。

说明：

- predicted 场景下可以展示“预估理赔/模拟赔付”但必须是独立的数据产品与独立存储（不属于本表/本服务；后续如立项需单独细则）。

---

## 性能与缓存策略

- 明细查询（尤其按 policy/time_range）属于重查询：默认只在 L2 Evidence 按需加载。
- L0/L1 的 claims 指标必须优先预聚合/强缓存（避免明细 group-by 排名的性能坑）。
- 索引策略（建议，需结合 DB 设计）：
  - `policy_id`
  - `triggered_at_utc`（或 period_end_utc）
  - `region_code`
  - `product_id`
  - `tier_level`
  - `status`

### 幂等写入（强制）

为 Step 32（任务重试）做准备：

- 必须具备幂等键（建议至少包含：policy_id + product_id + tier_level + period_end_utc 或 trigger_risk_event_id）
- 必须具备唯一约束/或 upsert 语义，保证任务重试不产生重复 claims

---

## 可观测性

必须记录：

- `claim_create`（source=task/manual）
- `claim_upsert_conflict`（若命中幂等冲突）
- `claim_query`（Mode、返回粒度、耗时）

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `policy_id`（可摘要化）
- `product_id`
- `tier_level`
- `triggered_at_utc`（或 period）
- `rules_hash/product_version`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md`（payoutRules 边界与时区频次）
- `docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md`（per day/month 边界）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（Mode 强裁剪与职责隔离）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（明细重查询治理）

---

## 验收用例（可勾选）

### 数据闭环（必须）

- [ ] claims 可被创建（内部接口）并可查询；字段类型正确（金额 Decimal）。
- [ ] claims 可追溯产品规则版本（rules_hash/product_version）。

### Mode 闭环（必须）

- [ ] Demo/Public 下无法通过接口获取敏感明细/精确金额（后端裁剪可验证）。

### predicted 约束（必须）

- [ ] predicted 不写入 claims 表；任何预测赔付展示不污染事实表。

### 幂等与并发（必须）

- [ ] 任务重试不产生重复 claims（唯一约束/幂等写入生效）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 通过抓包仍能拿到 claims 明细或精确金额。  
硬规则：后端强裁剪 + 一致越权响应 + 审计。

### 失败模式 B：predicted 混批次

症状：把 predicted 模拟赔付写进 claims 表，导致事实污染与解释断裂。  
硬规则：claims 只存 historical；predicted 模拟必须独立链路/独立存储与标识。

---

## 风险与回滚策略

### 风险

- 明细查询被滥用 → 性能崩（P0/P1）。
- 幂等缺失 → 任务重试重复写入（P0）。

### 回滚策略

- 若重复写入：暂停任务 + 修复唯一约束/幂等键 + 清理重复数据（需审计脚本）。
- 若泄露：立即收紧 Mode 裁剪策略版本并回滚至安全口径。

