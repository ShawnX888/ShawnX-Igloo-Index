# 31 - Claim Calculator（Tier 差额理赔计算内核 / 纯计算）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 31  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Claim Calculator（理赔计算内核）：Tier 差额逻辑 + 频次限制（per day/month）+ Decimal 精度 + 时区边界（region/policy timezone）

---

## 目标 / 非目标

### 目标

- 以“纯计算模块”形式实现理赔计算内核：
  - 输入：policy（保额/时区/保障期）+ 产品 `payoutRules` + 风险事件（historical）+ 时间窗参数
  - 输出：ClaimDraft[]（可写入 claims 表的理赔草稿/结果）
- 强制职责隔离：
  - Claim Calculator 不依赖 DB Session、不做 IO、不做缓存、不做 Mode 裁剪
  - 取数/幂等写入/并发控制/审计由 Claim Service + Celery 任务承接（Step 30/32）
- 金融精度与业务时区红线：
  - 金额/比例全部使用 `Decimal`（禁止 float）
  - 频次限制（once per day/month per policy）必须按 `policy.timezone`（风险发生地时区）判定自然日/月边界
- 幂等友好：
  - 计算输出必须包含可用于幂等写入的“业务主键”（例如 period_end + tier + policy_id + product_id）

### 非目标

- 不生成 predicted 赔付（v2 约束：predicted 不生成正式 claims）。
- 不处理复杂“跨多时区覆盖”的保单（若出现需单独扩展）。

---

## 关联的数据产品（Data Product）

Claim Calculator 的输出通过 claims 表供给：

- L0 Dashboard（Claims tab 聚合）
- L1 Region Intelligence（Claims 泳道聚合序列）
- L2 Evidence（风险事件 ↔ 理赔关联明细）

---

## 输入维度（最小集合）

> 这里是“计算输入”，不是对外 API 参数；对外维度由 Shared Contract 固化，任务/服务层负责组装。

- `policy`：
  - `policy_id`
  - `product_id`
  - `coverage_amount`（Decimal）
  - `coverage_start_utc` / `coverage_end_utc`
  - `timezone`（IANA；用于自然日/月边界）
- `payoutRules`（必须完整，且只来自 Product Service）：
  - tier1/tier2/tier3 payout percentage / amount（按规则定义）
  - frequencyLimit（once per day/month per policy 等）
  - maxPayoutCap（若有）
- `risk_events[]`（historical，且与 policy/product 口径一致）：
  - `event_time_utc`
  - `tier_level`
  - `rules_hash/product_version`（用于追溯）
- `time_range`（UTC；展示窗，用于输出裁剪或过滤本次结算范围）
- `region_timezone`（应等于 policy.timezone；用于显式校验）

---

## 输出形态

### ClaimDraft（建议最小字段集）

- `policy_id`
- `product_id`
- `tier_level`
- `triggered_at_utc`（或 `period_start_utc/period_end_utc`）
- `payout_percentage`（Decimal）
- `payout_amount`（Decimal）
- `rules_hash/product_version`
- `idempotency_key`（字符串或结构化字段组合；供写库唯一约束）
- （可选）`trigger_risk_event_id` / `evidence_risk_event_ids[]`（用于 L2 追溯）

### 输出裁剪（必须）

- Claim Calculator 可以接收扩展的历史事件列表，但输出必须可按 `time_range` 过滤（由调用方决定“本次结算范围”）。

---

## Mode 规则（必须写）

Claim Calculator 不做 Mode 裁剪，但必须输出下游裁剪需要的 meta：

- `tier_level`
- `rules_hash/product_version`
- `idempotency_key`（内部可用，是否对外展示由服务层决定）

---

## predicted 规则（必须写）

硬规则：

- Claim Calculator 只计算 historical（事实理赔），不得在 `data_type=predicted` 时输出可写入 claims 的结果。
- 若需要“模拟赔付/预测赔付”，必须单独模块与单独存储/标识（不在本细则范围）。

---

## 计算规则（核心）

### 1) Tier 差额逻辑（必须可解释）

推荐口径（可根据产品 payoutRules 细化，但必须一致且可追溯）：

- 对同一“频次周期”（day/month）内，若出现多个 tier 触发：
  - 只赔付最高 tier 的“累计应赔付”，并扣除已在同周期内支付过的较低 tier（避免重复计赔）
  - 或按 payoutRules 明确的“叠加/覆盖”策略执行（必须在产品规则中声明）

> 注意：本细则只固化“差额避免重复赔付”的原则；具体叠加策略必须由 payoutRules 明确并版本化。

### 2) 频次限制（必须）

典型：once per day/month per policy

- 以 `policy.timezone` 将 `event_time_utc` 映射到本地自然日/自然月，判定是否已赔付过
- 自然日/月边界不能用 UTC（见 Step 04）

### 3) 保额与上限（必须）

- payout_amount 计算必须以 Decimal：
  - `payout_amount = coverage_amount * payout_percentage`
  - 如有 cap：`min(payout_amount, cap_remaining)`
- 永不超过保单总上限（若 payoutRules 定义）

### 4) 保障期过滤（必须）

- 风险事件必须落在保单保障期内（或与保障期有明确 overlap 规则），否则不计算理赔

---

## 性能与执行策略

### CPU 隔离（强制）

禁止：

- 在 FastAPI `async def` 路由中直接跑批量 Claim Calculator

允许（由调用方选择）：

- 轻量试算：线程池（严格预算）
- 批量结算：Celery 任务（Step 32）

---

## 可观测性

必须记录（由调用方/任务层记录，Calculator 需返回可记录字段）：

- `policy_id`
- `product_id`
- `rules_hash/product_version`
- 输入 risk_events 数量、输出 claims 数量
- frequency 窗口命中信息（day/month key，建议摘要）
- 失败原因（例如 timezone 缺失、规则不完整）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md`（payoutRules/frequencyLimit/Decimal/时区边界）
- `docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md`（自然日/月边界）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（CPU 隔离与职责边界）

---

## 验收用例（可勾选）

### 正确性（必须）

- [ ] tier 差额逻辑生效：同周期内 tier3 触发会覆盖/抵扣 tier1/tier2，避免重复赔付。
- [ ] frequencyLimit 生效：once per day/month 的边界按 policy.timezone 判定（非 UTC）。
- [ ] 金额精度正确：全链路 Decimal，无 float。

### predicted 约束（必须）

- [ ] predicted 不生成可写入 claims 的结果（事实表不被污染）。

### 幂等友好（必须）

- [ ] 输出包含可用于幂等写入的 idempotency_key（任务重试不产生重复 claims）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：把理赔计算结果当作前端展示逻辑，或把敏感口径直接返回给 Demo。  
硬规则：Calculator 只产内部结果；对外展示必须通过数据产品/Mode 裁剪。

### 失败模式 B：predicted 混批次

症状：用 predicted 风险事件生成正式 claims，导致事实污染与解释断裂。  
硬规则：claims 只对应 historical；predicted 必须独立链路与标识。

---

## 风险与回滚策略

### 风险

- 时区边界错误 → 赔付次数/周期判断错误（P0）。
- 幂等键不稳定 → 任务重试产生重复 claims（P0）。

### 回滚策略

- 修复规则后重跑回溯：以幂等键确保可重复执行；必要时作废/重算（需审计）。
- 若发现时区口径错：优先回滚到“更保守的频次策略”并阻断自动任务，避免扩大污染面。

