# Phase 1 - Step 14-15: Celery异步任务 - 实施总结

**实施日期**: 2026-01-21 | **状态**: ✅ 计算逻辑完成（historical）

---

## 核心交付

1. **Celery配置**: Redis broker/backend（env 可配置）, UTC timezone
2. **风险计算任务**: `calculate_risk_events_task`（historical only + 计算落库）
3. **幂等与并发控制**: Redis锁 + 可复现事件ID去重
4. **扩展窗口计算**: timeWindow → calculation_range 回溯
5. **DB唯一约束迁移**: historical 风险事件部分唯一索引（Alembic）

---

## 配置

```python
celery_app = Celery(
    "igloo",
    broker=os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL")),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
)
```

---

## 任务定义

```python
@celery_app.task(bind=True, max_retries=3)
def calculate_risk_events_task(
    product_id, region_code, 
    time_range_start, time_range_end,
    prediction_run_id=None
):
    # 1. Redis分布式锁
    # 2. 扩展窗口查询天气数据（historical）
    # 3. 调用RiskCalculator裁剪回time_range
    # 4. 幂等写入risk_events
```

---

## 验收状态

- [x] Celery配置
- [x] 任务框架
- [x] 实际计算逻辑（Step 15 细则）
- [x] Redis并发锁（Step 15 细则）
- [x] 历史/预测职责边界落地（predicted 由 weather_sync 触发）

**Status**: Phase 1 基础表和框架全部完成
**备注**: Step 15 已完成历史风险事件计算与幂等写入；缓存失效仍由数据产品层负责；Alembic 已初始化并新增历史唯一索引迁移。

---

## Phase 1 完成总结

**完成步骤**: Step 05-15 (11个步骤)

**核心成就**:
- ✅ 5张核心表: products, policies, weather_data, risk_events, prediction_runs
- ✅ 5个Service: Product, Policy, Weather, Risk Calculator, Prediction Run
- ✅ API框架: Products + Data Products
- ✅ 异步任务框架: Celery

**代码总量**: ~3,500行 (models + schemas + services + tests)

**下一阶段**: Phase 2 - 前端核心页面与交互
