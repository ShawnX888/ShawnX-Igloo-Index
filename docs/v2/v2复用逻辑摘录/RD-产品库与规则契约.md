## 模块信息

- **模块名**: 产品库与规则契约（Products: riskRules vs payoutRules）
- **Reuse Type**: R1（概念复用 + v2 数据库/服务化重写）
- **Target Home**: BE（Product Service + DB `products`）+ Shared Contract + FE（产品选择/介绍页）
- **绑定验收锚点**: Data Product / Access Mode / Consistency / Observability

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/06-产品库基础结构.md`
- `docs/v1/08-产品库完整实现.md`
- `docs/v1/09-产品库与计算引擎协同.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 产品配置必须区分“两层规则”，且职责严格隔离

- **产品级规则 `riskRules`**：
  - 定义“什么情况触发风险事件、触发级别（tier1/2/3）、窗口/聚合/比较方式”；
  - 用于风险计算与可视化。
- **保单级规则 `payoutRules`**：
  - 赔付频次限制（如 once per day/month per policy）；
  - 赔付百分比/金额/上限等；
  - v1 强调其“可用于教育展示”，并明确与风险事件计算解耦。
- **关键隔离**：风险计算引擎只消费 `riskRules`，必须忽略 `payoutRules`。

### 2) `timeWindow` 的语义需要明确（避免产品类型与计算窗口混淆）

- `timeWindow.type` 是计算窗口单位（hourly/daily/weekly/monthly）。
- `timeWindow.size` 是窗口大小。
- `timeWindow.step`（可选）用于表示滑动步长：
  - 滑动窗口（例如 4 小时窗每小时滑一次）；
  - 固定窗口（例如自然月统计）可不设 step 或使其等价于固定周期。

### 3) `weatherType` 是独立维度，必须与规则一致

- 产品声明 `weatherType`，规则 `riskRules.weatherType` 必须一致，影响风险事件记录的 `weatherType` 字段。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) v2 的权威来源：DB `products` + Product Service（非前端静态文件）

- **产品配置必须后端可查询**（`GET /products`/`GET /products/{id}` 或等价 Data Product）。
- 每个产品必须可追溯版本（至少 `version` 或 `rules_hash`），用于：
  - 解释“为什么这次风险结果不同”；
  - 预测批次/口径审计。

### 1) 强制字段与一致性校验（产品写入/发布必须 gate）

**一致性校验（硬门槛）**：

- `products.weatherType` 必须与 `products.riskRules.weatherType` 一致（若两处都存在）。
- `riskRules.thresholds` 必须包含 tier1/tier2/tier3（顺序与比较方向可不同，但必须可解释）。
- `riskRules.calculation` 必须完整声明：
  - `aggregation`（sum/avg/max/min）
  - `operator`（>, >=, <, <=, ==）
  - `unit`（mm/celsius/...）
- `riskRules.timeWindow` 必须完整声明：
  - `type`（hourly/daily/weekly/monthly）
  - `size`（正整数）
  - `step`（可选，正整数）

### 2) `timeWindow.step` 的 v2 统一语义（必须写进 Shared Contract）

为避免 v1 的“文字解释”在不同实现中漂移，v2 需要把 `step` 语义固定为可计算契约：

- **滑动窗口（Sliding Window）**：
  - `step` 存在且 \(1 \le step < size\)；
  - 计算在时间轴上以 `step` 为步长滑动。
- **固定窗口（Fixed Window）**：
  - `step` 缺省，或 `step >= size`（具体取值规则由 v2 统一定义）；
  - 典型：`monthly` 自然月，按 `region_timezone` 的月边界对齐（见 `RD-时间与时区口径统一.md`）。

### 3) riskRules 与 payoutRules 的 v2 边界（必须）

- **Risk（产品级）**：
  - 输出 risk_events、聚合、解释（受 Access Mode 裁剪）。
  - 永远不产出“赔付金额/赔付次数”。
- **Claim（保单级）**：
  - 赔付频次限制必须按 `policy.region_timezone` 的自然日/月计算；
  - 金额计算必须使用 Decimal；
  - v2 约束：历史理赔基于确定性历史数据（predicted 不生成正式理赔）。
- **禁止**：在 risk 服务里“顺手”用 payoutRules 生成赔付金额（会污染职责与审计链路）。

### 4) Access Mode 对产品信息的裁剪（产品也是受控数据）

- Demo/Public：
  - 可只返回必要字段（id/name/icon/简述/可选：阈值范围），隐藏复杂 payoutRules 细节；
  - `payoutRules` 可仅返回“教育展示摘要”或完全不返回（由策略决定）。
- Partner/Admin：
  - 可返回完整规则用于审计/解释（仍需遵守敏感字段策略）。
- 规则：裁剪由后端完成并可审计（日志记录 `access_mode` 与裁剪策略）。

### 5) 可观测性（产品规则必须可追溯）

任何一次风险/统计/理赔计算链路都必须能记录：

- `product_id`
- `product_version` 或 `rules_hash`
- `riskRules.timeWindow`、`thresholds`（至少记录 hash/版本）
- `access_mode`
- `prediction_run_id`（如适用）

---

## 关联模块（约束落点）

- **强约束**：`RD-风险分析统一入口与聚合输出.md`（risk 服务只消费 riskRules）
- **强约束**：`RD-风险事件标记图层.md`（事件字段 product_id/weather_type/level 的一致性）
- **强约束**：`RD-时间与时区口径统一.md`（frequencyLimit 的自然日/月语义与时区）
- **建议联动**：`docs/v2/v2架构升级-全栈方案.md` 中的 `products` 表与 Product Service（作为权威源）

---

## 验收标准（Go/No-Go）

- **规则隔离**：
  - risk 计算路径不读取/不依赖 `payoutRules`；
  - claim 计算路径不依赖预测数据生成正式理赔。
- **契约稳定**：
  - `timeWindow.step` 的滑动/固定语义在不同产品上表现一致且可解释。
- **可追溯**：
  - 任意一个 risk_event 能追溯其产品规则版本（version/hash）。

---

## 反例（必须禁止）

- **反例 1**：产品配置里 `weatherType` 与 `riskRules.weatherType` 不一致，但系统仍运行。
- **反例 2**：risk 服务读取 `payoutRules` 并输出赔付金额（职责污染）。
- **反例 3**：`timeWindow.step` 语义不统一，导致同一产品在不同页面/服务中计算结果不同。

