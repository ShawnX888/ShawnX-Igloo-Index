"""
Prediction Run Model (预测批次表)

存储预测批次元信息

Reference:
- docs/v2/v2实施细则/10-预测批次表与Service-细则.md
- Phase 0 Step 03: Prediction Run基线
"""

from datetime import datetime, timezone as tz

from sqlalchemy import Column, DateTime, String, Text

from app.models.base import Base


class PredictionRun(Base):
    """预测批次表"""
    
    __tablename__ = "prediction_runs"
    
    id = Column(
        String(50),
        primary_key=True,
        comment="批次ID (run-YYYY-MM-DD-NNN)"
    )
    status = Column(
        String(20),
        nullable=False,
        index=True,
        comment="active/archived/failed/processing"
    )
    source = Column(
        String(50),
        nullable=False,
        comment="external_sync/manual_backfill/scheduled_rerun/rollback"
    )
    note = Column(
        Text,
        nullable=True,
        comment="备注(如回滚原因)"
    )
    
    # 可选: 维度范围(MVP可先全局)
    weather_type = Column(String(20), nullable=True, comment="天气类型维度")
    product_id = Column(String(50), nullable=True, comment="产品ID维度")
    region_scope = Column(String(20), nullable=True, comment="区域范围维度")
    
    # 审计
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz.utc),
        comment="创建时间(UTC)"
    )
