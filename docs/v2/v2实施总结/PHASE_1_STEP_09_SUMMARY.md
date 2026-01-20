# Phase 1 - Step 09: 风险事件表 + Risk Service - 实施总结

**实施日期**: 2026-01-20 | **状态**: ✅ 已完成

---

## 核心交付

1. **risk_events 表**: 存储风险计算结果
2. **关键字段**: timestamp(UTC), tier_level, trigger_value, product_version
3. **批次绑定**: predicted必须包含prediction_run_id
4. **可追溯**: 记录product_version用于审计

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

## 验收状态

- [x] prediction_run_id字段(predicted必须)
- [x] product_version可追溯
- [x] 复合索引优化查询
- [x] 与Product表外键关联

**Go/No-Go**: ✅ **GO** → Step 10

---

**下一步**: Step 10 - 预测批次表 + Prediction Run Service
