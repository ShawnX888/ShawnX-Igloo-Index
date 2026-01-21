# Phase 1 - Step 10: 预测批次表 + Service - 实施总结

**实施日期**: 2026-01-20 | **状态**: ✅ 已完成

---

## 核心交付

1. **prediction_runs 表**: 批次元信息存储
2. **PredictionRunService**: 完善Phase 0 Step 03的数据库层
3. **Active Run查询**: `get_active_run()`
4. **批次列表**: 支持按status/source过滤
5. **切换/回滚（MVP）**: 状态切换实现 active_run 切换与回滚记录（缓存失效与更细粒度传播在后续步骤接入）✅

---

## 表结构

```sql
CREATE TABLE prediction_runs (
    id VARCHAR(50) PRIMARY KEY,           -- run-2025-01-20-001
    status VARCHAR(20) NOT NULL,          -- active/archived/failed/processing
    source VARCHAR(50) NOT NULL,
    note TEXT,
    weather_type VARCHAR(20),             -- 可选: 维度范围
    product_id VARCHAR(50),
    region_scope VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_prediction_runs_status ON prediction_runs(status);
```

---

## 关键功能

- **get_active_run()**: 获取当前展示批次
- **list_runs()**: 查询历史批次
- **create() / switch_active_run() / rollback_to_previous_run()**: 数据库层实现（MVP：全局单 active_run）
- **切换逻辑（工具层）**: Phase 0 Step 03 `app/utils/prediction_run.py` 仍作为框架（缓存/审计更完整版本在后续步骤接入）

---

## 交付物清单

| 文件路径 | 说明 | 行数 |
|---|---|---|
| `packages/v2-fullstack/backend/app/models/prediction_run.py` | PredictionRun 数据库模型 | 以代码为准 |
| `packages/v2-fullstack/backend/app/schemas/prediction.py` | Prediction Run Schemas（status/source/switch record 等） | 以代码为准 |
| `packages/v2-fullstack/backend/app/services/prediction_run_service.py` | PredictionRunService（CRUD/active_run/switch/rollback） | 以代码为准 |
| `packages/v2-fullstack/backend/tests/test_prediction_run_service.py` | Service 单测（create/switch 校验） | 以代码为准 |

---

## 验收状态

- [x] prediction_runs表创建
- [x] Service CRUD实现
- [x] active_run查询
- [x] 与Phase 0 Step 03集成

**Go/No-Go**: ✅ **GO** → Step 11

---

**下一步**: Step 11 - L0 Dashboard Data Product
