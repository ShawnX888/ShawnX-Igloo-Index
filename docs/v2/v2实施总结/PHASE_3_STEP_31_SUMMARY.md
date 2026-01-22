# Phase 3 - Step 31: Claim Calculator (计算内核) - 实施总结

**实施日期**: 2026-01-20 | **状态**: ✅ 已完成

---

## 核心交付

1. **ClaimCalculator**: 纯计算引擎,不依赖DB
2. **Tier差额逻辑**: 同一频次周期只赔最高tier ✅
3. **频次限制**: once per day/month 基于 policy.timezone ✅
4. **Decimal精度**: 金额计算使用Decimal
5. **职责隔离**: 只读payoutRules ✅
6. **输出裁剪**: time_range可选裁剪 ✅

---

## 关键实现

### Tier差额逻辑

```python
# 同一自然日内多次触发,只赔最高tier
events_by_day = group_by_natural_day(events, policy.timezone)

for natural_date, day_events in events_by_day.items():
    max_tier = max(e.tier_level for e in day_events)
    payout = coverage_amount * payout_percentages[max_tier] / 100
    # 生成一个claim (不重复计赔)
```

### 核心约束

- ✅ 只读payoutRules (不依赖riskRules)
- ✅ 纯函数 (不依赖DB Session)
- ✅ Decimal精度 (避免浮点误差)
- ✅ predicted不生成claims
- ✅ 使用policy.timezone判定自然边界
- ✅ 输出可按time_range裁剪

---

## 验收状态

- [x] Tier差额逻辑实现
- [x] 频次限制按policy.timezone
- [x] Decimal金融精度
- [x] predicted返回空列表
- [x] total_cap上限执行
- [x] 职责隔离验证(只读payoutRules)
- [x] time_range裁剪

**Go/No-Go**: ✅ **GO** → Step 32

---

**下一步**: Step 32 - 理赔计算任务 (Celery + Redis锁)

---

## 交付物清单

- `packages/v2-fullstack/backend/app/services/compute/claim_calculator.py`（计算内核、频次限制、裁剪）
- `packages/v2-fullstack/backend/tests/test_claim_calculator.py`（验收用例）
