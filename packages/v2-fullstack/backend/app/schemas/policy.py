"""
Policy Schemas (保单配置)

定义保单相关的Pydantic schemas

Reference:
- docs/v2/v2实施细则/06-保单表与Policy-Service-细则.md

硬规则:
- timezone 字段必须
- coverage_amount 使用 Decimal
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PolicyBase(BaseModel):
    """保单基础信息"""
    model_config = ConfigDict(from_attributes=True)
    
    policy_number: str = Field(..., description="保单号")
    product_id: str = Field(..., description="产品ID")
    coverage_region: str = Field(..., description="覆盖区域代码")
    coverage_amount: Decimal = Field(..., ge=0, description="保额")
    timezone: str = Field(..., description="风险地时区 (必须)")
    coverage_start: datetime = Field(..., description="保障开始时间(UTC)")
    coverage_end: datetime = Field(..., description="保障结束时间(UTC)")
    holder_name: Optional[str] = Field(None, description="持有人姓名")
    is_active: bool = Field(default=True, description="是否有效")
    
    @field_validator("coverage_end")
    @classmethod
    def validate_coverage_end(cls, v: datetime, info) -> datetime:
        if "coverage_start" in info.data and v <= info.data["coverage_start"]:
            raise ValueError("coverage_end must be after coverage_start")
        return v


class PolicyCreate(PolicyBase):
    """创建保单请求"""
    id: str = Field(..., description="保单ID")


class PolicyUpdate(BaseModel):
    """更新保单"""
    model_config = ConfigDict(from_attributes=True)
    
    coverage_amount: Optional[Decimal] = Field(None, ge=0)
    coverage_end: Optional[datetime] = None
    holder_name: Optional[str] = None
    is_active: Optional[bool] = None


class Policy(PolicyBase):
    """完整保单信息"""
    id: str = Field(..., description="保单ID")
    created_at: datetime = Field(..., description="创建时间(UTC)")
    updated_at: datetime = Field(..., description="更新时间(UTC)")


class PolicyListItem(BaseModel):
    """保单列表项 (简化版)"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    policy_number: str
    product_id: str
    coverage_region: str
    coverage_amount: Optional[Decimal] = None  # Mode裁剪
    is_active: bool


class PolicyStats(BaseModel):
    """保单统计"""
    model_config = ConfigDict(from_attributes=True)
    
    policy_count: int = Field(..., description="保单数量")
    coverage_amount_sum: Optional[Decimal] = Field(None, description="总保额")
    by_product: Optional[dict[str, int]] = Field(None, description="按产品分组")
    by_region: Optional[dict[str, int]] = Field(None, description="按区域分组")
