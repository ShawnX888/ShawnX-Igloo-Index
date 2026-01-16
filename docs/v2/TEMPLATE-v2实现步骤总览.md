# v2 实现步骤总览（模板）

> 状态：Draft / Verified
> 
> 用途：作为后续产出 `docs/v2/v2实现步骤总览.md` 的模板。
> 
> 说明：本模板借鉴 v1 的“阶段→步骤表→依赖→验收/并行建议”结构，但 v2 的拆解必须以 Data Product、Access Mode、Prediction Run、Perf/SLO、Compliance、Observability 为验收锚点。

---

## 0. 前置与真源

- 真源：`v2需求分析.md`、`v2页面设计提案.md`、`v2架构升级-全栈方案.md`、`v2技术方案.md`。
- 迁移导航：`v2迁移分层矩阵.md`。
- 复用承接：R0/R1 必须先有 `v2复用逻辑摘录/RD-*.md`，再写实施细则。

---

## 1. 实现策略

### 1.1 分阶段实现原则
- 先立“Shared Contract + 数据产品边界”，再做 FE/BE 并行。
- 任何阶段都必须可演示/可验收（End-to-End 增量闭环）。
- 高风险项（Mode 裁剪、predicted 批次一致性、hover 红线、CPU 隔离）必须尽早纳入验收。

### 1.2 End-to-End 增量闭环原则
- 每个里程碑至少跑通一次“L0 → 锁区 → L1 →（按 Mode）L2”。

### 1.3 原子化与可验收原则
- 每个步骤必须绑定验收锚点（Data Product / Access Mode / Prediction Run / Perf-SLO / Compliance / Observability）。

---

## 2. 泳道与阶段划分（v2 推荐）

> v2 建议按泳道组织（便于并行），并在每个阶段落地到 Data Products。

- **Lane A：Shared Contract**（维度/枚举/DTO/缓存 key/Mode 裁剪规则）
- **Lane B：Backend**（products/policies/claims/risk_events/prediction_runs + Data Products + Tasks）
- **Lane C：Frontend**（UI Orchestration + Map Stage + L0/L1/L2 UI）
- **Lane D：Governance**（合规 gate、观测、发布治理）
- （可选）**Lane E：AI**（聊天窗、洞察卡、Intent 执行链路）

---

## 3. 步骤列表（表格）

> 说明：编号用于后续 `v2实施细则` 的文件编号（`docs/v2/v2实施细则/<编号>-<模块名>-实施细则.md`）。

| 步骤编号 | 步骤名称 | 泳道 | 依赖 | Reuse Type（R0-R3） | 交付对象（Data Product/能力） | 验收锚点（至少一项） | 风险点/注意事项 |
|---:|---|---|---|---|---|---|---|
| 01 | Shared Contract 基线（维度/DTO/口径） | Shared |  |  |  | Consistency/Observability |  |
| 02 | Access Mode 裁剪基线（后端输出裁剪规则） | Shared+BE | 01 |  |  | Access Mode/Security |  |
| 03 | Prediction Run 基线（active_run / run_id 传播） | Shared+BE | 01 |  |  | Prediction Run/Consistency |  |
| 04 | L0 Dashboard Data Product（KPI/TopN） | BE | 01/02/03 |  | L0 | Data Product/Perf-SLO |  |
| 05 | Map Overlays Data Product（Weather/Risk/Claims） | BE | 01/02/03 |  | Overlays | Perf-SLO/Prediction Run |  |
| 06 | Map Stage 基线（加载/交互/图层框架） | FE | 01 |  |  | Perf-SLO/Compliance |  |
| 07 | UI Orchestration（状态机 + 联动矩阵） | FE | 01 |  |  | Perf-SLO/Observability |  |
| 08 | L1 Region Intelligence Data Product | BE | 01/02/03 |  | L1 | Data Product |  |
| 09 | L1/L2 面板（Bottom Sheet） | FE | 07/08 |  |  | Data Product/Perf-SLO |  |
| 10 | L2 Evidence Data Product（Mode-aware） | BE | 01/02/03 |  | L2 | Access Mode |  |
| 11 | AI Insight Cards + Intent 闭环 | FE+BE | 04/08/10/07 |  | AI Insights | Access Mode/Observability |  |
| 12 | 合规 Gate 与用量监控落地 | Gov | 06 |  |  | Compliance |  |

> 备注：上述仅为模板示例，实际步骤需按 v2 真源与迁移矩阵调整。

---

## 4. 依赖关系（图/清单）

- 给出关键依赖链（例如：Shared Contract → Data Products → UI 消费）。
- 明确“哪些步骤可并行、哪些必须串行”。

---

## 5. 每阶段/里程碑的交付物与验收

> 建议按阶段写：目标、包含的步骤、可演示闭环、门槛（Go/No-Go）。

### 5.1 阶段 1：Shared Contract + 风险红线先固化
- 交付：维度/DTO/Mode 裁剪规则/predicted 批次传播规则。
- 门槛：可追踪链路字段齐全；cache key 维度规则明确。

### 5.2 阶段 2：后端 Data Products 最小可用
- 交付：L0/L1/Overlays/L2（可先薄实现）。
- 门槛：Mode 裁剪可验证；predicted 不混批次。

### 5.3 阶段 3：前端联动闭环
- 交付：Map Stage + L0 + 锁区 + L1 timeline + L2（按需）。
- 门槛：hover 0 重请求；地图主舞台不掉帧。

---

## 6. 验收标准总览（模板）

### 6.1 功能闭环
- [ ] L0 → 锁区 → L1 →（按 Mode）L2

### 6.2 一致性与批次
- [ ] predicted 全链路绑定 prediction_run_id/active_run
- [ ] cache key 维度完整（至少 access_mode；predicted 额外 prediction_run_id）

### 6.3 安全与模式
- [ ] Demo/Public 抓包无法拿到敏感字段/明细（后端裁剪）

### 6.4 性能与体验
- [ ] hover 0 明细重请求
- [ ] L0/Overlays 命中缓存 p95 达标（以 v2 需求门槛为准）

### 6.5 可观测与合规
- [ ] trace_id/correlation_id 全链路可追踪
- [ ] Google Maps Key 限制 + 预算/告警就绪

---

## 7. 并行开发建议

- 按泳道给出可并行组合与前置依赖。
- 明确接口/契约冻结点（避免返工）。

---

## 8. 下一步行动

- 按步骤编号产出对应模块的 Reuse Digest（如适用）与 `v2实施细则`。
