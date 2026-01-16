# 10 - 预测批次表 + Prediction Run Service（prediction_runs）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 10  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

预测批次表（`prediction_runs`）+ Prediction Run Service（active_run 切换/回滚/审计）

---

## 目标 / 非目标

### 目标

- 将 Step 03 的“Prediction Run 基线”落到可实现、可审计的后端形态：
  - `prediction_runs` 表承载 predicted 批次元信息
  - 提供 `active_run` 查询与切换能力（MVP 可全局单 active_run）
- 为 predicted 全链路一致性提供“唯一来源”：
  - FE/BE/AI 都能查询当前 active_run
  - 服务端可在请求未显式提供 run_id 时，解析 active_run 并在响应中显式回填 `prediction_run_id`
- 支撑回滚：坏批次上线后，通过切 active_run 回滚，而非覆盖历史预测数据。

### 非目标

- 不实现天气预测计算本身（由 weather_sync 与计算任务承接）。
- 不实现按 weather_type/product/region_scope 多维 active_run（MVP 先全局单一 active_run，后续再扩展）。

---

## 关联的数据产品（Data Product）

所有 predicted 数据产品都依赖该服务：

- L0 Dashboard（predicted）
- L1 Region Intelligence（predicted）
- L2 Evidence（predicted 若允许展示）
- Map Overlays（predicted）
- AI Insights（predicted）

---

## 输入维度（最小集合）

### 预测批次查询（只读）

- `access_mode`（用于审计/权限；一般允许所有模式读取 active_run 元信息的子集）
- （可选）`weather_type` / `product_id` / `region_scope`（为未来多维 active_run 预留）

### 预测批次切换（写操作，必须受控）

- `target_prediction_run_id`
- `operator`（操作者标识）
- `reason` / `note`（必填：为什么切换/回滚）

---

## 输出形态

### 1) PredictionRun 元信息（必备字段）

- `id`（prediction_run_id）
- `status`（active/archived/failed…）
- `created_at`（UTC）
- `source`（external_sync / rerun / manual_backfill…）
- `note`（可选）

### 2) active_run 查询结果（对外展示）

最小输出建议：

- `active_prediction_run_id`
- `created_at`
- `source`
- （可选）`note`（Demo 模式可隐藏敏感原因，仅保留“已更新/可回滚”的说明）

---

## Mode 规则（必须写）

### Demo/Public

- 允许读取 active_run 的最小信息（id + created_at + “当前预测批次”提示）。
- 不建议暴露过多内部备注（note）与失败原因明细。

### Partner

- 可读更多元信息（source/note），便于对齐解释。

### Admin/Internal

- 可读全量元信息，并允许执行 active_run 切换（写权限）。

硬规则：
- 任何切换操作必须可审计（何时/为何/谁）。

---

## predicted 规则（必须写）

### 规则 1：解析策略（必须固化）

当 `data_type='predicted'` 且请求未显式提供 `prediction_run_id` 时：

- 服务端必须通过 Prediction Run Service 解析当前 `active_run`
- 并在响应中显式回填 `prediction_run_id`（用于前端/AI 一致性校验与展示）

### 规则 2：切换传播链（必须闭环）

active_run 切换后必须形成闭环：

- 相关数据产品缓存失效（key 中含 prediction_run_id 时自然隔离，但仍需要刷新入口/策略）
- 前端 UI 与 AI 工具调用不得继续使用旧 run 缓存

### 规则 3：回滚策略（必须）

- 回滚必须通过切换 active_run 实现
- 禁止覆盖旧预测数据（避免审计困难与解释断裂）

---

## 性能与缓存策略

- active_run 查询应为低延迟（可缓存，但切换时必须失效）。
- 若 active_run 作为服务端解析默认值的关键路径，必须保证高可用与可观测。

缓存 key（如做缓存）至少包含：

- `access_mode`（输出字段可能不同）
- （未来扩展维度）weather_type/product_id/region_scope

---

## 可观测性

必须记录：

- active_run 查询：trace_id/correlation_id、access_mode、结果 run_id
- active_run 切换审计：
  - old_run_id / new_run_id
  - operator
  - timestamp
  - reason/note
  - 影响范围（MVP 可写“global”）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`

### 来自 v1 的可复用资产（R0/R1）

- 不适用（v1 无预测批次治理）。

### 来自 v1 的可复用逻辑（R2）

- 不适用（v2 新增）。

### 不复用内容（R3）

- 不复用“predicted 视为单一真值”的隐含前提。

---

## 验收用例（可勾选）

### 批次一致性（必须）

- [ ] 任意 predicted 数据产品响应都能追溯到一个明确的 prediction_run_id（显式字段）。
- [ ] active_run 切换后，新请求必然命中新 run（不混批次）。

### 回滚与审计（必须）

- [ ] 支持切回上一批次（无需覆盖旧数据）。
- [ ] 切换行为可审计（何时/为何/谁），并能关联到缓存失效/刷新事件。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo/Public 仍能通过接口拿到 active_run 的敏感备注或内部失败原因。  
硬规则：**BE 按 Mode 裁剪输出** + 审计。

### 失败模式 B：predicted 混批次

症状：active_run 已切换，但前端/AI 仍命中旧 run 缓存，解释断裂。  
硬规则：prediction_run_id/active_run 全链路一致；cache key 必含批次；切换必须触发缓存隔离/失效与刷新策略。

---

## 风险与回滚策略

### 风险

- active_run 切换未审计或未传播 → 线上解释断裂、难以追责（P0）。
- active_run 切换导致缓存策略不一致 → 表现为“看似刷新但仍旧数据”（P0/P1）。

### 回滚策略

- 发现坏批次：立刻切回上一批次 active_run，并触发相关数据产品缓存隔离/失效策略。

