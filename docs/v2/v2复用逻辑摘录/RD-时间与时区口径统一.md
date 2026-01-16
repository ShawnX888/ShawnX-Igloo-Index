## 模块信息

- **模块名**: 时间与时区口径统一（UTC/Internal + Region TZ/Business + Local Display）
- **Reuse Type**: R1（原则复用 + v2 口径重写）
- **Target Home**: Shared Contract + BE + FE（仅显示）
- **绑定验收锚点**: Data Product / Observability / Consistency / Perf-SLO

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/补充-时间处理统一化方案.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) v1 暴露的问题：同一系统内存在“UTC 与本地时区混用”

- 风险计算与过滤使用 UTC。
- 天气数据生成/加载/使用使用本地时间。
- 直接后果：
  - 时间范围比较偏差；
  - 过滤不准（同一时刻在不同口径下落入不同窗口）；
  - 与外部系统对接不一致；
  - 夏令时切换带来丢失/重复。

### 2) v1 的核心原则

- **内部统一使用 UTC**，仅在 UI 显示时转本地时间。
- 明确“用户输入 → 转 UTC 存储/计算 → UI 显示再转本地”的转换点。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) v2 三层时间口径（强制）

- **Storage & Transport（存储与传输）**：统一 UTC（DB `TIMESTAMPTZ`、API 时间戳、日志事件时间）。
- **Business Boundary（业务边界对齐）**：统一用“风险发生地区时区”（region timezone），用于：
  - “按日/周/月”的窗口边界；
  - “once per day/month”等频次限制；
  - 任何需要自然日/自然月语义的比较。
- **Presentation（展示）**：UI 按用户本地时区渲染（或产品要求的显示时区），但**不得反向影响业务计算边界**。

> 说明：v1 使用“本地时区”作为内部一致性手段；v2 必须升级为“业务边界用风险地区时区”，否则多地区/跨国会产生系统性偏差。

### 1) 必备字段/维度（Shared Contract）

- `region_timezone`：风险地区时区（例如 `Asia/Shanghai`），必须可从 `region_code` 推导或在数据中显式提供。
- `time_range`：展示窗口 \([t0, t1]\)，UTC 表达。
- `calculation_range`：计算窗口 \([t0', t1]\)，UTC 表达（详见 `RD-计算窗口与扩展数据.md`）。
- `event_time_utc`：所有事件时间的权威字段。

### 2) 禁止的口径混用（硬禁令）

- **禁止**：用浏览器本地时区做业务边界对齐（除非明确等价于 `region_timezone` 并有验收证明）。
- **禁止**：同一数据产品中出现“部分字段是 UTC、部分字段是 region/local”的混合时间表达而未标注。
- **禁止**：预测数据在一个响应中跨 `prediction_run_id` 混用后再用时间过滤掩盖问题。

### 3) 业务对齐的典型场景（必须落地）

- **Risk Rules 的 timeWindow**：
  - hourly：按 UTC 连续回溯小时数即可（不需要自然日边界）。
  - daily/weekly/monthly：边界对齐到 `region_timezone` 的自然日/周/月，再转换成 UTC 计算与存储。
- **理赔频次限制**（即便 v2 MVP 不实现真实理赔，也要作为未来约束）：
  - “once per day/month”等比较必须基于 `policy.region_timezone` 做日/月切分，再落回 UTC 比较。

### 4) UI 输入与 BE 计算的契约

- UI 的日期选择/快捷按钮产生的是“用户视角的时间范围”；
- BE 接口必须要求（或能够推导）`region_timezone`，并在服务端完成：
  - 业务边界对齐；
  - 统一 UTC 的窗口生成；
  - 输出裁剪（\([t0,t1]\)）。
- FE 的职责是：展示转换、解释（tooltip/label），不承担业务对齐逻辑。

### 5) 可观测性（必须能排查 DST/跨区问题）

- 每个关键请求必须记录：
  - `region_code`、`region_timezone`、`user_timezone`（可选，仅用于 UI 解释）；
  - `time_range`、`calculation_range`（UTC）；
  - 若发生自然日对齐：对齐前后的边界值（UTC 与 region_tz 两个视角）。
- 必须有告警/指标：
  - “窗口边界截断”（数据源不足导致 t0' 被抬高）；
  - “DST 异常”（同一自然日出现 23/25 小时边界的处理计数，便于验收）。

---

## 关联模块（约束落点）

- **强约束**：`RD-计算窗口与扩展数据.md`（日/周/月边界对齐必须用 region_tz）
- **强约束**：`RD-图表可视化.md`（X 轴展示 vs 计算窗口口径必须分离）
- **强约束**：`RD-控制面板.md`（日期选择仅负责“输入表达”，不得引入业务对齐）
- **强约束**：`RD-风险事件标记图层.md`（事件时间统一 UTC，展示时转换）

---

## 验收标准（Go/No-Go）

- **一致性**：
  - 同一 `region_code` + `time_range`，不同时区客户端得到的风险事件集合一致（事件的 UTC 时间一致）。
  - 日/周/月窗口在 `region_timezone` 下边界对齐正确（包含 DST 场景）。
- **可观测**：
  - 任何一条风险事件都能追溯其 `event_time_utc` 与其在 `region_timezone` 的自然日归属。

---

## 反例（必须禁止）

- **反例 1**：在 FE 用 `new Date()` 的本地时区去做日/月对齐，导致不同用户看到不同的“日累计/周累计”风险结果。
- **反例 2**：DB 存 UTC，但服务端在过滤窗口时使用了 region/local 时间戳，造成窗口漂移。
- **反例 3**：DST 切换日未做对齐规则，导致事件重复或丢失。

