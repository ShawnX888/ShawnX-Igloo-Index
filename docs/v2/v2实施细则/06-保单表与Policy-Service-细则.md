# 06 - 保单表 + Policy Service（Policies）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 06  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

保单表（`policies`）+ Policy Service（保单权威源：覆盖区域/保额/时区/关联产品）

---

## 目标 / 非目标

### 目标

- 建立 v2 的保单权威数据源：`policies` 表 + Policy Service（CRUD + 查询 + 统计基础支撑）。
- 固化“保险业务时间敏感”的强约束：保单必须携带 `timezone`（风险发生地业务边界时区），用于：
  - Risk/Claims 的“per day/per month”判断
  - 时间轴口径统一（与 Step 04 一致）
- 支撑 L0/L1 数据产品的“保单存量口径”与基础统计（数量/保额）。
- 支撑 claims 计算：保额（Decimal）与产品关联（product_id）可追溯。

### 非目标

- MVP 不做投保人/组织信息的完整建模（避免 PII 合规复杂度），可先用 mock 或脱敏字段。
- 不在本细则中实现 claims 计算与并发控制（由 Phase 3 Claim Calculator/Claim Service 细则承接）。

---

## 关联的数据产品（Data Product）

- L0 Dashboard：Policies tab 的 KPI/TopN（按区域聚合）
- L1 Region Intelligence：区域保单概览（数量/保额等）
- L2 Evidence：证据链中与 claims/risk_event 关联时需要 policy 维度（Mode-aware）
- AI Insights：洞察生成时可能需要“覆盖保单基数”作为解释证据点

---

## 输入维度（最小集合）

### Policy 查询（对外/内部）

- `product_id`（可选）
- `region_scope` / `region_code`（可选；coverage_region 映射）
- `time_range`（可选：用于查询“与时间窗有重叠的保单存量”）
- `access_mode`（必填：返回字段必须裁剪）

### 与其他模块协作（必带）

- `policy_id` 或 `policy_number`
- `timezone`（必须）
- `coverage_amount`（Decimal）
- `coverage_start` / `coverage_end`（UTC）
- `product_id`

---

## 输出形态

### 1) Policy 列表（Mode-aware）

最小字段集（建议）：

- `id`
- `policy_number`（若对外暴露需考虑脱敏策略；Demo 可隐藏或摘要化）
- `product_id`
- `coverage_region`（至少包含 region_code/region_scope 或可映射字段）
- `coverage_start` / `coverage_end`（UTC）
- `coverage_amount`（Decimal；Demo 可区间化）
- `timezone`

### 2) Policy 统计（用于数据产品）

聚合输出（Aggregations）：

- policy_count
- coverage_amount_sum（Decimal）
- （可选）按产品/区域分组

---

## 接口策略（读写分离）

### 对外读路径（可公开）

- `GET /policies`（筛选 + 列表）
- `GET /policies/{id}`（详情）
- `GET /statistics/policies`（统计）

### 内部写路径（不对外公开）

- 保单写入/修复由内部任务或内部接口完成（不作为公开 API）
- 避免对外暴露 `POST/PUT/DELETE /policies` 造成口径污染
  
**责任归属**：
- 数据录入/修复：内部运维流程或后管工具
- 批量导入：专用任务或脚本（需审计与回滚策略）

---

## Mode 规则（必须写）

### Demo/Public

- 默认不下发可识别个人/组织的信息。
- policy_number、内部 id 等字段：
  - 可隐藏或仅返回摘要（例如 hash/尾号等）以支撑解释但不泄露。
- coverage_amount：
  - 可区间化/范围化（避免精确金额暴露）。

### Partner

- 可返回更细统计与部分字段，但需要字段级脱敏策略（可配置）。

### Admin/Internal

- 可返回更全字段与明细，但必须可审计（谁在什么 Mode 下查询了哪些字段）。

硬规则：
- **前端隐藏不是权限**：后端必须按 `access_mode` 裁剪输出。

---

## predicted 规则（必须写）

保单本身不随 predicted 变化，但与 predicted 的协作必须遵守：

- predicted 场景下，任何使用 policy 基数作为解释的输出必须明确：
  - 数据类型（predicted/historical）
  - 批次（prediction_run_id；若涉及 predicted 风险/叠加）
- 禁止把 predicted 风险推演“写入”保单事实字段（保单是 OLTP 事实数据）。

---

## 性能与缓存策略

### 索引/查询口径（需求级要求）

来自页面设计提案的 L0 存量口径提示：**保单统计口径是“保期与 time_range 有重叠（overlap）即计入”**（避免误读为销售趋势）。

工程化要求：

- Policy Service 必须提供“按 time_range overlap 的统计查询”能力（用于 L0/L1）。
- 缓存 key 必含：
  - `access_mode`
  - `region_scope/region_code`
  - `time_range`
  - `product_id`（如影响口径）

### Hover/交互红线（与 policies 相关）

- Hover 不得触发 policies 明细请求（只允许使用已加载的聚合结果）。

---

## 可观测性

每次 policy 查询/统计（尤其用于数据产品）必须记录：

- `trace_id/correlation_id`
- `access_mode`
- `region_scope/region_code`（如适用）
- `time_range`（如适用）
- `product_id`（如适用）
- 字段裁剪策略版本（mode_policy_version；见 Step 02）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md`（timezone 的业务意义）
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`

### 来自 v1 的可复用资产（R0/R1）

- 不适用（v1 纯前端无 policies 事实表）。

### 来自 v1 的可复用逻辑（R2）

- v1 “按时间窗解释风险/理赔”的展示逻辑思路可参考，但 v2 需要 policies 作为事实闭环的一环。

### 不复用内容（R3）

- 不允许用前端 mock policies 作为长期权威来源（会导致 claims/risk_events 无法审计闭环）。

---

## 验收用例（可勾选）

### 正确性（必须）

- [ ] policies 统计口径支持“保期与 time_range overlap 即计入”。
- [ ] policy 必须包含 timezone，且能被 Risk/Claims 引擎正确使用（按风险发生地时区判断自然日/月）。
- [ ] coverage_amount 全程 Decimal（DB/服务层/计算层）。

### Mode（必须）

- [ ] Demo/Public 下抓包无法拿到敏感字段（后端强裁剪）。
- [ ] Partner/Admin 下字段按矩阵开放且可审计。

---

## 风险与回滚策略

### 风险

- timezone 缺失或误用 UTC 边界 → per day/per month 判断错误，导致 claims 计算与解释全线不可信（P0）。
- Mode 裁剪不一致 → Demo 仍可获取明细字段（P0）。

### 回滚策略

- 发现 timezone 口径错误：优先回滚到更保守的功能（限制 L2 明细/精确金额输出），同时修复 timezone 来源与测试。
- 对历史数据修复需可回放：保留 policy timezone 与关键输入维度，支持重算与差异核对。

