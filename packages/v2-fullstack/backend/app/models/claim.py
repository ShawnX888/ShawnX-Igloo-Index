"""
Claim Model (理赔表)

职责: 存储理赔记录,包括:
- 理赔基本信息 (policy, product关联)
- 赔付金额与比例 (Decimal精度)
- 触发信息 (tier, 时间)
- 审计追溯 (rules_hash, source)

Reference:
- docs/v2/v2实施细则/30-理赔表与Claim-Service-细则.md
- RD-产品库与规则契约.md

硬规则:
- predicted不生成claims (只存储historical)
- payout_amount使用Decimal
- 幂等写入 (唯一约束)
- Mode裁剪敏感字段
"""

from datetime import datetime, timezone as tz
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Index, Integer, 
    Numeric, String, UniqueConstraint
)
from sqlalchemy.orm import relationship, Mapped

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.policy import Policy
    from app.models.product import Product
    from app.models.risk_event import RiskEvent


class Claim(Base):
    """
    理赔表
    
    关键字段:
    - policy_id: 关联保单
    - product_id: 关联产品
    - tier_level: 触发档位
    - payout_amount: 赔付金额 (Decimal)
    - triggered_at: 触发时间 (UTC)
    
    硬规则:
    - 只存储historical数据
    - 幂等写入 (唯一约束)
    """
    
    __tablename__ = "claims"
    
    # 主键
    id = Column(String(50), primary_key=True, comment="理赔ID")
    
    # 关联
    policy_id = Column(
        String(50),
        ForeignKey("policies.id"),
        nullable=False,
        index=True,
        comment="保单ID"
    )
    product_id = Column(
        String(50),
        ForeignKey("products.id"),
        nullable=False,
        index=True,
        comment="产品ID"
    )
    risk_event_id = Column(
        String(50),
        ForeignKey("risk_events.id"),
        nullable=True,
        index=True,
        comment="关联风险事件ID (可选)"
    )
    
    # 区域信息 (冗余,便于查询)
    region_code = Column(
        String(20),
        nullable=False,
        index=True,
        comment="区域代码 (来自policy.coverage_region)"
    )
    
    # 赔付信息
    tier_level = Column(
        Integer,
        nullable=False,
        index=True,
        comment="触发档位 (1/2/3)"
    )
    payout_percentage = Column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="赔付比例 (如20.00表示20%)"
    )
    payout_amount = Column(
        Numeric(precision=18, scale=2),
        nullable=False,
        comment="赔付金额 (Decimal)"
    )
    currency = Column(
        String(10),
        nullable=False,
        default="CNY",
        comment="货币代码"
    )
    
    # 时间信息
    triggered_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="触发时间 (UTC)"
    )
    period_start = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="赔付周期起始 (UTC, 可选)"
    )
    period_end = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="赔付周期结束 (UTC, 可选)"
    )
    
    # 状态
    status = Column(
        String(20),
        nullable=False,
        default="computed",
        index=True,
        comment="状态: computed/approved/paid/voided"
    )
    
    # 审计追溯
    product_version = Column(
        String(20),
        nullable=False,
        comment="产品版本 (可追溯)"
    )
    rules_hash = Column(
        String(64),
        nullable=True,
        comment="规则哈希 (可选,用于审计)"
    )
    source = Column(
        String(50),
        nullable=False,
        default="task",
        comment="来源: task/manual_repair/backfill"
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
    if TYPE_CHECKING:
        policy: Mapped["Policy"] = relationship(
            "Policy",
            back_populates="claims",
            lazy="selectin"
        )
        product: Mapped["Product"] = relationship(
            "Product",
            back_populates="claims",
            lazy="selectin"
        )
        risk_event: Mapped["RiskEvent"] = relationship(
            "RiskEvent",
            back_populates="claims",
            lazy="selectin"
        )
    else:
        policy = relationship("Policy", back_populates="claims", lazy="selectin")
        product = relationship("Product", back_populates="claims", lazy="selectin")
        risk_event = relationship("RiskEvent", back_populates="claims", lazy="selectin")
    
    # 唯一约束 (幂等写入)
    __table_args__ = (
        UniqueConstraint(
            'policy_id', 'triggered_at', 'tier_level',
            name='uq_claim_policy_time_tier'
        ),
        Index(
            'idx_claim_query',
            'policy_id', 'triggered_at', 'status'
        ),
        Index(
            'idx_claim_region_time',
            'region_code', 'triggered_at'
        ),
    )
    
    def __repr__(self) -> str:
        return (
            f"<Claim("
            f"id='{self.id}', "
            f"policy_id='{self.policy_id}', "
            f"tier={self.tier_level}, "
            f"amount={self.payout_amount}"
            f")>"
        )
