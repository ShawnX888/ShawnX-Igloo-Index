"""
Policy Model (保单表)

职责: 存储保单信息,包括:
- 保单基本信息 (policy_number, holder)
- 覆盖配置 (产品、区域、保额、时间)
- 时区 (timezone: 用于业务边界对齐)

Reference:
- docs/v2/v2实施细则/06-保单表与Policy-Service-细则.md

硬规则:
- timezone 字段必须 (用于 per day/month 判断)
- coverage_amount 使用 Decimal (避免浮点误差)
"""

from datetime import datetime, timezone as tz
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.product import Product


class Policy(Base):
    """
    保单表
    
    关键字段:
    - policy_number: 保单号
    - product_id: 关联产品
    - coverage_region: 覆盖区域
    - coverage_amount: 保额 (Decimal)
    - timezone: 风险地时区 (必须)
    - coverage_start/end: 保障期间 (UTC)
    """
    
    __tablename__ = "policies"
    
    # 主键
    id = Column(String(50), primary_key=True, comment="保单ID")
    
    # 保单信息
    policy_number = Column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
        comment="保单号"
    )
    
    # 产品关联
    product_id = Column(
        String(50),
        ForeignKey("products.id"),
        nullable=False,
        index=True,
        comment="产品ID"
    )
    
    # 覆盖配置
    coverage_region = Column(
        String(20),
        nullable=False,
        index=True,
        comment="覆盖区域代码 (如: CN-GD)"
    )
    coverage_amount = Column(
        Numeric(precision=18, scale=2),
        nullable=False,
        comment="保额 (使用Decimal,避免浮点误差)"
    )
    
    # 时间配置 (CRITICAL)
    timezone = Column(
        String(50),
        nullable=False,
        comment="风险地时区 (如: Asia/Shanghai) - 用于业务边界对齐"
    )
    coverage_start = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="保障开始时间 (UTC)"
    )
    coverage_end = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="保障结束时间 (UTC)"
    )
    
    # 持有人信息 (可选, MVP可脱敏或省略)
    holder_name = Column(
        String(100),
        nullable=True,
        comment="持有人姓名 (可脱敏)"
    )
    holder_contact = Column(
        String(100),
        nullable=True,
        comment="联系方式 (可脱敏)"
    )
    
    # 状态
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="是否有效"
    )
    
    # 审计字段
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz.utc),
        comment="创建时间 (UTC)"
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz.utc),
        onupdate=lambda: datetime.now(tz.utc),
        comment="更新时间 (UTC)"
    )
    
    # Relationships
    product: "Product" = relationship(
        "Product",
        back_populates="policies",
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return (
            f"<Policy("
            f"id='{self.id}', "
            f"policy_number='{self.policy_number}', "
            f"product_id='{self.product_id}', "
            f"coverage_region='{self.coverage_region}', "
            f"timezone='{self.timezone}'"
            f")>"
        )
