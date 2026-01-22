# Phase 3 - Step 32: 理赔计算任务 - 实施总结

**实施日期**: 2026-01-21 | **状态**: ✅ 已完成（historical）

---

## 核心交付

1. **Celery任务**: 单保单 + 批量派发（按policy）
2. **Redis分布式锁**: policy + time_range 互斥
3. **Claim Calculator接入**: historical risk_events → claims
4. **幂等写入**: on_conflict_do_nothing（唯一约束）

---

## 任务定义

### 单保单计算

```python
@celery_app.task(bind=True, max_retries=3)
def calculate_claims_for_policy_task(
    policy_id, time_range_start, time_range_end
):
    # 1. Redis锁(policy + time_range)
    # 2. 查policy + payoutRules + risk_events(historical)
    # 3. 调用ClaimCalculator（timezone边界）
    # 4. 幂等写入claims(on_conflict_do_nothing)
```

### 批量计算

```python
@celery_app.task(bind=True, max_retries=3)
def calculate_claims_batch_task(
    time_range_start, time_range_end, 
    region_code=None, product_id=None
):
    # 1. 查询policies列表
    # 2. 派发子任务
```

---

## 并发控制

### Redis锁

```python
lock_key = f"claim_calc:policy:{policy_id}"
with distributed_lock(lock_key, timeout=300):
    # 计算理赔
    # 同一policy不允许并发
```

### 幂等写入

- 数据库唯一约束: `UNIQUE(policy_id, triggered_at, tier_level)`
- Upsert语义: 重复执行不报错

---

## 验收状态

- [x] 任务框架定义
- [x] Redis分布式锁
- [x] 幂等机制落地
- [x] Claim Calculator接入

**Go/No-Go**: ✅ **GO** → Step 33

---

**下一步**: Step 33 - L2 Evidence Data Product
