## 模块信息

- **模块名**: 分层职责与协作边界（FE/BE/Shared Contract）
- **Reuse Type**: R1（思想复用 + v2 全栈化重述）
- **Target Home**: FE + BE + Shared Contract + Governance
- **绑定验收锚点**: Consistency / Perf-SLO / Observability / Security

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/说明-项目文件-功能&协作.md`
- （参考）`docs/v1/00-项目总览.md`、`docs/v1/01-实现步骤总览.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) “分层”不是目录美观，而是职责隔离

v1 给出的核心分层与协作：

- **Types 层**：独立层，定义数据结构；其他层都依赖它。
- **Interfaces 层**：定义契约，支持依赖注入与替换实现；依赖 Types。
- **业务逻辑层（lib）**：实现核心规则与算法；实现 Interfaces；使用 Types。
- **Hook 层**：封装数据获取/计算与缓存，把复杂逻辑从组件剥离；调用业务逻辑层。
- **组件层**：UI 渲染与交互，状态集中（Dashboard），单向数据流向下分发。

### 2) “唯一事实来源（Single Source of Truth）”必须被制度化

- 风险计算不应散落在多个组件/静态数据中；
- 通过中心化入口统一计算与聚合输出，保证一致性。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) v2 分层的目标：防止“口径漂移 + 权限旁路 + 预测批次混算”

v2 的分层必须服务于三个系统性风险的控制：

- **口径漂移**：FE/BE 各算一套，或同一字段在不同接口含义不同。
- **权限旁路**：用前端隐藏冒充权限，后端仍返回敏感字段。
- **预测混算**：predicted 数据跨 `prediction_run_id` 混用，UI 看似正常但审计失败。

### 1) Shared Contract（跨端契约）是“第一层”而不是“可选文档”

Shared Contract 必须固化：

- 输入维度命名与语义：`region_code/time_range/data_type/weather_type/product_id/access_mode/prediction_run_id` 等（详见 `RD-共享类型与接口契约.md`）。
- 输出 DTO 分类：Series / Events / Aggregations（避免混用）。
- 时间口径：存储传输 UTC，业务边界 region_tz，展示 local（详见 `RD-时间与时区口径统一.md`）。

**硬规则**：任何新增字段/维度必须先入契约再入实现；禁止“某端先私加字段再补文档”。

### 2) Backend 分层职责（强制）

- **API Router（FastAPI 路由层）**：
  - 只负责参数校验与调用 Service；
  - 禁止 CPU 重计算、禁止复杂聚合、禁止直接拼装 Markdown/表格（服务层返回 JSON）。
- **Service Layer（服务层）**：
  - Data Product 的权威实现（裁剪、缓存、批次一致性、审计）；
  - 返回纯 JSON（Agent/前端负责格式化）。
- **Compute/Tasks（任务层）**：
  - CPU-bound 或大范围聚合必须下沉到任务（Celery/线程池），避免阻塞 async 事件环；
  - 必须幂等（重试不重复写入）。
- **DB/Cache（数据层）**：
  - DB 存 UTC；
  - cache key 必含 `access_mode`，predicted 必含 `prediction_run_id`。

### 3) Frontend 分层职责（强制）

- **UI Orchestration（Zustand/状态机）**：
  - 唯一事实来源 = “输入维度的当前值 + UI 状态机状态”；
  - 统一治理交互边界（hover/brush/toggle 的节流与请求红线）。
- **Data Fetching（TanStack Query）**：
  - 所有数据获取必须通过 Query/Mutation 管理（禁止用 useEffect 拉数据）；
  - 负责并发取消、去抖、缓存、错误重试策略。
- **Hooks（领域 Hook）**：
  - 封装 Data Product 调用与组合；
  - 不承担“风险事件识别/预测批次选择”等后端权威逻辑。
- **Components（组件层）**：
  - 只做渲染与触发意图（Intent）；
  - 禁止在组件内散落数据口径推断或重计算。

### 4) 跨端协作的“黄金链路”（必须可追溯）

任意一次用户交互（或 AI director cue）必须能形成可追溯链路：

- `ui_intent` → `orchestration_state_update` → `dp_request` → `dp_response` → `ui_render_done`

必带字段（至少）：

- `trace_id/correlation_id`
- `access_mode`
- `region_code`
- `time_range`
- `product_id`
- `data_type`
- `prediction_run_id`（predicted）

### 5) 动画/地图等高交互模块的协作红线（必须）

- 动画期间禁止重请求/重绘（详见 `RD-地图模式与动画系统.md`）。
- hover 0 重请求（详见 `RD-性能优化.md` 与边界交互 RD）。

---

## 关联模块（约束落点）

- **强约束**：`RD-共享类型与接口契约.md`（跨端字段与维度统一）
- **强约束**：`RD-风险分析统一入口与聚合输出.md`、`RD-风险计算引擎核心与策略.md`（权威计算在后端）
- **强约束**：`RD-性能优化.md`、`RD-地图模式与动画系统.md`（交互红线与竞态治理）

---

## 验收标准（Go/No-Go）

- **职责边界**：
  - FE 不存在“自己推导风险事件/批次选择”的实现；
  - BE 路由层不做重计算，服务层是 Data Product 的唯一权威。
- **契约一致**：
  - 同一维度命名在 FE/BE/缓存/日志中一致；
  - predicted 结果可追溯到 `prediction_run_id` 且无跨批次混算。
- **权限可信**：
  - Access Mode 裁剪在后端完成且可审计（不是前端隐藏）。

---

## 反例（必须禁止）

- **反例 1**：组件里写“如果是 predicted 就用最近一次 run”的逻辑（权威旁路）。
- **反例 2**：后端返回敏感字段，前端用 `if (mode!==admin)` 隐藏（权限旁路）。
- **反例 3**：缓存 key 漏 `access_mode` 或 `prediction_run_id`，导致串数据。

