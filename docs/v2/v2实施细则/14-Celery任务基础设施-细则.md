# 14 - Celery 任务基础设施（Worker/Beat/幂等/并发控制）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 14  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Celery 任务基础设施（Worker/Beat/Broker/Result Backend + 幂等/并发控制/可观测）

---

## 目标 / 非目标

### 目标

- 为 v2 的重计算与批处理建立统一基础设施：
  - Celery Worker/Beat
  - Redis 作为 broker（以及可选 result backend）
  - 任务的幂等、并发控制、重试策略与观测
- 落实 v2 强约束：
  - **禁止**在 FastAPI `async def` 路由中直接执行 CPU 重计算
  - 重任务必须走 Celery（风险事件批量、预测刷新、理赔生成、重聚合等）
- 为后续任务（Step 15 风险事件计算、Phase 3 理赔计算等）提供统一“任务模板”与治理门槛。

### 非目标

- 不在本细则实现具体业务任务逻辑（风险/理赔/天气同步的业务细节由各自任务细则承接）。
- 不在本细则引入复杂工作流编排（Airflow 等）。

---

## 关联的数据产品（Data Product）

Celery 任务基础设施是 Data Product 的“计算与新鲜度保障底座”，影响：

- L0/L1/Overlays 的新鲜度与强缓存命中率
- predicted 的 prediction_run_id 产出与一致性
- claims 的历史生成可靠性（Phase 3）

---

## 输入维度（最小集合）

> 任务入参与日志必须包含 Shared Contract 关键维度，确保可追溯与可回放。

通用必带：

- `trace_id/correlation_id`
- `access_mode`（如适用，尤其生成缓存时）
- `region_scope/region_code`（如适用）
- `time_range`（如适用）
- `data_type`
- `weather_type`（如适用）
- `product_id`（如适用）
- `prediction_run_id`（predicted）

---

## 输出形态

### 1) 任务执行状态与结果可观测（必须）

- 任务状态：queued/running/succeeded/failed/retried
- 关键耗时：排队延迟、执行耗时、重试次数
- 失败原因：可定位（错误码/异常栈摘要）

### 2) 任务产出（因任务而异）

例如：

- 写入 DB（risk_events/claims/weather）
- 刷新/失效缓存（L0/L1/Overlays）
- 产出 prediction_run 并切换 active_run（predicted 刷新链路）

---

## Mode 规则（必须写）

Celery 基础设施本身不裁剪业务字段，但必须保证：

- 任何“生成缓存”的任务，其缓存 key 必含 `access_mode`
- 任务生成的缓存结果不得被其他 Mode 复用（避免权限旁路）

---

## predicted 规则（必须写）

predicted 相关任务必须遵守：

- 批次版本化：每次预测刷新生成新的 `prediction_run_id`（或明确采用已有 run）
- 缓存与批次绑定：缓存 key 必含 `prediction_run_id`
- active_run 切换必须可审计，并触发相关缓存隔离/失效策略

---

## 性能与缓存策略

### 任务治理目标（建议）

- 避免“任务风暴”：定时任务应支持分片/批处理/限流
- 避免“重复写入”：幂等与唯一约束配合

### 并发控制（强制）

至少两层防护（与 `v2技术方案.md` 对齐）：

- **Redis 分布式锁**（task-level lock）
- **数据库事务/唯一约束/行锁**（write-level safety）

---

## 可观测性

必须记录：

- task_name、task_id
- trace_id/correlation_id
- 关键维度（见输入维度）
- lock key（如使用）与获取/释放结果
- 写入影响范围（例如写入行数、刷新缓存 key 数）

建议统一事件命名（与 `v2技术方案.md` 一致）：

- task_weather_sync、task_risk_recalc_predicted、task_claim_calc、task_aggregate_refresh

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（CPU 隔离、职责边界）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（缓存与新鲜度策略）

### 来自 v1 的可复用资产（R0/R1）

- 不适用（v1 无后端任务体系）。

### 来自 v1 的可复用逻辑（R2）

- 不适用（v2 新增）。

### 不复用内容（R3）

- 不复用“重计算直接在请求链路执行”的模式（会阻塞 event loop）。

---

## 验收用例（可勾选）

### 可靠性（必须）

- [ ] 任务可重试但不产生重复写入（幂等）。
- [ ] 并发触发同一任务不会导致重复 risk_events/claims（锁 + DB 约束生效）。

### 可观测（必须）

- [ ] 任务从入队到完成可追踪（task_id + correlation_id）。
- [ ] 失败原因可定位并可复盘（含关键维度与错误摘要）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：任务生成的缓存未区分 access_mode，导致 Demo 命中 Partner/Admin 的缓存结果。  
硬规则：cache key 必含 `access_mode`；任务刷新/写缓存必须带 Mode 维度。

### 失败模式 B：predicted 混批次

症状：任务产出/刷新时未绑定 prediction_run_id，导致新旧预测缓存混用。  
硬规则：prediction_run_id/active_run 全链路一致；cache key 必含批次；active_run 切换可审计并触发隔离/失效。

---

## 风险与回滚策略

### 风险

- 任务幂等缺失 → 重试导致重复写入（P0）。
- 锁策略不当 → 死锁/长时间占锁导致系统不可用（P0/P1）。

### 回滚策略

- 出现重复写入/混批次：先暂停相关 Beat 任务 + 收紧锁/唯一约束 + 回滚 active_run（predicted）。
- 任务失败率过高：降级为更低频率或手动触发，并保留可回放输入以便修复后重跑。

