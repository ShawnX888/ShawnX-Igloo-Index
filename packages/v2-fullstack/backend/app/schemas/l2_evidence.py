"""
L2 Evidence Schemas

证据链数据产品schemas

Reference:
- docs/v2/v2实施细则/33-L2-Evidence数据产品-细则.md
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.shared import AccessMode, DataType, RegionScope, WeatherType
from app.schemas.time import CalculationRangeUTC, TimeRangeUTC


class L2Summary(BaseModel):
    """L2摘要"""
    model_config = ConfigDict(from_attributes=True)
    
    risk_event_count: int = Field(..., description="风险事件数量")
    claim_count: int = Field(..., description="理赔数量")
    total_payout: Optional[Decimal] = Field(None, description="总赔付(Mode裁剪)")
    max_tier: int = Field(..., description="最高tier级别")


class L2RiskEvent(BaseModel):
    """L2风险事件"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    timestamp: datetime
    tier_level: int
    trigger_value: Decimal
    threshold_value: Decimal
    weather_type: WeatherType
    data_type: DataType
    prediction_run_id: Optional[str] = None


class L2Claim(BaseModel):
    """L2理赔"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    policy_id: str
    tier_level: int
    payout_percentage: Decimal
    payout_amount: Optional[Decimal] = None  # Mode裁剪
    triggered_at: datetime
    status: str


class L2WeatherEvidence(BaseModel):
    """L2天气证据"""
    model_config = ConfigDict(from_attributes=True)
    
    timestamp: datetime
    value: Decimal
    unit: str
    weather_type: WeatherType


class L2EvidenceResponse(BaseModel):
    """L2 Evidence响应"""
    model_config = ConfigDict(from_attributes=True)
    
    meta: "L2EvidenceMeta"
    summary: L2Summary
    risk_events: List[L2RiskEvent] = Field(default_factory=list)
    claims: List[L2Claim] = Field(default_factory=list)
    weather_evidence: List[L2WeatherEvidence] = Field(default_factory=list)
    
    # 回指信息
    map_ref: dict = Field(default_factory=dict)
    timeline_ref: dict = Field(default_factory=dict)


class L2EvidenceMeta(BaseModel):
    """L2 Evidence元信息"""
    model_config = ConfigDict(from_attributes=True)

    region_scope: RegionScope
    region_code: str
    time_range: TimeRangeUTC
    data_type: DataType
    weather_type: WeatherType
    access_mode: AccessMode
    product_id: Optional[str] = None
    prediction_run_id: Optional[str] = None
    region_timezone: Optional[str] = None
    product_version: Optional[str] = None
    rules_hash: Optional[str] = None
    calculation_range: Optional[CalculationRangeUTC] = None


class L2EvidenceRequest(BaseModel):
    """L2 Evidence请求"""
    model_config = ConfigDict(from_attributes=True)
    
    region_scope: RegionScope
    region_code: str
    time_range: Optional[TimeRangeUTC] = None
    time_range_start: Optional[datetime] = None
    time_range_end: Optional[datetime] = None
    data_type: DataType
    weather_type: WeatherType
    access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    product_id: Optional[str] = None
    prediction_run_id: Optional[str] = None
    
    # 焦点
    focus_type: Optional[str] = Field(None, description="risk_event/claim/time_cursor")
    focus_id: Optional[str] = None
    cursor_time_utc: Optional[datetime] = None

    # 分页
    page_size: int = Field(default=50, ge=1, le=200)
    cursor: Optional[int] = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _validate_ranges_and_prediction(self) -> "L2EvidenceRequest":
        if self.time_range is None:
            if not self.time_range_start or not self.time_range_end:
                raise ValueError("time_range or time_range_start/end is required")
            self.time_range = TimeRangeUTC(
                start=self.time_range_start,
                end=self.time_range_end,
                region_timezone=None,
            )

        if self.data_type == DataType.PREDICTED and not self.prediction_run_id:
            raise ValueError("prediction_run_id required for predicted")
        if self.data_type == DataType.HISTORICAL and self.prediction_run_id is not None:
            raise ValueError("prediction_run_id must be null for historical")

        if self.focus_type and self.focus_type not in {"risk_event", "claim", "time_cursor"}:
            raise ValueError("focus_type must be risk_event/claim/time_cursor")
        return self


L2EvidenceResponse.model_rebuild()
