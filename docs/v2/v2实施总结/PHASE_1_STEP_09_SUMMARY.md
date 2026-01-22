# Phase 1 - Step 09: 风险事件表 + Risk Service - 实施总结

**实施日期**: 2026-01-20 | **状态**: ✅ 已完成

---

## 核心交付

1. **risk_events 表**: 存储风险计算结果
2. **关键字段**: timestamp(UTC), tier_level, trigger_value, product_version
3. **批次绑定**: predicted必须包含prediction_run_id
4. **可追溯**: 记录product_version用于审计
5. **Risk Service（查询）**: 提供 Mode/predicted-aware 的查询基元（不在服务层做重计算）✅
6. **Risk Events API Router**: /risk-events（读路径）

---

## 表结构

```sql
CREATE TABLE risk_events (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    region_code VARCHAR(20) NOT NULL,
    product_id VARCHAR(50) REFERENCES products(id),
    product_version VARCHAR(20) NOT NULL,  -- 可追溯
    weather_type VARCHAR(20) NOT NULL,
    tier_level INTEGER NOT NULL,           -- 1/2/3
    trigger_value NUMERIC(10,2) NOT NULL,
    threshold_value NUMERIC(10,2) NOT NULL,
    data_type VARCHAR(20) NOT NULL,
    prediction_run_id VARCHAR(50),         -- predicted必须
    created_at TIMESTAMPTZ NOT NULL
);
```

---

## 交付物清单

| 文件路径 | 说明 | 行数 |
|---|---|---|
| `packages/v2-fullstack/backend/app/models/risk_event.py` | RiskEvent 数据库模型（含索引） | 以代码为准 |
| `packages/v2-fullstack/backend/app/schemas/risk_event.py` | RiskEvent Schemas（predicted/historical 绑定校验） | 以代码为准 |
| `packages/v2-fullstack/backend/app/services/risk_service.py` | Risk Service（risk_events 查询基元） | 以代码为准 |
| `packages/v2-fullstack/backend/app/api/v1/risk_events.py` | Risk Events Router（读路径） | 以代码为准 |
| `packages/v2-fullstack/backend/tests/test_risk_event_schema.py` | Schema 验收测试（predicted 必带 run_id） | 以代码为准 |
| `packages/v2-fullstack/backend/tests/test_risk_service.py` | Service 单测（predicted 校验 + 查询路径） | 以代码为准 |
| `packages/v2-fullstack/backend/tests/test_api_risk_events.py` | Router 验收测试（predicted/run_id 约束） | 以代码为准 |

---

## 验收状态

- [x] prediction_run_id字段(predicted必须)
- [x] product_version可追溯
- [x] 复合索引优化查询
- [x] 与Product表外键关联
- [x] Risk Service 查询基元（predicted/窗口裁剪）已提供

**Go/No-Go**: ✅ **GO** → Step 10

---

**下一步**: Step 10 - 预测批次表 + Prediction Run Service
