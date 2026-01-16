# 07 - 天气数据表 + Weather Service（Weather）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 07  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

天气数据表（历史/预测）+ Weather Service（按 weather_type 可扩展的数据源与查询服务）

---

## 目标 / 非目标

### 目标

- 建立 v2 的天气数据权威来源与访问方式，支持多 weather_type 扩展：
  - historical：单一真值（不可变）
  - predicted：批次版本化（prediction_run_id/active_run）
- 支撑 Map Overlays 与 L1 Timeline 的 Weather 泳道（高频交互，要求可缓存可复用）。
- MVP 支持 Mock 数据生成/导入，并为未来真实天气 API 接入预留边界（同契约，不换 UI）。
- 与 Risk Engine 的“扩展窗口计算”对齐：能按 `calculation_range` 拉取扩展数据（响应裁剪回 time_range 由服务层负责）。

### 非目标

- MVP 不保证天气数据真实性/准确性（验收重点不是准确性，而是口径一致性与稳定性）。
- 不在本细则中定义地图渲染图层实现（由 FE Map Stage/Overlays 消费方细则承接）。

---

## 关联的数据产品（Data Product）

- L1 Region Intelligence：Timeline 的 Weather 泳道（Series）
- Map Overlays：Weather overlay（聚合 + legend）
- L0 Dashboard：当 L0 KPI 依赖 weather_type 时（可选）
- Risk Engine / Risk Events：作为风险计算输入（Step 08/09）
- AI Insights：洞察证据点（weather 异常与阈值关联）

---

## 输入维度（最小集合）

> weather 查询是所有数据产品的基础输入之一，必须完全遵循 Shared Contract 的维度集合。

- `region_scope` / `region_code`
- `time_range`（UTC；展示窗）
- `data_type`（historical/predicted）
- `weather_type`
- `prediction_run_id`（predicted 必须；historical 为空）
- `access_mode`（影响裁剪粒度/可见字段）

（内部计算场景额外）：
- `calculation_range`（UTC；扩展计算窗）

---

## 输出形态

### 1) Weather Series（时间序列）

- 统一输出 UTC 时间戳序列（前端按展示口径转换）。
- 必带 legend/meta：
  - `unit`
  - `weather_type`
  - `data_type`
  - `prediction_run_id`（predicted）

### 2) Weather Aggregations（聚合）

用于 overlays 与 KPI：

- sum/avg/max/min（按产品规则或 overlays 需求定义）
- 按 region_scope 聚合（province/district）
- 可选：按网格/hex（未来扩展）

---

## Mode 规则（必须写）

天气数据通常不属于敏感数据，但 Mode 仍可影响：

- 输出粒度（例如 Demo 默认日级，Partner/Admin 可小时级）
- 输出范围（Demo 限制 weather_type 种类为 1–2 种）

硬规则：
- Mode 裁剪由后端执行（尤其是“Demo 限制 weather_type 集合”的策略，避免前端绕过）。

---

## predicted 规则（必须写）

### 批次版本化（必须）

- predicted 数据必须绑定 `prediction_run_id`
- 存在 `active_run` 用于对外展示
- 不允许跨批次混用：同一请求链路内 weather predicted 与 risk predicted 必须来自同一 run

### 缓存与批次绑定失效（必须）

- predicted 缓存 key 必含 `prediction_run_id`
- active_run 切换后，旧批次缓存不得被新请求复用

---

## 性能与缓存策略

### 高优先级：服务端缓存与可复用

需求硬约束（来自 `v2需求分析.md`）：

- L0/Overlays：强缓存优先（命中 p95 < 500ms / 800ms）
- L1：可缓存但需可复用（交互刷新稳定优先）
- Hover：0 次明细重请求（Weather 亦不得在 hover 拉新数据）

工程策略（本模块必须满足）：

- 缓存 key 必含：
  - `region_scope`、`region_code`、`time_range`、`data_type`、`weather_type`、`access_mode`
  - predicted 额外含 `prediction_run_id`
- 支持“按 calculation_range 拉取扩展数据”的内部接口，但对外响应必须裁剪回 time_range

---

## 可观测性

每次 weather 查询/聚合必须记录：

- `trace_id/correlation_id`
- `access_mode`
- `region_scope` / `region_code`
- `time_range`（与 calculation_range 若有）
- `data_type` / `weather_type`
- `prediction_run_id`（predicted）
- 缓存命中/失效原因（尤其 active_run 切换）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-天气数据源与Mock生成.md`
- `docs/v2/v2复用逻辑摘录/RD-多天气类型扩展.md`
- `docs/v2/v2复用逻辑摘录/RD-计算窗口与扩展数据.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`

### 来自 v1 的可复用资产（R0/R1）

- 复用“确定性 Mock 生成 + 可复现”的思路，但必须下沉到后端（避免前端成为事实源）。

### 来自 v1 的可复用逻辑（R2）

- Mock 生成规则、补齐策略可复用，但 v2 必须纳入 prediction_run_id/active_run 管理与缓存策略。

### 不复用内容（R3）

- 不复用“前端生成/前端持有全部天气明细并二次聚合”的模式（会导致掉帧与口径不可审计）。

---

## 验收用例（可勾选）

### 一致性与批次（必须）

- [ ] historical 天气数据唯一（同 region/time/weather_type 唯一）。
- [ ] predicted 天气数据按 prediction_run_id 版本化，响应显式带 run_id。
- [ ] active_run 切换后不会混用旧 run 缓存。

### 性能（必须）

- [ ] Overlays/Timeline 的 weather 查询支持强缓存，命中 p95 达标（以系统验收门槛为准）。
- [ ] Hover 不触发新的 weather 重请求（可通过埋点/日志验证）。

---

## 风险与回滚策略

### 风险

- predicted 混批次导致解释断裂（P0）。
- weather 查询无缓存导致 L1 刷新抖动、地图掉帧（P0/P1）。

### 回滚策略

- active_run 回滚到上一批次并触发缓存失效（与 Step 03 一致）。
- 如果缓存策略导致错口径：优先回滚到“禁用该类缓存/强制带齐维度”的保守策略，再修复 key 维度。

