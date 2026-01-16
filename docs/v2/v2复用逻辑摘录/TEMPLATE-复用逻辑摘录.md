# 复用逻辑摘录（Reuse Digest）— <模块名>

> 状态：Draft / Verified  
> 目的：从 v1 实施细则中提取“可复用逻辑与要求”，完成 v2 化重述，供后续 `v2实施细则` 直接引用。  
> 注意：本文档允许记录 v1 来源线索，但 **禁止**在 v2 实施细则中直接引用 v1 文档路径或段落作为依据。

---

## 1. 模块元信息（必填）

- **模块名**：`<模块名>`
- **在迁移矩阵中的条目**：`docs/v2/v2迁移分层矩阵.md` 中的对应行（复制模块名即可，不要粘贴 v1 文档）
- **Reuse Type**：R0 / R1 / R2 / R3
- **Target Home**：FE / BE / Shared Contract / Infra
- **绑定验收锚点**：
  - Data Product：L0 / L1 / L2 / Overlays / AI Insights（填写具体项）
  - Access Mode（是否涉及）：是/否
  - Prediction Run（是否涉及 predicted）：是/否
  - Perf/SLO（是否高频交互）：是/否
  - Compliance（是否涉及 Google Maps / 成本）：是/否
  - Observability（是否必须审计/追踪）：是/否

---

## 2. v1 输入材料（仅作线索，禁止当真源）

> 仅记录“你看过哪些 v1 资料”，用于回溯，不用于 v2 口径裁决。

- **v1 来源线索**：
  - 文件/章节：`<可写 docs/v1/... 的路径与章节>`
  - 备注：`<这一来源提供了什么逻辑/要求>`

---

## 3. 可复用逻辑与要求（必须“完整重述”）

> 把 v1 的可复用逻辑/约束用自己的话写完整，避免信息丢失。  
> 禁止只写“同 v1”或“参考 v1”。

### 3.1 业务规则（Business Rules）
- **规则 1**：
  - 触发条件：
  - 边界情况：
  - 失败/降级：
- **规则 2**：
  - ...

### 3.2 交互规则（Interaction Rules）
- Hover/Click/Brush/Toggle 的边界（特别是：Hover 是否允许触发请求）
- 需要节流/防抖的动作

### 3.3 数据口径与维度（Semantic Contract）
- 口径定义（例如：存量/增量、overlap 统计口径等）
- 必须使用的维度（region_scope/region_code/time_range/data_type/weather_type/product_id/access_mode/prediction_run_id）

---

## 4. v2 化适配（必须写清楚“在 v2 里怎么落地”）

> 这里把第 3 节的逻辑映射到 v2 的数据产品/Mode/批次/缓存与可观测要求，避免迁移时偷带 v1 假设。

### 4.1 对应的数据产品（Data Product Mapping）
- 对应 Data Product：`<L0/L1/L2/Overlays/AI>`
- 输入最小集合：
  - region_scope：
  - region_code：
  - time_range：
  - data_type：
  - weather_type：
  - product_id：
  - access_mode：
  - prediction_run_id（predicted）：
- 输出形态：聚合 / 时间序列 / 明细 / legend

### 4.2 Access Mode 规则（如适用）
- Demo/Public：
- Partner：
- Admin/Internal：
- 后端强裁剪要求（必须写“哪些字段/粒度不能下发”）

### 4.3 Prediction Run 规则（如适用）
- predicted 是否必须携带 prediction_run_id（或由 active_run 解析）
- 缓存失效与批次绑定规则
- 回滚策略（切 active_run）与展示一致性要求

### 4.4 性能与缓存（Perf/SLO）
- Hover 是否 0 重请求（必须明确）
- cache key 必须包含哪些维度（至少 access_mode；predicted 加 prediction_run_id）
- 目标 SLO（p95）

### 4.5 可观测与审计（Observability）
- 必带字段：trace_id/correlation_id + 关键维度
- 需要审计的事件（例如 active_run 切换、AI intent 被 mode 拦截等）

---

## 5. 验收用例（必须）与反例（强烈建议）

### 5.1 验收用例（Acceptance）
- [ ] 用例 1：
- [ ] 用例 2：
- [ ] 用例 3：

### 5.2 反例（Non-examples / Forbidden）
- [ ] 禁止行为 1（例如：Hover 触发 L2 明细查询）
- [ ] 禁止行为 2（例如：predicted 混批次/缓存 key 缺 prediction_run_id）

---

## 6. 未决问题（Open Questions）
- Q1：
- Q2：

