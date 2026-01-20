# Phase 3 - Step 32: 理赔计算任务 - 实施总结

**实施日期**: 2026-01-20 | **状态**: ✅ 框架完成

---

## 核心交付

1. **Celery任务**: 单保单 + 批量计算
2. **Redis分布式锁**: 防止并发计算
3. **幂等机制**: 唯一约束 + 锁控制

---

## 任务定义

### 单保单计算

```python
@celery_app.task
def calculate_claims_for_policy_task(
    policy_id, time_range_start, time_range_end
):
    # 1. Redis锁
    # 2. 查policy + payoutRules + risk_events
    # 3. 调用ClaimCalculator
    # 4. 幂等写入claims
```

### 批量计算

```python
@celery_app.task
def calculate_claims_batch_task(
    time_range_start, time_range_end, 
    region_code=None, product_id=None
):
    # 1. 查询policies列表
    # 2. 派发子任务
    # 3. 收集结果
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
- [x] 幂等机制设计
- [ ] 完整实现(Phase 3后期)

**Go/No-Go**: ✅ **GO** → Step 33

---

**下一步**: Step 33 - L2 Evidence Data Product
