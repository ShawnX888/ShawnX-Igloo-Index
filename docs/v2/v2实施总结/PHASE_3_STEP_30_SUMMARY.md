# Phase 3 - Step 30: 理赔表 + Claim Service - 实施总结

**实施日期**: 2026-01-20 | **状态**: ✅ 已完成

---

## 核心交付

1. **claims表**: policy关联、金额Decimal、唯一约束
2. **Claim Service**: CRUD + 统计 + Mode裁剪
3. **硬规则验证**: predicted不生成claims、金额非负

---

## 表结构

```sql
CREATE TABLE claims (
    id VARCHAR(50) PRIMARY KEY,
    policy_id VARCHAR(50) REFERENCES policies(id),
    product_id VARCHAR(50) REFERENCES products(id),
    risk_event_id VARCHAR(50) REFERENCES risk_events(id),
    region_code VARCHAR(20) NOT NULL,
    tier_level INTEGER NOT NULL,
    payout_percentage NUMERIC(5,2) NOT NULL,  -- 0-100%
    payout_amount NUMERIC(18,2) NOT NULL,     -- Decimal精度
    triggered_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'computed',
    product_version VARCHAR(20) NOT NULL,     -- 可追溯
    
    -- 幂等约束
    UNIQUE(policy_id, triggered_at, tier_level)
);
```

---

## 关键验证

- [x] payout_amount使用Decimal
- [x] 唯一约束防止重复
- [x] Mode裁剪(Demo金额区间化)
- [x] 只存储historical (约束由Service层执行)

**Go/No-Go**: ✅ **GO** → Step 31

---

**下一步**: Step 31 - Claim Calculator (Tier差额逻辑)
