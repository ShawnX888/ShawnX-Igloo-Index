"""
Weather Schemas

天气数据相关schemas

Reference:
- docs/v2/v2实施细则/07-天气数据表与Weather-Service-细则.md
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.shared import DataType, WeatherType


class WeatherDataPoint(BaseModel):
    """单个天气数据点"""
    model_config = ConfigDict(from_attributes=True)
    
    timestamp: datetime = Field(..., description="时间(UTC)")
    region_code: str = Field(..., description="区域代码")
    weather_type: WeatherType = Field(..., description="天气类型")
    value: Decimal = Field(..., description="数值")
    unit: str = Field(..., description="单位")
    data_type: DataType = Field(..., description="historical/predicted")
    prediction_run_id: Optional[str] = Field(None, description="预测批次ID")


class WeatherQueryRequest(BaseModel):
    """天气数据查询请求"""
    model_config = ConfigDict(from_attributes=True)
    
    region_code: str
    weather_type: WeatherType
    start_time: datetime
    end_time: datetime
    data_type: DataType
    prediction_run_id: Optional[str] = None


class WeatherStats(BaseModel):
    """天气统计"""
    model_config = ConfigDict(from_attributes=True)
    
    sum: Optional[Decimal] = None
    avg: Optional[Decimal] = None
    max: Optional[Decimal] = None
    min: Optional[Decimal] = None
    count: int = Field(..., description="数据点数量")
