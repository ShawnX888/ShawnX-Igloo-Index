"""
Risk Event Schemas

风险事件相关schemas
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.shared import DataType, WeatherType


class RiskEventBase(BaseModel):
    """风险事件基础信息"""
    model_config = ConfigDict(from_attributes=True)
    
    timestamp: datetime = Field(..., description="事件时间(UTC)")
    region_code: str = Field(..., description="区域代码")
    product_id: str = Field(..., description="产品ID")
    weather_type: WeatherType = Field(..., description="天气类型")
    tier_level: int = Field(..., ge=1, le=3, description="风险等级")
    trigger_value: Decimal = Field(..., description="触发值")
    threshold_value: Decimal = Field(..., description="阈值")
    data_type: DataType = Field(..., description="数据类型")
    prediction_run_id: Optional[str] = Field(None, description="预测批次ID")


class RiskEventCreate(RiskEventBase):
    """创建风险事件"""
    id: str
    product_version: str


class RiskEventResponse(RiskEventBase):
    """风险事件响应"""
    id: str
    product_version: str
    created_at: datetime
