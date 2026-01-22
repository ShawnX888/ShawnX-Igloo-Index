"""
Internal Product API Routes

提供产品的内部写入/修复接口（不对外公开）。
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_access_mode, get_session
from app.schemas.product import Product, ProductCreate, ProductUpdate
from app.schemas.shared import AccessMode
from app.services.product_service import product_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/products", tags=["internal-products"])


@router.post("", response_model=Product, status_code=201)
async def create_product(
    payload: ProductCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Product:
    """内部创建产品"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can create products")
    existing = await product_service.get_by_id(session, payload.id, access_mode)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Product already exists: {payload.id}",
        )
    return await product_service.create(session, payload)


@router.put("/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    access_mode: Annotated[AccessMode, Depends(get_access_mode)],
) -> Product:
    """内部更新产品"""
    if access_mode != AccessMode.ADMIN_INTERNAL:
        raise HTTPException(status_code=403, detail="Only Admin can update products")
    product = await product_service.update(session, product_id, payload)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product not found: {product_id}")
    return product
