"""
Weather Data Models (历史/预测天气数据)

支持:
- historical: 单一真值(不可变)
- predicted: 批次版本化(prediction_run_id)

Reference:
- docs/v2/v2实施细则/07-天气数据表与Weather-Service-细则.md
"""

from datetime import datetime, timezone as tz
from decimal import Decimal

from sqlalchemy import Column, DateTime, Index, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base


class WeatherData(Base):
    """
    天气数据表
    
    关键字段:
    - timestamp: 观测/预测时间(UTC)
    - region_code: 区域代码
    - weather_type: 天气类型
    - value: 数值
    - data_type: historical/predicted
    - prediction_run_id: predicted必须
    """
    
    __tablename__ = "weather_data"
    
    # 主键 (复合: timestamp + region + weather_type + data_type + run_id)
    id = Column(String(100), primary_key=True, comment="主键ID")
    
    # 时空维度
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="观测/预测时间(UTC)"
    )
    region_code = Column(
        String(20),
        nullable=False,
        index=True,
        comment="区域代码"
    )
    
    # 天气维度
    weather_type = Column(
        String(20),
        nullable=False,
        index=True,
        comment="天气类型(rainfall/wind/temperature)"
    )
    value = Column(
        Numeric(precision=10, scale=2),
        nullable=False,
        comment="数值"
    )
    unit = Column(
        String(20),
        nullable=False,
        comment="单位(mm/celsius/km_h)"
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
    
    # 空间索引 (H3)
    h3_index = Column(
        String(20),
        nullable=True,
        index=True,
        comment="H3索引(用于空间聚合)"
    )
    
    # 元数据
    metadata_json = Column(
        JSONB,
        nullable=True,
        comment="扩展元数据"
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
            'idx_weather_query',
            'region_code', 'weather_type', 'data_type', 'timestamp'
        ),
        Index(
            'idx_weather_predicted',
            'prediction_run_id', 'weather_type', 'timestamp'
        ),
    )
    
    def __repr__(self) -> str:
        return (
            f"<WeatherData("
            f"timestamp={self.timestamp.isoformat()}, "
            f"region={self.region_code}, "
            f"weather_type={self.weather_type}, "
            f"value={self.value}, "
            f"data_type={self.data_type}"
            f")>"
        )
