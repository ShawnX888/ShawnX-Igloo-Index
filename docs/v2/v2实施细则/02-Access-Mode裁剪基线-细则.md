# 02 - Access Mode 裁剪基线（后端输出裁剪规则）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 02  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Access Mode 裁剪基线（后端输出裁剪规则）

---

## 目标 / 非目标

### 目标

- 把 Access Mode（Demo/Public、Partner、Admin/Internal）从“前端显示开关”升级为**跨层契约**：后端强制裁剪 + 统一越权响应 + 审计。
- 固化三类裁剪维度，并要求在接口/数据产品层显式化：
  - **字段级裁剪**（敏感字段不可下发）
  - **粒度级裁剪**（明细→摘要、精确值→区间）
  - **能力级裁剪**（Compare/导出/分享/保存视图等动作集合）
- 把 Mode 影响写入五类数据产品：L0/L1/L2/Overlays/AI Insights。
- 明确“可见但不可用”的前端降级 UX 与后端强制裁剪的责任边界，避免演示断流。

### 非目标

- 不引入重型 IAM（租户/组织/角色/细粒度 ACL）作为 MVP 前置条件（可后续扩展）。
- 不在本细则中定义具体鉴权实现方式（JWT/Session/静态 token 等），只定义**必须可审计**的 Mode 来源与校验流程。

---

## 关联的数据产品（Data Product）

- L0 Dashboard：KPI/TopN 排名（Mode 决定口径、字段、粒度）
- L1 Region Intelligence：Overview/Timeline/Correlation（Mode 决定细节与默认展开）
- L2 Evidence：证据链明细（Mode 决定是否允许下发明细）
- Map Overlays：地图叠加层聚合（Mode 决定金额/粒度与 legend）
- AI Insights：洞察卡与 CTA（Mode 决定可说内容与可执行动作）

---

## 输入维度（最小集合）

> 本模块关注 `access_mode` 的来源、校验与传播，其他维度沿用 Shared Contract（Step 01）。

- `access_mode`（必填）
- 其他数据产品维度（region_scope/region_code/time_range/data_type/weather_type/product_id/prediction_run_id）

---

## 输出形态

### 1) 后端输出裁剪策略矩阵（必须产出）

以“数据产品 × Mode”的方式，定义：

- 允许输出的字段集合（field allowlist）
- 明细/聚合粒度（granularity policy）
- 允许的动作集合（capability allowlist）
- 默认展开策略（default disclosure policy，用于 FE 默认 UI）

### 2) 统一越权行为（必须产出）

对越权请求必须一致处理（两种方案择一并固化）：

- **方案 A（推荐）**：返回裁剪后的结果（不泄露敏感字段），并在 Meta 中说明“已裁剪（mode=xxx）”
- **方案 B**：直接拒绝（403/401），并返回可理解的错误码（但需要 FE 做演示兜底，避免断流）

> 路演/演示建议优先方案 A + FE “可见但不可用”。

---

## Mode 规则（必须写）

### Demo/Public（路演默认）

原则：少数字、强解释、强叙事；避免敏感数据泄露。

- **L0**
  - KPI/排名：允许范围化/区间化或相对强弱；避免精确金额（除非明确允许）
- **L1**
  - Timeline：允许展示趋势与阈值解释，但对敏感字段裁剪
- **L2**
  - Details：默认隐藏或仅提供聚合摘要（“1 风险 → 多理赔”摘要）
- **Overlays**
  - Claims overlay：仅聚合强弱/区间，避免精确金额与明细点位
- **AI**
  - 洞察内容：避免敏感数字与明细结论
  - CTA 动作：禁止导出/对比/深度明细；优先引导 Timeline/Correlation 的解释路径

### Partner（合作伙伴）

原则：更深 KPI/排行与有限下钻；明细需字段级脱敏。

- **L0/L1**：开放更细指标（仍受策略约束）
- **L2**：允许部分明细，但字段脱敏可配置（如隐藏内部 id、个人信息等）
- **Overlays**：可更细粒度，但必须避免过度暴露（尤其金额与身份字段）
- **AI**：可输出更细口径，但 CTA 仍需能力矩阵约束

### Admin/Internal（内部）

原则：全量口径、明细追溯、回放与审计（后续扩展）。

- **L2**：允许全量明细（仍需审计）
- **Overlays**：允许更细粒度
- **AI**：允许更深解释，但工具调用仍必须遵循服务端权限校验

硬规则：
- **前端隐藏不是权限**：后端必须执行裁剪。
- **Mode 必须影响 AI**：说什么、建议什么、能执行什么都必须受 Mode 限制。

---

## predicted 规则（必须写）

Mode 与 predicted 的交集规则（必须写入所有数据产品裁剪矩阵）：

- predicted 场景下，除批次一致性外，还要确保：
  - Demo/Public 下的裁剪策略仍生效（不能因为 predicted 走了另一套接口而泄露字段）。
  - AI 不得在 predicted 场景给出“正式理赔已发生/将发生”的误导表述（predicted 不生成正式 claims）。

---

## 性能与缓存策略

### 缓存 key 维度（强制）

- 所有缓存 key 必含 `access_mode`（否则会发生 Mode 串数据）。
- 对 predicted：缓存 key 必含 `prediction_run_id`（否则会发生混批次）。

### L2 的默认策略（与 Mode 强绑定）

- Demo/Public：默认不预取 L2（避免敏感与重查询）
- Partner/Admin：允许按需加载；仍建议默认不预取，避免请求风暴

---

## 可观测性

### 需要打点/日志的关键字段

- `access_mode`（必须）
- `mode_source`（建议）：mode 的来源类型（env/config/token/…）
- `mode_policy_version`（建议）：裁剪策略版本（用于审计与回滚）
- `fields_pruned`（建议）：裁剪字段列表或其 hash（避免日志过大）
- 其他维度：trace_id/correlation_id、region/time_range/data_type/weather_type/product_id/prediction_run_id

### 审计要求（必须）

- Mode 选择/切换必须可审计：何时/为何/谁/影响范围（至少在后端留痕）。

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`
- `docs/v2/v2复用逻辑摘录/RD-AI聊天窗与洞察联动.md`（AI 必须 Mode-aware）

### 来自 v1 的可复用资产（R0/R1）

- 仅复用“分级呈现与降级体验”的产品思路；不得复用任何 v1 中“前端隐藏=权限”的做法。

### 来自 v1 的可复用逻辑（R2）

- 不适用（v1 未存在 Access Mode 的后端强裁剪机制）。

### 不复用内容（R3）

- 任何通过抓包能拿到 Demo 禁止字段/明细的实现（视为 P0 缺陷，不可上线）。

---

## 验收用例（可勾选）

### 安全闭环（必须）

- [ ] Demo/Public 下无法通过接口获取敏感字段/明细（抓包可验证）。
- [ ] Partner 下字段脱敏策略可配置且生效。
- [ ] 越权请求行为一致（裁剪后返回或拒绝），且有可追踪的错误码/元信息。

### 一致性闭环（必须）

- [ ] 同一筛选条件下，L0/L1/L2 的字段裁剪策略一致（不出现“L0 隐藏但 L2 暴露”）。
- [ ] AI Insight 与 CTA 在不同 Mode 下只输出/建议该 Mode 允许的内容与动作。

---

## 风险与回滚策略

### 风险

- **失败模式 A：前端隐藏当权限** → 敏感数据泄露（P0）。
- Mode 裁剪策略分散在多个服务/接口 → 口径漂移，排障困难。

### 回滚策略

- Mode 裁剪策略必须版本化（mode_policy_version），可在生产快速切回“更保守”的策略版本。
- 如发现敏感字段泄露：立即将相关数据产品切到“强裁剪/仅聚合摘要”策略，并暂停对应能力（capability allowlist）。

