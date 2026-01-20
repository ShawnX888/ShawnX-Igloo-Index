"""
API Dependencies - v2 FastAPI Dependencies

FastAPI 依赖注入
"""

from fastapi import Header

from app.schemas.shared import AccessMode


async def get_access_mode(
    x_access_mode: str = Header("demo", description="Access Mode (demo/partner/admin)")
) -> AccessMode:
    """
    从请求头获取 Access Mode
    
    Args:
        x_access_mode: HTTP Header X-Access-Mode
    
    Returns:
        AccessMode 枚举值
    
    Examples:
        >>> # 在路由中使用
        >>> @router.get("/data")
        >>> async def get_data(access_mode: AccessMode = Depends(get_access_mode)):
        >>>     ...
    """
    try:
        return AccessMode(x_access_mode.lower())
    except ValueError:
        # 默认使用 Demo 模式（最严格）
        return AccessMode.DEMO
