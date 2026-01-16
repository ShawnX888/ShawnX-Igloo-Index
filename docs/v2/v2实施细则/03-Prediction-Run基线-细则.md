# 03 - Prediction Run 基线（active_run / run_id 传播）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 03  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Prediction Run 基线（prediction_run_id / active_run 一致性与回滚）

---

## 目标 / 非目标

### 目标

- 为 predicted 数据建立“**批次版本化**”机制：每次预测刷新生成新的 `prediction_run_id`，并通过 `active_run` 控制对外展示批次。
- 固化 predicted 全链路一致性规则：FE/BE/缓存/AI **不得混用**不同批次数据。
- 固化缓存失效策略：predicted 缓存必须与批次绑定；切换 active_run 必须触发相关缓存失效/刷新。
- 固化回滚能力：发现坏批次时，通过切换 active_run 实现回滚（而非覆盖旧预测数据）。

### 非目标

- 不以“预测准确性”作为验收目标（v2 MVP 验收重点为一致性/可解释/可审计）。
- 不在本细则中定义预测数据的外部来源接入细节（由 Weather Sync / 预测数据管线细则承接）。

---

## 关联的数据产品（Data Product）

predicted 相关的所有数据产品必须遵守本细则：

- L0 Dashboard（predicted）
- L1 Region Intelligence（predicted）
- L2 Evidence（predicted 若允许展示）
- Map Overlays（predicted）
- AI Insights（predicted）

---

## 输入维度（最小集合）

> 本模块定义 `prediction_run_id` 的来源、传播与校验；其他维度沿用 Shared Contract（Step 01）。

- `data_type`（historical/predicted）
- `prediction_run_id`（predicted 必须）
- `access_mode`
- 其他数据产品维度（region_scope/region_code/time_range/weather_type/product_id）

---

## 输出形态

### 1) Prediction Run 元信息（必须）

系统必须能提供至少以下元信息（用于 UI/AI 解释与审计）：

- `prediction_run_id`
- `status`（至少区分 active / archived / failed）
- `created_at`（UTC）
- `source`（external_sync / manual_backfill / rerun 等）
- `note`（可选：切换/回滚原因）

### 2) Data Product 响应回填批次信息（强制）

凡 `data_type='predicted'` 的响应必须显式携带：

- `prediction_run_id`（本响应使用的批次）
- （可选）`active_run_id`（当前对外展示批次，用于 UI 显示与一致性验证）

---

## Mode 规则（必须写）

Mode 不改变批次一致性规则，但会影响：

- predicted 数据产品的字段/粒度裁剪（见 Step 02）
- AI 在 predicted 下的表述与 CTA（禁止把 predicted 表述为“正式理赔事实”）

---

## predicted 规则（必须写）

### 规则 1：显式绑定（必须）

- 若请求 `data_type='predicted'`：
  - 请求必须携带 `prediction_run_id`，或服务端在接收请求后解析 `active_run` 并在响应中显式回填 `prediction_run_id`。

### 规则 2：不混批次（必须）

在同一请求链路内，以下任何取数都必须使用同一 `prediction_run_id`：

- weather predicted 数据
- risk_events predicted
- overlays predicted
- AI 工具调用依赖的数据（L0/L1/L2/Overlays）

### 规则 3：缓存与批次绑定失效（必须）

- predicted 缓存 key 必须包含 `prediction_run_id`（或 active_run 标识）。
- 切换 active_run 后：
  - 新请求必须命中新批次
  - 旧批次缓存不得被新请求复用

### 规则 4：回滚策略（必须）

- 回滚只能通过切换 `active_run` 实现（记录 note/操作者/时间）
- 禁止直接覆盖历史预测数据（会导致审计困难与解释断裂）

---

## 性能与缓存策略

### 缓存 key 维度（强制）

predicted 场景缓存 key 必含：

- `prediction_run_id`
- `access_mode`
- 其他 Shared Contract 维度（region/time_range/weather_type/product_id…）

### 推荐失效粒度（MVP 可先“全局单 active_run”）

> `docs/v2/v2架构升级-全栈方案.md` 建议 MVP 可先做“全局单一 active_run”，未来再扩展到按 weather_type/product/region_scope。

- MVP：active_run 切换后，按数据产品类别批量失效（dp_l0 / dp_l1 / dp_overlays / ai_insights）
- 后续：按维度更细的失效策略（避免全局抖动）

---

## 可观测性

### 必须记录的审计字段（最小集合）

每次 predicted 请求/计算/响应必须记录：

- `prediction_run_id`
- `active_run_id`（如存在）
- `access_mode`
- `trace_id/correlation_id`
- 缓存命中/失效原因（例如：active_run_changed）

### active_run 切换审计（必须）

每次切换必须记录：

- 切换前后 run_id
- 操作者（或系统任务名）
- 时间
- 原因（note）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（预测混算为系统性风险）
- `docs/v2/v2复用逻辑摘录/RD-风险计算引擎核心与策略.md`（predicted 必须绑定 run_id）

### 来自 v1 的可复用资产（R0/R1）

- 不复用 v1 的“predicted=单一真值”的隐含假设；v2 预测是“会变”的，必须版本化。

### 来自 v1 的可复用逻辑（R2）

- 不适用（v1 不存在 prediction_run_id/active_run 的系统机制）。

### 不复用内容（R3）

- 任何“前端默认拿最新预测、不带 run_id”的实现（会导致解释断裂）。

---

## 验收用例（可勾选）

### 批次一致性（必须）

- [ ] predicted 模式下，所有 Data Product 响应均显式带 `prediction_run_id`。
- [ ] 同一页面一次刷新链路内（L0/L1/Overlays/AI）不出现不同 run_id。
- [ ] active_run 切换后，缓存不复用旧 run，且响应中的 run_id 与 active_run 一致。

### 回滚可用（必须）

- [ ] 能通过切换 active_run 回到上一批次（无需覆盖数据）。
- [ ] 回滚行为可审计（何时/为何/谁）。

---

## 风险与回滚策略

### 风险

- **失败模式 B：predicted 混批次**：UI/AI 使用不同批次数据，解释断裂；缓存命中但口径错（P0）。

### 回滚策略

- 若发现坏批次：立即将 active_run 切回上一批次，并触发相关缓存失效。
- 若发现混批次：短期先禁用 predicted 缓存或强制要求请求显式带 run_id（更保守但能止血），再修复缓存 key/传播链路。

