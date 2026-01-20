"""
Product Model (产品表)

职责: 存储保险产品配置,包括:
- 产品基本信息 (id, name, type, weather_type)
- 风险规则 (riskRules: 用于风险事件计算)
- 赔付规则 (payoutRules: 用于理赔计算)

Reference:
- docs/v2/v2实施细则/05-产品表与Product-Service-细则.md
- docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md

硬规则:
- riskRules 与 payoutRules 职责隔离
- weather_type 必须与 riskRules 一致
- 规则必须可追溯版本 (version 或 rules_hash)
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, Mapped

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.policy import Policy
    from app.models.risk_event import RiskEvent
    from app.models.claim import Claim


class Product(Base):
    """
    产品表
    
    存储保险产品配置,是风险计算与理赔计算的权威规则来源
    
    关键字段:
    - id: 产品ID (主键, 如 'daily_rainfall', 'weekly_wind')
    - name: 产品名称
    - type: 产品类型 (daily/weekly/monthly)
    - weather_type: 天气类型 (rainfall/wind/temperature)
    - risk_rules: 风险触发规则 (JSONB)
    - payout_rules: 赔付规则 (JSONB)
    - version: 产品配置版本 (用于审计与回溯)
    - is_active: 是否启用 (用于灰度/下线)
    """
    
    __tablename__ = "products"
    
    # 基本信息
    id = Column(
        String(50),
        primary_key=True,
        comment="产品ID (如: daily_rainfall, weekly_wind)"
    )
    name = Column(
        String(100),
        nullable=False,
        comment="产品名称"
    )
    type = Column(
        String(20),
        nullable=False,
        comment="产品类型 (daily/weekly/monthly/drought)"
    )
    weather_type = Column(
        String(20),
        nullable=False,
        index=True,
        comment="天气类型 (rainfall/wind/temperature) - 必须与riskRules一致"
    )
    description = Column(
        Text,
        nullable=True,
        comment="产品描述 (用于前端展示)"
    )
    icon = Column(
        String(50),
        nullable=True,
        comment="产品图标标识 (前端使用)"
    )
    
    # 规则 (JSONB)
    risk_rules = Column(
        JSONB,
        nullable=False,
        comment="""
        产品级风险事件触发规则 (对应 riskRules)
        包含: timeWindow, thresholds, calculation, unit
        示例: {
            "timeWindow": {"type": "daily", "size": 7},
            "thresholds": {"tier1": 50, "tier2": 100, "tier3": 150},
            "calculation": {"aggregation": "sum", "operator": ">="},
            "unit": "mm",
            "weatherType": "rainfall"
        }
        """
    )
    payout_rules = Column(
        JSONB,
        nullable=False,
        comment="""
        保单级赔付规则 (对应 payoutRules)
        包含: frequencyLimit, payoutPercentages, totalCap
        示例: {
            "frequencyLimit": "once_per_day_per_policy",
            "payoutPercentages": {"tier1": 20, "tier2": 50, "tier3": 100},
            "totalCap": 100
        }
        """
    )
    
    # 版本与状态
    version = Column(
        String(20),
        nullable=False,
        default="v1.0.0",
        comment="产品配置版本 (用于审计与回溯)"
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="是否启用 (用于灰度/下线)"
    )
    
    # 审计字段
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="创建时间 (UTC)"
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="更新时间 (UTC)"
    )
    
    # Relationships
    # Note: 使用字符串前向引用避免循环导入
    # Relationships - use Mapped[] for SQLAlchemy 2.0
    if TYPE_CHECKING:
        policies: Mapped[List["Policy"]] = relationship(
            "Policy",
            back_populates="product",
            lazy="selectin"
        )
        
        risk_events: Mapped[List["RiskEvent"]] = relationship(
            "RiskEvent",
            back_populates="product",
            lazy="selectin"
        )
        
        claims: Mapped[List["Claim"]] = relationship(
            "Claim",
            back_populates="product",
            lazy="selectin"
        )
    else:
        policies = relationship(
            "Policy",
            back_populates="product",
            lazy="selectin"
        )
        
        risk_events = relationship(
            "RiskEvent",
            back_populates="product",
            lazy="selectin"
        )
        
        claims = relationship(
            "Claim",
            back_populates="product",
            lazy="selectin"
        )
    
    def __repr__(self) -> str:
        return (
            f"<Product("
            f"id='{self.id}', "
            f"name='{self.name}', "
            f"weather_type='{self.weather_type}', "
            f"version='{self.version}', "
            f"is_active={self.is_active}"
            f")>"
        )
