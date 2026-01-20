"""
Prediction Run 管理工具

职责:
- 管理 active_run 的获取和切换
- 验证 prediction_run_id 一致性
- 处理缓存失效
- 记录批次切换审计日志

Reference:
- docs/v2/v2实施细则/03-Prediction-Run基线-细则.md
- docs/v2/v2技术方案.md Section 15 (预测批次一致性模型)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from app.schemas.prediction import (
    ActiveRunInfo,
    ActiveRunSwitchRecord,
    ActiveRunSwitchRequest,
    PredictionConsistencyCheck,
    PredictionRun,
    PredictionRunSource,
    PredictionRunStatus,
)

logger = logging.getLogger(__name__)


class ActiveRunManager:
    """
    Active Run 管理器
    
    职责:
    - 获取当前 active_run
    - 切换 active_run (含回滚)
    - 触发相关缓存失效
    - 记录审计日志
    
    MVP实现: 全局单一 active_run
    未来扩展: 按 weather_type/product/region_scope 分维度管理
    """
    
    def __init__(self):
        """初始化Active Run管理器"""
        # TODO: 注入数据库会话和缓存客户端
        # self.db_session = db_session
        # self.cache_client = cache_client
        pass
    
    async def get_active_run(
        self,
        weather_type: Optional[str] = None,
        product_id: Optional[str] = None,
        region_scope: Optional[str] = None
    ) -> Optional[PredictionRun]:
        """
        获取当前 active_run
        
        MVP实现: 全局单一 active_run (忽略维度参数)
        未来扩展: 根据维度返回对应的 active_run
        
        Args:
            weather_type: 天气类型(可选,未来扩展)
            product_id: 产品ID(可选,未来扩展)
            region_scope: 区域范围(可选,未来扩展)
            
        Returns:
            当前active的PredictionRun，如果不存在则返回None
        """
        # TODO: 从数据库查询
        # result = await self.db_session.execute(
        #     select(PredictionRun)
        #     .where(PredictionRun.status == PredictionRunStatus.ACTIVE)
        #     # .where(...) # 根据维度过滤
        #     .order_by(PredictionRun.created_at.desc())
        #     .limit(1)
        # )
        # return result.scalar_one_or_none()
        
        logger.info(
            "Fetching active run",
            extra={
                "weather_type": weather_type,
                "product_id": product_id,
                "region_scope": region_scope,
            }
        )
        
        # 临时返回None (实际实现在 Step 10: 预测批次表 + Service)
        return None
    
    async def get_active_run_id(
        self,
        weather_type: Optional[str] = None,
        product_id: Optional[str] = None,
        region_scope: Optional[str] = None
    ) -> Optional[str]:
        """
        快速获取 active_run_id (不需要完整对象)
        
        Returns:
            active_run_id 或 None
        """
        active_run = await self.get_active_run(weather_type, product_id, region_scope)
        return active_run.id if active_run else None
    
    async def switch_active_run(
        self,
        request: ActiveRunSwitchRequest
    ) -> ActiveRunSwitchRecord:
        """
        切换 active_run
        
        流程:
        1. 验证 new_active_run_id 存在且可用
        2. 获取当前 active_run_id
        3. 更新数据库: 旧run设为archived, 新run设为active
        4. 触发缓存失效
        5. 记录审计日志
        
        Args:
            request: 切换请求
            
        Returns:
            切换记录
        """
        # 1. 验证新批次存在
        # TODO: 查询数据库验证
        # new_run = await self._validate_run_exists(request.new_active_run_id)
        
        # 2. 获取当前active_run
        current_active = await self.get_active_run()
        from_run_id = current_active.id if current_active else "none"
        
        # 3. 执行切换
        # TODO: 数据库事务
        # async with self.db_session.begin():
        #     # 将旧run设为archived
        #     if current_active:
        #         current_active.status = PredictionRunStatus.ARCHIVED
        #     # 将新run设为active
        #     new_run.status = PredictionRunStatus.ACTIVE
        
        # 4. 触发缓存失效
        affected_cache_keys = await self._invalidate_predicted_caches(
            from_run_id,
            request.new_active_run_id
        )
        
        # 5. 记录审计
        record = ActiveRunSwitchRecord(
            from_run_id=from_run_id,
            to_run_id=request.new_active_run_id,
            switched_at=datetime.now(timezone.utc),
            reason=request.reason,
            operator=request.operator,
            scope=request.scope or "global",
            affected_cache_keys=affected_cache_keys,
        )
        
        self._log_active_run_switch(record)
        
        return record
    
    async def rollback_to_previous_run(
        self,
        reason: str,
        operator: Optional[str] = None
    ) -> Optional[ActiveRunSwitchRecord]:
        """
        回滚到上一个批次
        
        场景: 发现当前批次有问题，需要回滚
        
        Args:
            reason: 回滚原因
            operator: 操作者
            
        Returns:
            切换记录，如果没有可回滚的批次则返回None
        """
        # 1. 获取当前active和上一个archived批次
        current_active = await self.get_active_run()
        if not current_active:
            logger.warning("No active run to rollback from")
            return None
        
        # TODO: 查询上一个archived批次
        # previous_run = await self._get_previous_archived_run()
        # if not previous_run:
        #     logger.warning("No previous run available for rollback")
        #     return None
        
        # 2. 执行切换
        switch_request = ActiveRunSwitchRequest(
            new_active_run_id="previous_run_id",  # TODO: 实际ID
            reason=f"ROLLBACK: {reason}",
            operator=operator,
            scope="global"
        )
        
        return await self.switch_active_run(switch_request)
    
    async def _invalidate_predicted_caches(
        self,
        old_run_id: str,
        new_run_id: str
    ) -> int:
        """
        失效 predicted 相关缓存
        
        策略: 按数据产品类别批量失效
        
        Returns:
            失效的缓存key数量
        """
        # TODO: 实现缓存失效逻辑
        # 失效的key模式: 所有包含 old_run_id 的缓存
        # pattern = f"*|run:{old_run_id}"
        # affected = await self.cache_client.delete_pattern(pattern)
        
        logger.info(
            f"Invalidating predicted caches: {old_run_id} → {new_run_id}",
            extra={
                "old_run_id": old_run_id,
                "new_run_id": new_run_id,
                "affected_count": 0,  # TODO: 实际数量
            }
        )
        
        return 0  # TODO: 返回实际失效数量
    
    def _log_active_run_switch(self, record: ActiveRunSwitchRecord):
        """记录 active_run 切换审计日志"""
        logger.warning(
            f"Active run switched: {record.from_run_id} → {record.to_run_id}",
            extra={
                "from_run_id": record.from_run_id,
                "to_run_id": record.to_run_id,
                "switched_at": record.switched_at.isoformat(),
                "reason": record.reason,
                "operator": record.operator,
                "scope": record.scope,
                "affected_cache_keys": record.affected_cache_keys,
            }
        )


class PredictionConsistencyValidator:
    """
    预测一致性验证器
    
    职责: 验证同一请求链路中是否混用了不同批次
    """
    
    @staticmethod
    def check_consistency(
        data_sources: dict[str, Optional[str]],
        expected_run_id: Optional[str] = None
    ) -> PredictionConsistencyCheck:
        """
        检查多个数据源的批次一致性
        
        Args:
            data_sources: 数据源名称 → prediction_run_id 的映射
                         如: {"l0_dashboard": "run-001", "map_overlays": "run-001"}
            expected_run_id: 期望的批次ID(如: active_run_id)
            
        Returns:
            一致性检查结果
        """
        # 过滤掉 None 值
        valid_run_ids = [
            run_id for run_id in data_sources.values() 
            if run_id is not None
        ]
        
        if not valid_run_ids:
            # 所有数据源都是 None (可能都是 historical)
            return PredictionConsistencyCheck(
                consistent=True,
                prediction_run_ids=[],
                active_run_id=expected_run_id
            )
        
        # 检查是否所有run_id相同
        unique_run_ids = list(set(valid_run_ids))
        consistent = len(unique_run_ids) == 1
        
        if not consistent:
            # 发现不一致
            inconsistent_sources = [
                source for source, run_id in data_sources.items()
                if run_id is not None and run_id != unique_run_ids[0]
            ]
            
            return PredictionConsistencyCheck(
                consistent=False,
                prediction_run_ids=unique_run_ids,
                active_run_id=expected_run_id,
                inconsistent_sources=inconsistent_sources,
                recommendation=(
                    f"Mixed prediction batches detected. "
                    f"Expected: {expected_run_id}, "
                    f"Found: {', '.join(unique_run_ids)}. "
                    f"Please invalidate caches and retry."
                )
            )
        
        # 一致，但检查是否与expected_run_id匹配
        actual_run_id = unique_run_ids[0]
        if expected_run_id and actual_run_id != expected_run_id:
            return PredictionConsistencyCheck(
                consistent=False,
                prediction_run_ids=[actual_run_id],
                active_run_id=expected_run_id,
                inconsistent_sources=list(data_sources.keys()),
                recommendation=(
                    f"Prediction batch mismatch. "
                    f"Expected active_run: {expected_run_id}, "
                    f"but got: {actual_run_id}. "
                    f"Cache may be stale."
                )
            )
        
        return PredictionConsistencyCheck(
            consistent=True,
            prediction_run_ids=[actual_run_id],
            active_run_id=expected_run_id
        )


def generate_run_id(
    timestamp: Optional[datetime] = None,
    suffix: Optional[str] = None
) -> str:
    """
    生成 prediction_run_id
    
    格式: run-YYYY-MM-DD-NNN
    
    Args:
        timestamp: 批次时间(默认当前UTC时间)
        suffix: 可选后缀(如: 001, 002)
        
    Returns:
        prediction_run_id
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    
    date_str = timestamp.strftime("%Y-%m-%d")
    
    if suffix:
        return f"run-{date_str}-{suffix}"
    else:
        # 使用时间戳作为唯一性保证
        time_str = timestamp.strftime("%H%M%S")
        return f"run-{date_str}-{time_str}"


async def get_or_create_active_run(
    source: PredictionRunSource = PredictionRunSource.EXTERNAL_SYNC,
    note: Optional[str] = None
) -> str:
    """
    获取或创建 active_run_id
    
    用于天气数据同步等场景: 如果没有active_run，自动创建一个
    
    Args:
        source: 批次来源
        note: 备注
        
    Returns:
        active_run_id
    """
    manager = ActiveRunManager()
    
    # 1. 尝试获取现有 active_run
    active_run = await manager.get_active_run()
    if active_run:
        return active_run.id
    
    # 2. 如果不存在，创建新的
    new_run_id = generate_run_id()
    
    # TODO: 创建新的 PredictionRun 并设为 active
    # new_run = PredictionRun(
    #     id=new_run_id,
    #     status=PredictionRunStatus.ACTIVE,
    #     source=source,
    #     note=note or "Auto-created active run",
    #     created_at=datetime.now(timezone.utc)
    # )
    # await db.save(new_run)
    
    logger.info(
        f"Created new active run: {new_run_id}",
        extra={
            "prediction_run_id": new_run_id,
            "source": source.value,
            "note": note,
        }
    )
    
    return new_run_id


def validate_prediction_request(
    data_type: str,
    prediction_run_id: Optional[str]
) -> tuple[bool, Optional[str]]:
    """
    验证 predicted 请求的 run_id
    
    硬规则:
    - data_type='predicted' 时必须提供 prediction_run_id
    - data_type='historical' 时不能提供 prediction_run_id
    
    Args:
        data_type: 数据类型
        prediction_run_id: 预测批次ID
        
    Returns:
        (是否有效, 错误信息)
    """
    if data_type == "predicted":
        if not prediction_run_id:
            return False, "prediction_run_id is required when data_type is predicted"
    elif data_type == "historical":
        if prediction_run_id:
            return False, "prediction_run_id must not be provided when data_type is historical"
    
    return True, None


def create_active_run_info(run: PredictionRun) -> ActiveRunInfo:
    """
    创建 ActiveRunInfo (用于响应中标注批次)
    
    Args:
        run: PredictionRun对象
        
    Returns:
        ActiveRunInfo
    """
    scope_desc = "全局"
    if run.weather_type:
        scope_desc = f"天气类型: {run.weather_type}"
    if run.product_id:
        scope_desc += f", 产品: {run.product_id}"
    
    return ActiveRunInfo(
        active_run_id=run.id,
        generated_at=run.created_at,
        source=run.source,
        scope_description=scope_desc if scope_desc != "全局" else None
    )
