## 模块信息

- **模块名**: 多天气类型扩展（weather_type 维度契约）
- **Reuse Type**: R1（设计思想复用，v2 全栈化重写）
- **Target Home**: Shared Contract + BE（Weather/Statistics/Risk Data Products）+ FE（图层/筛选/显示）
- **绑定验收锚点**: Data Product / Access Mode / Perf-SLO / Observability

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/补充-扩展性设计-多天气类型支持.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 目标：从“只支持降雨量”扩展为“支持多种天气类型”

- 支持降雨量、温度、风速、湿度、气压、降雪等。
- 设计原则：
  - 类型安全；
  - 易扩展（新增天气类型尽量只改配置）；
  - 向后兼容（v1 为历史代码保留降雨量专用接口）。

### 2) 核心抽象：天气类型是独立维度（不是产品时间维度）

- `weatherType` 与 `dataType`（historical/predicted）分离。
- `Product` 需要显式声明 `weatherType`，并要求 `riskRules.weatherType` 与 `Product.weatherType` 一致。
- 计算配置需携带单位与聚合方式（sum/avg/max/min）。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) v2 的定位：weather_type 是“数据产品维度”，不是 FE 的“展示偏好”

- `weather_type` 必须进入 **所有相关 Data Product 的输入维度**：
  - Weather Series / Weather Stats
  - Risk Events / Risk Aggregations
  - Map Overlays（heatmap 等）
- `weather_type` 必须进入缓存 key（与 `data_type`、`prediction_run_id`、`access_mode` 同级关键）。

### 1) Shared Contract（必须明确）

- `weather_type`: 枚举（例如 rainfall/temperature/wind/...），作为请求维度与输出字段。
- `value_unit`: 输出必须携带单位（或在产品规则中可推导的单位），避免 FE 误标注。
- `aggregation`: 风险规则的聚合语义（sum/avg/max/min）必须在产品规则中明确，并驱动后端计算。
- 一致性约束：
  - `products.riskRules.weatherType` 必须与 `products.weatherType` 一致；
  - `risk_events.weather_type`（如存储）必须与触发产品的 weather_type 一致。

### 2) 产品规则驱动（v2 必须）

- 后端计算风险事件时：
  - 只能以 `products.riskRules` 作为权威规则来源；
  - 不允许 FE 用“自己理解的单位/阈值/聚合”做替代计算。

### 3) Access Mode 下的可用性与降级

- Demo/Public：
  - 可限制 weather_type 的可选集合（例如只开放 rainfall），或只开放“汇总级”指标；
  - 对敏感/高成本 weather_type（或高分辨率数据）进行裁剪（频率、精度、空间分辨率）。
- Partner/Admin：
  - 允许更多 weather_type 与更完整的单位/阈值解释（可用于审计/解释）。
- 规则：**“后端裁剪为准”**，FE 仅按返回能力渲染。

### 4) 预测批次一致性（predicted 必须绑定 run）

- 当 `data_type=predicted`：
  - weather 系列与风险事件必须同 run（`prediction_run_id`）；
  - 若某 weather_type 的预测数据缺失：必须明确返回“不可用/缺失原因”，而不是混用其他 run 或回退历史数据冒充预测。

### 5) 图层与数据产品的关系（避免 FE 自建口径）

- FE 的图层（heatmap/marker/legend）只消费 BE 输出：
  - 颜色映射可在 FE 做（展示层），但映射输入必须来自 BE 的 `value_unit` 与阈值解释（若需要）。
  - 阈值与等级（low/medium/high）如果与产品风险规则相关，必须由 BE 输出或可由产品规则推导（Shared Contract 给出明确映射）。

### 6) 可观测性

- 每次请求/计算必须记录：
  - `weather_type`、`data_type`、`prediction_run_id`（如适用）；
  - 输出 `value_unit` 与 `aggregation`；
  - 若发生裁剪/降级：记录 `access_mode` 与裁剪策略（例如分辨率、字段缺失、采样率）。

---

## 关联模块（约束落点）

- **强约束**：`RD-天气热力图图层.md`（其“热力图”需按 `weather_type` 通用化，降雨仅为示例）
- **强约束**：`RD-风险事件标记图层.md`（risk events 必须绑定 weather_type + product rules）
- **强约束**：`RD-控制面板.md`（weather_type 选择/展示要变成维度输入，而非 UI 花样）

---

## 验收标准（Go/No-Go）

- **契约完整**：
  - 相关数据产品均显式支持 `weather_type` 输入维度；
  - 输出携带 `value_unit`（或可无歧义推导）。
- **一致性**：
  - 同 product_id 下，risk 计算使用的 weather_type 与产品规则一致；
  - predicted 模式下，weather 与 risk 使用同 `prediction_run_id`。
- **降级可解释**：
  - 在 Demo/Public 下裁剪/禁用的 weather_type 有明确的“不可用原因”与可观测记录。

---

## 反例（必须禁止）

- **反例 1**：FE 自己用“默认单位/默认阈值”解释后端返回的数值，导致跨 weather_type 错误。
- **反例 2**：产品声明的 weather_type 与 riskRules.weatherType 不一致，但系统仍运行（会造成风险事件语义错位）。
- **反例 3**：predicted 模式下混用不同 prediction_run 的 weather 与 risk，然后用时间过滤掩盖不一致。

