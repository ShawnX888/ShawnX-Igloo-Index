## 模块信息

- **模块名**: 计算窗口与扩展数据（Extended Data / Calculation Window）
- **Reuse Type**: R1（规则复用 + v2 口径重写）
- **Target Home**: Shared Contract + BE（数据产品）+ FE（展示过滤）
- **绑定验收锚点**: Data Product / Prediction Run / Perf-SLO / Observability

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/补充-扩展数据的获取和使用.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 问题定义：用户选择的时间窗不等于计算所需的回溯窗口

- **用户选择的时间窗口**（UI dateRange）为 \([t0, t1]\)。
- **风险计算/风险叠加图**在 \(t0\) 处需要回溯一个窗口（由产品 `riskRules.timeWindow` 决定），即需要 \([t0 - window, t0]\) 的数据。
- 如果只拉取/只计算 \([t0, t1]\)，则：
  - **风险叠加示意图**：第一个点的纵轴值不准确（回溯不完整）。
  - **风险事件计算**：时间窗起点附近的风险事件不准确（累计不完整）。

### 2) 关键原则：扩展数据只用于“计算”，展示仍严格裁剪回用户窗口

- **扩展数据用于计算**（保障回溯窗口完整）。
- **展示/输出必须裁剪**到 \([t0, t1]\)（避免用户看到“超出选择范围”的内容）。
- **隔离性**：扩展数据不应影响不需要回溯窗口的模块（例如纯天气统计/纯趋势图可用原窗口数据）。

### 3) 扩展范围的计算依据：以 `riskRules.timeWindow` 为准，而非产品分类字段

- **时间单位判断必须基于** `riskRules.timeWindow.type`（hourly/daily/weekly/monthly），而不是产品 `type`（该字段在 v1 被用于“产品时间维度分类”，容易混淆）。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) v2 统一术语

- **Time Range（展示窗口）**：用户/页面选择的窗口 \([t0, t1]\)。
- **Calculation Window（计算窗口）**：为计算某个点/某个事件需要的回溯范围，由 `products.riskRules.timeWindow` 定义。
- **Extended Range（扩展拉取窗口）**：为了覆盖计算窗口而扩展的数据拉取范围 \([t0', t1]\)，其中 \(t0' \le t0\)。

### 1) 口径：时间对齐使用“风险发生地区时区”，内部存储与传输使用 UTC

- **对齐口径**：
  - 小时级：按小时回溯，边界可不对齐到 00:00。
  - 日/周/月级：**对齐到风险发生地区的本地日/周/月边界**（例如日级对齐到该地区 00:00），然后再转换成 UTC。
- **内部口径**：BE/DB 使用 UTC（`TIMESTAMPTZ`），FE 只做显示转换，不做业务边界对齐。
- **禁止**：用“用户浏览器本地时区”做业务对齐（除非明确等价于风险地区时区并有约束说明）。

### 2) Extended Range 的计算规则（v2 版本）

- **触发条件**：`product_id` 已选择，且该产品存在 `riskRules.timeWindow`。
- **扩展结束时间**：保持 \(t1\) 不变（仍是用户选择窗口的结束）。
- **扩展起始时间** \(t0'\)：
  - `hourly`：\(t0' = t0 - size \times 1hour\)（不强制对齐日边界）。
  - `daily`：\(t0' = start_of_day(region_tz, t0 - size \times 1day)\) 再转 UTC。
  - `weekly`：\(t0' = start_of_day(region_tz, t0 - size \times 1week)\)（若 v2 定义周起始需固定到周一/周日，必须在 Shared Contract 明确）再转 UTC。
  - `monthly`：\(t0'\) 对齐为 **\(t0\) 所在月的 1 号 00:00（region_tz）** 再转 UTC（注意：该规则是否需要使用 `size` 扩展多个自然月，v2 必须明确；v1 文档用“当月 1 号”规则）。
- **历史数据边界**：若数据源最早时间晚于 \(t0'\)，则用实际可用范围（同时打指标，避免静默错误）。

### 3) 数据产品（Data Product）层面的责任划分（v2 强制）

- **风险事件识别/风险叠加计算必须在 BE 完成**（CPU/一致性/可观测性约束）。
- 对应数据产品必须明确 **两个时间字段**：
  - `time_range`: \([t0, t1]\)（展示窗口）
  - `calculation_range`: \([t0', t1]\)（拉取/计算窗口）
- **输出必须裁剪**：
  - `risk_events[]`（或时间序列结果）必须仅覆盖 \([t0, t1]\)；
  - 可以额外返回 `debug.calculation_range`（仅 Admin/Internal Mode 或 debug flag）用于验收与排障。

### 4) Prediction Run 一致性（避免“批次混算”）

- 若 `data_type=predicted`：
  - 扩展拉取窗口同样必须携带 `prediction_run_id`，并确保 \([t0', t1]\) **全范围来自同一 run**。
  - 缓存 key 必须包含 `prediction_run_id`（以及 `access_mode`）。

### 5) 性能与缓存（必须可验收）

- 扩展拉取只在“需要回溯窗口”的数据产品启用；纯展示型趋势统计可不扩展。
- 缓存粒度建议：
  - **扩展数据**可以按（region_code, weather_type, data_type, prediction_run_id, bucket）做分段缓存；
  - **最终输出**按（region_code, product_id, time_range, data_type, prediction_run_id, access_mode）缓存。
- SLO：L1 关键链路（切换产品/地区）p95 < 1.5s（以 v2 文档为准），且 hover 不触发扩展拉取。

### 6) 可观测性（必须埋点/可追踪）

- 必须记录并可检索：
  - `time_range` 与 `calculation_range`；
  - 使用的 `timeWindow.type/size`；
  - `region_timezone`；
  - `prediction_run_id`（如适用）；
  - `cache_hit/miss` 与数据源最早时间（发生边界截断时）。

---

## 关联模块（约束落点）

- **强约束**：`RD-图表可视化.md`（风险叠加/风险覆盖的“窗口口径”必须遵循本 RD）
- **强约束**：`RD-风险事件标记图层.md`（预测批次一致性 + 输出裁剪）
- **强约束**：`RD-数据面板基础结构.md`（“计算在后端，展示在前端” + debug 口径）

---

## 验收标准（Go/No-Go）

- **正确性**：
  - 在 \([t0, t1]\) 的第一个展示点，风险叠加/事件识别结果与“使用完整回溯窗口”一致。
  - 输出结果（事件列表/图表点）严格裁剪到 \([t0, t1]\)。
- **一致性**：
  - `predicted` 模式下，任意一次响应的 \([t0', t1]\) 数据均来自同一 `prediction_run_id`。
- **可观测**：
  - 每次请求都可在日志/追踪中定位到 `time_range`、`calculation_range`、`region_timezone`。

---

## 反例（必须禁止）

- **反例 1**：只用 \([t0, t1]\) 的数据直接计算第一个点/第一个事件，导致起点错误。
- **反例 2**：把扩展数据直接展示给用户（展示窗口漂移）。
- **反例 3**：用浏览器本地时区对齐“日/周/月”边界，跨地区/跨时区计算不一致。
- **反例 4**：预测数据扩展窗口混用不同 `prediction_run_id`。

