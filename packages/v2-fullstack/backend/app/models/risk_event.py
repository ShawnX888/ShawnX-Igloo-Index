"""
Risk Event Model (风险事件表)

存储风险计算结果

Reference:
- docs/v2/v2实施细则/09-风险事件表与Risk-Service-细则.md

硬规则:
- predicted必须包含prediction_run_id
- 关联product和policy
"""

from datetime import datetime, timezone as tz
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.product import Product


class RiskEvent(Base):
    """风险事件表"""
    
    __tablename__ = "risk_events"
    
    id = Column(String(50), primary_key=True, comment="事件ID")
    
    # 时空维度
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="事件时间(UTC)"
    )
    region_code = Column(
        String(20),
        nullable=False,
        index=True,
        comment="区域代码"
    )
    
    # 产品关联
    product_id = Column(
        String(50),
        ForeignKey("products.id"),
        nullable=False,
        index=True,
        comment="产品ID"
    )
    product_version = Column(
        String(20),
        nullable=False,
        comment="产品版本(可追溯)"
    )
    
    # 风险信息
    weather_type = Column(
        String(20),
        nullable=False,
        index=True,
        comment="天气类型"
    )
    tier_level = Column(
        Integer,
        nullable=False,
        comment="风险等级(1/2/3)"
    )
    trigger_value = Column(
        Numeric(10, 2),
        nullable=False,
        comment="触发值"
    )
    threshold_value = Column(
        Numeric(10, 2),
        nullable=False,
        comment="阈值"
    )
    
    # 数据类型
    data_type = Column(
        String(20),
        nullable=False,
        index=True,
        comment="historical/predicted"
    )
    prediction_run_id = Column(
        String(50),
        nullable=True,
        index=True,
        comment="预测批次ID(predicted必须)"
    )
    
    # 审计
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz.utc),
        comment="创建时间(UTC)"
    )
    
    __table_args__ = (
        Index(
            'idx_risk_query',
            'region_code', 'weather_type', 'data_type', 'timestamp'
        ),
        Index(
            'idx_risk_predicted',
            'prediction_run_id', 'product_id', 'timestamp'
        ),
    )
