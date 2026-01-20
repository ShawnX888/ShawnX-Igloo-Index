"""
测试Prediction Run基线的验收用例

Reference: docs/v2/v2实施细则/03-Prediction-Run基线-细则.md
"""

import pytest
from datetime import datetime, timezone

from app.schemas.prediction import (
    PredictionRun,
    PredictionRunStatus,
    PredictionRunSource,
    ActiveRunInfo,
    ActiveRunSwitchRequest,
    ActiveRunSwitchRecord,
    PredictionConsistencyCheck,
    PredictionRunCreate,
    PredictionRunUpdate,
)
from app.utils.prediction_run import (
    PredictionConsistencyValidator,
    generate_run_id,
    validate_prediction_request,
    create_active_run_info,
)


class TestEnums:
    """测试枚举类型"""
    
    def test_prediction_run_status_values(self):
        """验证PredictionRunStatus枚举值"""
        assert PredictionRunStatus.ACTIVE.value == "active"
        assert PredictionRunStatus.ARCHIVED.value == "archived"
        assert PredictionRunStatus.FAILED.value == "failed"
        assert PredictionRunStatus.PROCESSING.value == "processing"
    
    def test_prediction_run_source_values(self):
        """验证PredictionRunSource枚举值"""
        assert PredictionRunSource.EXTERNAL_SYNC.value == "external_sync"
        assert PredictionRunSource.MANUAL_BACKFILL.value == "manual_backfill"
        assert PredictionRunSource.SCHEDULED_RERUN.value == "scheduled_rerun"
        assert PredictionRunSource.ROLLBACK.value == "rollback"


class TestPredictionRun:
    """测试PredictionRun Schema"""
    
    def test_create_prediction_run(self):
        """测试创建PredictionRun"""
        run = PredictionRun(
            id="run-2025-01-20-001",
            status=PredictionRunStatus.ACTIVE,
            source=PredictionRunSource.EXTERNAL_SYNC,
            created_at=datetime.now(timezone.utc),
            note="Initial prediction batch"
        )
        
        assert run.id == "run-2025-01-20-001"
        assert run.status == PredictionRunStatus.ACTIVE
        assert run.source == PredictionRunSource.EXTERNAL_SYNC
    
    def test_prediction_run_with_scope(self):
        """测试带维度范围的PredictionRun"""
        run = PredictionRun(
            id="run-2025-01-20-002",
            status=PredictionRunStatus.ACTIVE,
            source=PredictionRunSource.SCHEDULED_RERUN,
            created_at=datetime.now(timezone.utc),
            weather_type="rainfall",  # 维度范围
            product_id="daily_rainfall"
        )
        
        assert run.weather_type == "rainfall"
        assert run.product_id == "daily_rainfall"


class TestActiveRunInfo:
    """测试ActiveRunInfo"""
    
    def test_create_active_run_info(self):
        """测试创建ActiveRunInfo"""
        info = ActiveRunInfo(
            active_run_id="run-2025-01-20-001",
            generated_at=datetime.now(timezone.utc),
            source=PredictionRunSource.EXTERNAL_SYNC,
            scope_description="全局"
        )
        
        assert info.active_run_id == "run-2025-01-20-001"
        assert info.source == PredictionRunSource.EXTERNAL_SYNC


class TestActiveRunSwitch:
    """测试Active Run切换"""
    
    def test_switch_request(self):
        """测试切换请求"""
        request = ActiveRunSwitchRequest(
            new_active_run_id="run-2025-01-20-002",
            reason="Rollback to previous batch due to data quality issue",
            operator="admin@example.com",
            scope="global"
        )
        
        assert request.new_active_run_id == "run-2025-01-20-002"
        assert "Rollback" in request.reason
    
    def test_switch_record(self):
        """测试切换记录"""
        record = ActiveRunSwitchRecord(
            from_run_id="run-2025-01-20-001",
            to_run_id="run-2025-01-20-002",
            switched_at=datetime.now(timezone.utc),
            reason="Rollback",
            operator="admin@example.com",
            scope="global",
            affected_cache_keys=125
        )
        
        assert record.from_run_id == "run-2025-01-20-001"
        assert record.to_run_id == "run-2025-01-20-002"
        assert record.affected_cache_keys == 125


class TestPredictionConsistency:
    """测试预测一致性验证"""
    
    def test_consistent_batches(self):
        """测试一致的批次"""
        data_sources = {
            "l0_dashboard": "run-2025-01-20-001",
            "map_overlays": "run-2025-01-20-001",
            "l1_intelligence": "run-2025-01-20-001"
        }
        
        check = PredictionConsistencyValidator.check_consistency(
            data_sources,
            expected_run_id="run-2025-01-20-001"
        )
        
        assert check.consistent
        assert len(check.prediction_run_ids) == 1
        assert check.prediction_run_ids[0] == "run-2025-01-20-001"
    
    def test_inconsistent_batches(self):
        """测试不一致的批次 - 混用"""
        data_sources = {
            "l0_dashboard": "run-2025-01-20-001",
            "map_overlays": "run-2025-01-20-002",  # 不同批次!
            "l1_intelligence": "run-2025-01-20-001"
        }
        
        check = PredictionConsistencyValidator.check_consistency(
            data_sources,
            expected_run_id="run-2025-01-20-001"
        )
        
        assert not check.consistent
        assert len(check.prediction_run_ids) == 2
        assert check.inconsistent_sources is not None
        assert "map_overlays" in check.inconsistent_sources
        assert check.recommendation is not None
    
    def test_batch_mismatch_with_active(self):
        """测试批次与active_run不匹配"""
        data_sources = {
            "l0_dashboard": "run-2025-01-20-002",
            "map_overlays": "run-2025-01-20-002"
        }
        
        check = PredictionConsistencyValidator.check_consistency(
            data_sources,
            expected_run_id="run-2025-01-20-001"  # active_run是001，但数据是002
        )
        
        assert not check.consistent
        assert check.active_run_id == "run-2025-01-20-001"
        assert "run-2025-01-20-002" in check.prediction_run_ids
        assert "stale" in check.recommendation.lower() or "mismatch" in check.recommendation.lower()
    
    def test_all_historical_data(self):
        """测试全部是historical数据(run_id为None)"""
        data_sources = {
            "l0_dashboard": None,
            "map_overlays": None,
            "l1_intelligence": None
        }
        
        check = PredictionConsistencyValidator.check_consistency(data_sources)
        
        assert check.consistent
        assert len(check.prediction_run_ids) == 0


class TestUtilityFunctions:
    """测试工具函数"""
    
    def test_generate_run_id(self):
        """测试生成run_id"""
        run_id = generate_run_id()
        
        assert run_id.startswith("run-")
        assert len(run_id) > 15  # run-YYYY-MM-DD-...
    
    def test_generate_run_id_with_timestamp(self):
        """测试用指定时间戳生成run_id"""
        timestamp = datetime(2025, 1, 20, 12, 30, 45, tzinfo=timezone.utc)
        run_id = generate_run_id(timestamp, suffix="001")
        
        assert "2025-01-20" in run_id
        assert run_id == "run-2025-01-20-001"
    
    def test_validate_predicted_request_with_run_id(self):
        """测试predicted请求必须带run_id"""
        valid, error = validate_prediction_request("predicted", "run-2025-01-20-001")
        assert valid
        assert error is None
    
    def test_validate_predicted_request_without_run_id(self):
        """测试predicted请求缺少run_id会失败"""
        valid, error = validate_prediction_request("predicted", None)
        assert not valid
        assert "required" in error.lower()
    
    def test_validate_historical_request_without_run_id(self):
        """测试historical请求不能带run_id"""
        valid, error = validate_prediction_request("historical", None)
        assert valid
        assert error is None
    
    def test_validate_historical_request_with_run_id(self):
        """测试historical请求带run_id会失败"""
        valid, error = validate_prediction_request("historical", "run-2025-01-20-001")
        assert not valid
        assert "must not" in error.lower()
    
    def test_create_active_run_info(self):
        """测试创建ActiveRunInfo"""
        run = PredictionRun(
            id="run-2025-01-20-001",
            status=PredictionRunStatus.ACTIVE,
            source=PredictionRunSource.EXTERNAL_SYNC,
            created_at=datetime.now(timezone.utc),
            weather_type="rainfall"
        )
        
        info = create_active_run_info(run)
        
        assert info.active_run_id == "run-2025-01-20-001"
        assert info.source == PredictionRunSource.EXTERNAL_SYNC
        assert info.scope_description is not None
        assert "rainfall" in info.scope_description.lower()


class TestBatchConsistencyValidation:
    """
    测试批次一致性验证
    
    这是Step 03的核心验收标准
    """
    
    def test_no_batch_mixing_in_single_request(self):
        """
        验收用例: 同一请求链路内不出现不同run_id
        
        这是P0约束
        """
        # 模拟一次页面刷新，多个数据产品返回
        l0_run_id = "run-2025-01-20-001"
        l1_run_id = "run-2025-01-20-001"
        overlays_run_id = "run-2025-01-20-001"
        
        check = PredictionConsistencyValidator.check_consistency({
            "l0_dashboard": l0_run_id,
            "l1_intelligence": l1_run_id,
            "map_overlays": overlays_run_id
        })
        
        assert check.consistent, "Same run_id must be consistent"
        
        # 如果混用不同批次
        check_mixed = PredictionConsistencyValidator.check_consistency({
            "l0_dashboard": "run-2025-01-20-001",
            "map_overlays": "run-2025-01-20-002"  # 不同批次!
        })
        
        assert not check_mixed.consistent, "Mixed batches must be detected"
        assert check_mixed.recommendation is not None
