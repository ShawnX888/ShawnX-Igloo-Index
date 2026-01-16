# v2 项目总览（模板）

> 状态：Draft / Verified
> 
> 用途：作为后续产出 `docs/v2/v2项目总览.md` 的模板。
> 
> 说明：本模板**只借鉴 v1 的信息结构**（便于阅读与索引），但所有口径与约束必须以 v2 真源为准：
> - `docs/v2/v2需求分析.md`
> - `docs/v2/v2页面设计提案.md`
> - `docs/v2/v2架构升级-全栈方案.md`
> - `docs/v2/v2技术方案.md`
> - `docs/v2/v2迁移分层矩阵.md`

---

## 0. 文档定位与读者

- **定位**：把 v2 “是什么/为什么/边界/关键约束/能力地图/交付对象（数据产品）/迁移策略”说清楚。
- **读者**：架构/产品/研发/测试/其他 agent。
- **禁止**：任何 v1 假设与实现细节；任何“前端隐藏=权限”的表达。

---

## 1. 项目背景

### 1.1 项目概述
- 一句话说明 v2 是什么（例如：态势大屏工作台：地图主舞台 + L0/L1/L2 + AI Director Cues）。

### 1.2 目标（必须）
- L0/L1/L2 信息分层闭环。
- Access Mode（Demo/Public、Partner、Admin/Internal）跨层契约（后端强裁剪）。
- predicted 批次一致性（prediction_run_id/active_run）。
- 数据产品化（L0/L1/L2/Overlays/AI Insights）与 SLO。
- 可观测闭环（trace_id/correlation_id）。

### 1.3 非目标（必须）
- 明确不做的事（直接引用 `v2需求分析.md` 的非目标条目）。

---

## 2. 范围与约束（v2 的硬边界）

### 2.1 统一语言（必须）
- L0/L1/L2
- Access Mode
- Data Type（historical/predicted）
- Prediction Run（prediction_run_id/active_run）
- Data Product（L0/L1/L2/Overlays/AI Insights）

### 2.2 统一输入维度（必须）
> 只列“维度集合”，具体字段定义见 Shared Contract。
- region_code / region_scope
- time_range
- data_type
- weather_type
- product_id
- access_mode
- prediction_run_id（predicted）

### 2.3 三条“红线”（必须写在总览里）
- **红线 A：权限旁路**：Mode 必须由后端裁剪输出，前端隐藏不算权限。
- **红线 B：预测混批次**：predicted 必须全链路绑定 prediction_run_id/active_run，缓存 key 必含批次。
- **红线 C：交互风暴**：hover 不触发重请求；重交互（lock/CTA）才允许触发 L1/L2。

---

## 3. 目标体验与信息架构（L0/L1/L2）

### 3.1 L0：省级态势（背书级）
- 主要输出（KPI/TopN/洞察卡）。
- SLO/缓存策略（强缓存/预聚合）。

### 3.2 L1：区域情报（解释）
- 主要输出（Overview/Timeline/Correlation）。
- 交互触发边界（lock/brush 等）。

### 3.3 L2：证据链（追溯，Mode-aware）
- 默认策略（Demo 默认不取明细或仅摘要）。
- 下钻触发（See more / AI CTA）。

---

## 4. 能力地图（Capability Map）

> 用“能力→依赖→验收锚点”的形式描述，禁止落到实现细节。

建议按以下域分组：

### 4.1 Shared Contract（跨端契约）
- 维度/枚举/DTO 分类（Series/Events/Aggregations）。

### 4.2 Backend（数据产品 + 计算 + 任务）
- products/policies/claims/risk_events/prediction_runs
- Data Products：L0/L1/L2/Overlays
- 计算隔离：Celery/幂等/并发控制

### 4.3 Frontend（UI Orchestration + Map Stage）
- 状态机与联动矩阵
- 地图主舞台与图层体系
- TanStack Query + Zustand 的职责分工

### 4.4 AI（聊天窗 + 洞察卡 + Intent）
- Director Cues（Insight + CTA）
- Intent 必须过 Orchestration + Mode 校验

### 4.5 Governance（合规/观测/发布治理）
- Google Maps 合规 gate
- 预算/配额监控
- Mode 默认值/来源/审计/回滚

---

## 5. 数据产品目录（Data Product Catalog）

> 直接复用/抽取 `v2需求分析.md` 或 `v2技术方案.md` 的数据产品目录表。

| 数据产品 | 层级 | 目的 | 输入维度（最小集合） | 输出形态 | Mode 影响 | predicted 约束 | 缓存与 SLO |
|---|---|---|---|---|---|---|---|
| L0 Dashboard | L0 |  |  |  |  |  |  |
| L1 Region Intelligence | L1 |  |  |  |  |  |  |
| L2 Evidence | L2 |  |  |  |  |  |  |
| Map Overlays | Map |  |  |  |  |  |  |
| AI Insights | AI |  |  |  |  |  |  |

---

## 6. 系统架构一览（仅顶层）

> 参考 `v2架构升级-全栈方案.md`，只放顶层分层与边界。

- Frontend：Next.js + UI Orchestration + Query
- Backend：API Router / Service（Data Products）/ Compute Tasks
- Data：Postgres/PostGIS + Redis + Celery

---

## 7. 迁移策略摘要（R0/R1/R2/R3）

> 只引用 `v2迁移分层矩阵.md` 的结论，不引入 v1 细节。

- **R0**：……
- **R1**：……（必须先有 Reuse Digest）
- **R2**：……（后端重写，前端仅消费）
- **R3**：……

---

## 8. 风险清单与 Go/No-Go 门槛

### 8.1 P0 风险（必须写）
- Mode 权限旁路
- predicted 混批次
- hover 请求风暴/地图掉帧
- CPU 计算阻塞

### 8.2 Go/No-Go（建议直接复用 `v2技术方案.md` 的门槛）
- 功能闭环
- 口径一致性
- 安全与合规
- 性能与体验
- 可靠性（幂等/并发控制）

---

## 9. 参考文档（v2 真源）

- `docs/v2/v2需求分析.md`
- `docs/v2/v2页面设计提案.md`
- `docs/v2/v2架构升级-全栈方案.md`
- `docs/v2/v2技术方案.md`
- `docs/v2/v2迁移分层矩阵.md`
- `docs/v2/v2复用逻辑摘录/README.md`
