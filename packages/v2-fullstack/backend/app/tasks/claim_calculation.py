"""
Claim Calculation Celery Tasks

异步计算理赔

Reference:
- docs/v2/v2实施细则/32-理赔计算任务-细则.md

硬规则:
- 只处理historical数据
- Redis分布式锁防止并发
- 幂等写入
"""

import logging
from contextlib import contextmanager
from typing import Generator

import redis

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

# Redis客户端
redis_client = redis.Redis(
    host='localhost',
    port=6379,
    db=2,
    decode_responses=True
)


@contextmanager
def distributed_lock(
    lock_key: str,
    timeout: int = 300
) -> Generator[bool, None, None]:
    """
    Redis分布式锁
    
    Args:
        lock_key: 锁键
        timeout: 超时时间(秒)
        
    Yields:
        是否获取到锁
    """
    lock = redis_client.lock(lock_key, timeout=timeout)
    acquired = lock.acquire(blocking=False)
    
    try:
        yield acquired
    finally:
        if acquired:
            try:
                lock.release()
            except redis.exceptions.LockError:
                pass  # 锁已过期


@celery_app.task(bind=True, max_retries=3)
def calculate_claims_for_policy_task(
    self,
    policy_id: str,
    time_range_start: str,
    time_range_end: str,
    product_id: str = None
):
    """
    计算单个保单的理赔
    
    Args:
        policy_id: 保单ID
        time_range_start: 起始时间(UTC ISO)
        time_range_end: 结束时间(UTC ISO)
        product_id: 产品ID(可选)
    """
    # 分布式锁: 同一保单不允许并发计算
    lock_key = f"claim_calc:policy:{policy_id}"
    
    with distributed_lock(lock_key) as acquired:
        if not acquired:
            logger.warning(
                f"Policy {policy_id} is being processed by another worker, skipping."
            )
            return {
                "status": "skipped",
                "reason": "concurrent_lock"
            }
        
        logger.info(
            f"Calculating claims for policy: {policy_id}",
            extra={
                "policy_id": policy_id,
                "time_range_start": time_range_start,
                "time_range_end": time_range_end,
            }
        )
        
        # TODO: 实现实际计算逻辑
        # 1. 获取policy信息(coverage_amount, timezone, product_id)
        # 2. 获取product的payoutRules
        # 3. 查询risk_events (historical only)
        # 4. 调用ClaimCalculator
        # 5. 幂等写入claims表
        # 6. 失效相关缓存
        
        return {
            "status": "completed",
            "policy_id": policy_id,
            "claims_generated": 0,
        }


@celery_app.task(bind=True, max_retries=3)
def calculate_claims_batch_task(
    self,
    time_range_start: str,
    time_range_end: str,
    region_code: str = None,
    product_id: str = None
):
    """
    批量计算理赔
    
    Args:
        time_range_start: 起始时间(UTC ISO)
        time_range_end: 结束时间(UTC ISO)
        region_code: 区域代码(可选,用于分片)
        product_id: 产品ID(可选,用于过滤)
    """
    logger.info(
        f"Starting batch claim calculation",
        extra={
            "time_range_start": time_range_start,
            "time_range_end": time_range_end,
            "region_code": region_code,
            "product_id": product_id,
        }
    )
    
    # TODO: 实现批量逻辑
    # 1. 查询符合条件的policies
    # 2. 为每个policy派发子任务
    # 3. 收集结果
    # 4. 失效全局缓存
    
    return {
        "status": "completed",
        "policies_processed": 0,
        "claims_generated": 0,
    }
