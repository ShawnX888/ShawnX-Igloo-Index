"""
Product API Routes

提供产品配置的读路径 API

Endpoints:
- GET /products - 获取产品列表
- GET /products/{product_id} - 获取产品详情

Reference:
- docs/v2/v2实施细则/05-产品表与Product-Service-细则.md
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_access_mode, get_session
from app.schemas.product import Product, ProductFilter, ProductListResponse
from app.schemas.shared import AccessMode, WeatherType
from app.services.product_service import product_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductListResponse)
async def list_products(
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
    weather_type: Optional[WeatherType] = Query(
        None,
        description="按天气类型过滤"
    ),
    product_type: Optional[str] = Query(
        None,
        alias="type",
        description="按产品类型过滤"
    ),
    is_active: bool = Query(
        True,
        description="是否只返回启用的产品"
    ),
) -> ProductListResponse:
    """
    获取产品列表
    
    用于前端Product Selector，按weather_type动态过滤
    """
    filter = ProductFilter(
        weather_type=weather_type,
        type=product_type,
        is_active=is_active
    )
    
    return await product_service.list_products(session, filter, access_mode)


@router.get("/{product_id}", response_model=Product)
async def get_product(
    product_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Product:
    """
    获取产品详情
    
    包含完整的 riskRules，payoutRules 根据 access_mode 裁剪
    """
    product = await product_service.get_by_id(session, product_id, access_mode)
    
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product not found: {product_id}"
        )
    
    return product


