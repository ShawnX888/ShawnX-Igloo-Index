"""
Claim Schemas (理赔配置)

定义理赔相关的Pydantic schemas

Reference:
- docs/v2/v2实施细则/30-理赔表与Claim-Service-细则.md

硬规则:
- predicted不生成claims
- payout_amount使用Decimal
- Mode裁剪敏感字段
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ClaimBase(BaseModel):
    """理赔基础信息"""
    model_config = ConfigDict(from_attributes=True)
    
    policy_id: str = Field(..., description="保单ID")
    product_id: str = Field(..., description="产品ID")
    risk_event_id: Optional[str] = Field(None, description="风险事件ID")
    region_code: str = Field(..., description="区域代码")
    tier_level: int = Field(..., ge=1, le=3, description="触发档位")
    payout_percentage: Decimal = Field(..., ge=0, le=100, description="赔付比例")
    payout_amount: Decimal = Field(..., ge=0, description="赔付金额")
    currency: str = Field(default="CNY", description="货币代码")
    triggered_at: datetime = Field(..., description="触发时间(UTC)")
    period_start: Optional[datetime] = Field(None, description="赔付周期起始")
    period_end: Optional[datetime] = Field(None, description="赔付周期结束")
    status: str = Field(default="computed", description="状态")
    product_version: str = Field(..., description="产品版本")
    rules_hash: Optional[str] = Field(None, description="规则哈希")
    source: str = Field(default="task", description="来源")


class ClaimCreate(ClaimBase):
    """创建理赔请求"""
    id: str = Field(..., description="理赔ID")


class ClaimUpdate(BaseModel):
    """更新理赔"""
    model_config = ConfigDict(from_attributes=True)
    
    status: Optional[str] = None
    payout_amount: Optional[Decimal] = Field(None, ge=0)


class Claim(ClaimBase):
    """完整理赔信息"""
    id: str = Field(..., description="理赔ID")
    created_at: datetime = Field(..., description="创建时间(UTC)")
    updated_at: datetime = Field(..., description="更新时间(UTC)")


class ClaimListItem(BaseModel):
    """理赔列表项 (简化版)"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    policy_id: str
    product_id: str
    region_code: str
    tier_level: int
    payout_amount: Optional[Decimal] = None  # Mode裁剪
    triggered_at: datetime
    status: str


class ClaimStats(BaseModel):
    """理赔统计"""
    model_config = ConfigDict(from_attributes=True)
    
    claim_count: int = Field(..., description="理赔数量")
    payout_amount_sum: Optional[Decimal] = Field(None, description="总赔付金额")
    by_tier: Optional[dict[str, int]] = Field(None, description="按档位分组")
    by_product: Optional[dict[str, int]] = Field(None, description="按产品分组")
    by_region: Optional[dict[str, int]] = Field(None, description="按区域分组")


class ClaimFilter(BaseModel):
    """理赔查询过滤器"""
    model_config = ConfigDict(from_attributes=True)
    
    policy_id: Optional[str] = None
    product_id: Optional[str] = None
    region_code: Optional[str] = None
    status: Optional[str] = None
    tier_level: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = Field(default=100, ge=1, le=1000)
