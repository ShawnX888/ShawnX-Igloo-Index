"""
Access Mode配置管理

职责:
- 获取当前系统的默认Access Mode
- 支持Mode切换与审计
- 提供Mode来源追踪

Reference:
- docs/v2/v2实施细则/02-Access-Mode裁剪基线-细则.md
- docs/v2/v2技术方案.md Section 18 (配置与发布治理)
"""

import logging
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.shared import AccessMode

logger = logging.getLogger(__name__)


class ModeSource(str, Enum):
    """Mode来源类型"""
    ENV = "env"              # 环境变量
    CONFIG = "config"        # 配置文件/中心
    TOKEN = "token"          # 认证token携带
    DEFAULT = "default"      # 系统默认值


class ModeChangeRecord(BaseModel):
    """
    Mode切换记录
    
    用途: 审计Mode切换历史
    """
    model_config = ConfigDict(from_attributes=True)
    
    from_mode: AccessMode = Field(..., description="切换前的Mode")
    to_mode: AccessMode = Field(..., description="切换后的Mode")
    changed_at: datetime = Field(..., description="切换时间(UTC)")
    changed_by: Optional[str] = Field(None, description="操作者")
    reason: Optional[str] = Field(None, description="切换原因")
    impact_scope: Optional[str] = Field(None, description="影响范围")
    source: ModeSource = Field(..., description="Mode来源")


class ModeConfig:
    """
    Access Mode配置管理器
    
    职责:
    - 提供系统默认Mode
    - 支持从环境变量/配置中读取Mode
    - 记录Mode切换审计日志
    """
    
    # 默认Mode (路演场景)
    DEFAULT_MODE = AccessMode.DEMO_PUBLIC
    
    # 环境变量键名
    ENV_KEY = "IGLOO_ACCESS_MODE"
    
    @classmethod
    def get_default_mode(cls) -> AccessMode:
        """
        获取默认Access Mode
        
        优先级:
        1. 环境变量 IGLOO_ACCESS_MODE
        2. 系统默认值 (DEMO_PUBLIC)
        
        Returns:
            默认的Access Mode
        """
        # 尝试从环境变量读取
        env_mode = os.environ.get(cls.ENV_KEY)
        if env_mode:
            try:
                mode = AccessMode(env_mode)
                logger.info(
                    f"Access mode loaded from environment: {mode.value}",
                    extra={
                        "mode": mode.value,
                        "source": ModeSource.ENV.value
                    }
                )
                return mode
            except ValueError:
                logger.warning(
                    f"Invalid access mode in environment: {env_mode}, "
                    f"falling back to default: {cls.DEFAULT_MODE.value}",
                    extra={
                        "invalid_mode": env_mode,
                        "fallback_mode": cls.DEFAULT_MODE.value
                    }
                )
        
        # 使用默认值
        logger.info(
            f"Using default access mode: {cls.DEFAULT_MODE.value}",
            extra={
                "mode": cls.DEFAULT_MODE.value,
                "source": ModeSource.DEFAULT.value
            }
        )
        return cls.DEFAULT_MODE
    
    @classmethod
    def validate_mode(cls, mode: str) -> Optional[AccessMode]:
        """
        验证Mode字符串是否有效
        
        Args:
            mode: Mode字符串
            
        Returns:
            有效的AccessMode，无效则返回None
        """
        try:
            return AccessMode(mode)
        except ValueError:
            return None
    
    @classmethod
    def log_mode_change(
        cls,
        from_mode: AccessMode,
        to_mode: AccessMode,
        changed_by: Optional[str] = None,
        reason: Optional[str] = None,
        impact_scope: Optional[str] = None,
        source: ModeSource = ModeSource.CONFIG
    ):
        """
        记录Mode切换审计日志
        
        Args:
            from_mode: 切换前的Mode
            to_mode: 切换后的Mode
            changed_by: 操作者
            reason: 切换原因
            impact_scope: 影响范围
            source: Mode来源
        """
        record = ModeChangeRecord(
            from_mode=from_mode,
            to_mode=to_mode,
            changed_at=datetime.now(timezone.utc),
            changed_by=changed_by,
            reason=reason,
            impact_scope=impact_scope,
            source=source
        )
        
        logger.warning(
            f"Access mode changed: "
            f"{from_mode.value} → {to_mode.value}",
            extra={
                "from_mode": from_mode.value,
                "to_mode": to_mode.value,
                "changed_by": changed_by,
                "reason": reason,
                "impact_scope": impact_scope,
                "source": source.value,
                "changed_at": record.changed_at.isoformat(),
            }
        )
        
        # TODO: 未来可以持久化到数据库或审计服务
        # await audit_service.log_mode_change(record)


def get_current_mode() -> AccessMode:
    """
    获取当前系统的Access Mode
    
    便捷函数，用于快速获取当前Mode
    
    Returns:
        当前的Access Mode
    """
    return ModeConfig.get_default_mode()


def is_mode_at_least(
    current_mode: AccessMode,
    required_mode: AccessMode
) -> bool:
    """
    判断当前Mode是否满足所需Mode级别
    
    级别顺序: DEMO_PUBLIC < PARTNER < ADMIN_INTERNAL
    
    Args:
        current_mode: 当前Mode
        required_mode: 所需Mode
        
    Returns:
        是否满足
    """
    mode_hierarchy = {
        AccessMode.DEMO_PUBLIC: 0,
        AccessMode.PARTNER: 1,
        AccessMode.ADMIN_INTERNAL: 2,
    }
    
    return mode_hierarchy[current_mode] >= mode_hierarchy[required_mode]
