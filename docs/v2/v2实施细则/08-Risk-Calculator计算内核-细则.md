# 08 - Risk Calculator（风险计算内核 / 纯计算）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 08  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Risk Calculator（风险计算内核 / Risk Engine Core）

---

## 目标 / 非目标

### 目标

- 以“纯计算模块”的形式实现风险事件计算内核：
  - 输入：产品 riskRules + 天气时间序列（扩展窗口）+ 时区口径参数
  - 输出：RiskEvent[] +（可选）统计摘要（供 L1/L2/Overlays 解释）
- 强制职责隔离：
  - **Risk Calculator 不依赖 DB Session、不做 IO、不做缓存、不做 Mode 裁剪**
  - 取数/对齐/缓存/审计/Mode 裁剪由 Risk Service（Step 09）负责
- 支撑两类执行方式（由调用方决定）：
  - 轻量：线程池 `run_in_executor`（严格预算）
  - 重量：Celery 任务（推荐）

### 非目标

- Risk Calculator 不生成任何赔付金额/claims（payoutRules 不可进入该模块）。
- Risk Calculator 不负责 predicted 批次选择（必须由服务层绑定 prediction_run_id）。

---

## 关联的数据产品（Data Product）

Risk Calculator 通过 Risk Service 供给：

- L1 Region Intelligence：Risk 泳道（Series）+ 风险事件（Events）
- L2 Evidence：风险事件明细与解释（Events + Meta）
- Map Overlays：Risk overlays 聚合输入（Events/Aggregations）
- AI Insights：洞察证据点（触发次数、阈值、窗口口径）

---

## 输入维度（最小集合）

> 这里是“计算输入”，不是对外 API 参数；对外 API 的维度由 Shared Contract 固化，Risk Service 负责转译为计算输入。

- `product_id`（用于审计；规则本体已在 riskRules 中）
- `riskRules`（必须完整：timeWindow/thresholds/calculation/unit）
- `weather_series`（UTC 时间戳序列 + 值；必须覆盖 calculation_range）
- `calculation_range`（UTC；扩展计算窗）
- `time_range`（UTC；展示窗，用于输出裁剪）
- `region_timezone`（用于固定窗口边界对齐：例如 monthly 自然月）
- `data_type`（historical/predicted；用于输出字段填充）
- `prediction_run_id`（predicted 必须；用于输出字段填充）
- `rules_hash` 或 `product_version`（用于输出可追溯）

---

## 输出形态

### RiskEvent 最小字段集（必须满足 Shared Contract）

- `event_time_utc`
- `region_code`（若计算输入以 region_code 为单位；否则由服务层补齐）
- `product_id`
- `weather_type`
- `data_type`
- `prediction_run_id`（predicted 必须）
- `level`（tier1/tier2/tier3）
- `value`（触发时聚合值）
- `threshold_value`（触发阈值）
- `rules_hash`/`product_version`

### 输出裁剪（必须）

计算必须使用 calculation_range（扩展窗口），但输出必须裁剪回 time_range（展示窗）。

---

## Mode 规则（必须写）

Risk Calculator 不做 Mode 裁剪，但必须支持“下游裁剪需要的 meta”：

- 输出包含 rules_hash/product_version、threshold_value、unit 等解释必需字段
- 由 Risk Service 决定 Demo/Partner/Admin 下返回哪些字段/粒度

---

## predicted 规则（必须写）

Risk Calculator 不选择批次，但必须遵守：

- 若 `data_type='predicted'`：输出必须回填同一 `prediction_run_id`
- 不允许出现“输出里 prediction_run_id 为空但 data_type=predicted”的情况

---

## 性能与缓存策略

### CPU 隔离（强制）

禁止：
- 在 FastAPI `async def` 路由内直接跑 Risk Calculator 的重计算。

允许的执行策略（由调用方选择，并写入 Risk Service 细则的降级策略）：

- 轻量（<0.5s，严格预算）：线程池执行
- 重量（>0.5s 或高维聚合）：Celery 异步任务，结果落缓存/DB

### 扩展窗口的计算成本控制

Risk Service 必须对 calculation_range 做约束（例如最大跨度、最大点数），Risk Calculator 假定输入已满足预算。

---

## 可观测性

Risk Calculator 本身不写日志，但必须让调用方能够记录：

- 输入点数（weather_series length）
- calculation_range/time_range
- timeWindow 参数（type/size/step）
- thresholds 摘要（hash）
- 计算耗时

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-风险计算引擎核心与策略.md`
- `docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md`
- `docs/v2/v2复用逻辑摘录/RD-计算窗口与扩展数据.md`

### 来自 v1 的可复用资产（R0/R1）

- 仅复用“规则解析 → 计算 → 结果格式化”的计算框架思想；实现必须迁到后端并做 CPU 隔离。

### 来自 v1 的可复用逻辑（R2）

- 滑动窗口/聚合/阈值比较的算法逻辑可复用，但必须：
  - 使用扩展窗口
  - 输出裁剪回 time_range
  - 与 timeWindow.step 统一语义一致

### 不复用内容（R3）

- 不复用“前端实时计算作为权威事实源”的模式。

---

## 验收用例（可勾选）

### 正确性（必须）

- [ ] 使用扩展窗口计算，输出严格裁剪到 time_range。
- [ ] 同一输入重复计算输出稳定一致（纯函数、无外部状态）。

### 职责隔离（必须）

- [ ] Risk Calculator 不读取 payoutRules、不输出赔付金额。
- [ ] Risk Calculator 不做 IO、不依赖 DB session。

### predicted 一致性（必须）

- [ ] predicted 输入提供 run_id 时，输出所有事件均带同一 run_id。

---

## 风险与回滚策略

### 风险

- 失败模式 B：predicted 混批次（若调用方未绑定 run_id）→ 解释断裂（P0）。
- 未使用扩展窗口 → 起点计算不准，导致 L1 曲线/阈值解释错误（P0/P1）。

### 回滚策略

- 若发现计算口径错误：优先在服务层禁用该产品/窗口配置或回滚产品规则版本，再修复计算内核并回放验证差异。

