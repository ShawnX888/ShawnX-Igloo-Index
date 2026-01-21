"""
Product API Routes

提供产品配置的RESTful API

Endpoints:
- GET /products - 获取产品列表
- GET /products/{product_id} - 获取产品详情
- POST /products - 创建产品 (Admin only)
- PUT /products/{product_id} - 更新产品 (Admin only)

Reference:
- docs/v2/v2实施细则/05-产品表与Product-Service-细则.md
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_access_mode, get_session
from app.schemas.product import (
    Product,
    ProductCreate,
    ProductFilter,
    ProductListResponse,
    ProductUpdate,
)
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


@router.post("", response_model=Product, status_code=201)
async def create_product(
    product_create: ProductCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Product:
    """
    创建产品
    
    权限要求: Admin only
    """
    # 检查权限
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(
            status_code=403,
            detail="Only Admin can create products"
        )
    
    # 检查产品ID是否已存在
    existing = await product_service.get_by_id(session, product_create.id, access_mode)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Product already exists: {product_create.id}"
        )
    
    return await product_service.create(session, product_create)


@router.put("/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    product_update: ProductUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Product:
    """
    更新产品
    
    权限要求: Admin only
    """
    # 检查权限
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(
            status_code=403,
            detail="Only Admin can update products"
        )
    
    product = await product_service.update(session, product_id, product_update)
    
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product not found: {product_id}"
        )
    
    return product
