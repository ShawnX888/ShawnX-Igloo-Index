"""
Product Service (产品服务)

职责:
- 管理产品配置的读取、创建、更新
- 提供产品列表查询 (支持按weather_type过滤)
- 应用Access Mode裁剪 (payoutRules可能被裁剪)
- 验证规则一致性 (weather_type, thresholds)

Reference:
- docs/v2/v2实施细则/05-产品表与Product-Service-细则.md
- docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md

硬规则:
- payoutRules 根据 access_mode 裁剪
- 规则变更必须递增 version
"""

import hashlib
import json
import logging
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product as ProductModel
from app.schemas.access_control import DataProductType
from app.schemas.product import (
    Product,
    ProductCreate,
    ProductFilter,
    ProductListItem,
    ProductListResponse,
    ProductUpdate,
)
from app.schemas.shared import AccessMode, WeatherType
from app.utils.access_control import AccessControlManager

logger = logging.getLogger(__name__)


class ProductService:
    """
    产品服务
    
    提供产品配置的CRUD操作和查询
    """
    
    async def get_by_id(
        self,
        session: AsyncSession,
        product_id: str,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> Optional[Product]:
        """
        根据ID获取产品
        
        Args:
            session: 数据库会话
            product_id: 产品ID
            access_mode: 访问模式 (影响 payoutRules 裁剪)
            
        Returns:
            产品对象，如果不存在则返回None
        """
        result = await session.execute(
            select(ProductModel).where(ProductModel.id == product_id)
        )
        product_model = result.scalar_one_or_none()
        
        if not product_model:
            return None
        
        # 转换为Pydantic对象
        product = self._model_to_schema(product_model)
        
        # 应用Mode裁剪
        product = self._apply_mode_pruning(product, access_mode)
        
        logger.info(
            f"Product fetched: {product_id}",
            extra={
                "product_id": product_id,
                "access_mode": access_mode.value,
                "payout_rules_included": product.payout_rules is not None,
            }
        )
        
        return product
    
    async def list_products(
        self,
        session: AsyncSession,
        filter: ProductFilter,
        access_mode: AccessMode = AccessMode.DEMO_PUBLIC
    ) -> ProductListResponse:
        """
        获取产品列表
        
        Args:
            session: 数据库会话
            filter: 查询过滤器
            access_mode: 访问模式
            
        Returns:
            产品列表响应
        """
        # 构建查询
        query = select(ProductModel)
        
        # 应用过滤
        if filter.weather_type:
            query = query.where(ProductModel.weather_type == filter.weather_type.value)
        
        if filter.type:
            query = query.where(ProductModel.type == filter.type)
        
        if filter.is_active is not None:
            query = query.where(ProductModel.is_active == filter.is_active)
        
        # 排序
        query = query.order_by(ProductModel.weather_type, ProductModel.id)
        
        # 执行查询
        result = await session.execute(query)
        product_models = list(result.scalars().all())
        
        # 转换为列表项
        products = [
            self._model_to_list_item(model)
            for model in product_models
        ]
        
        logger.info(
            f"Products listed: {len(products)} products",
            extra={
                "count": len(products),
                "weather_type": filter.weather_type.value if filter.weather_type else None,
                "is_active": filter.is_active,
                "access_mode": access_mode.value,
            }
        )
        
        return ProductListResponse(
            products=products,
            total=len(products),
            filtered_by_weather_type=filter.weather_type
        )
    
    async def create(
        self,
        session: AsyncSession,
        product_create: ProductCreate
    ) -> Product:
        """
        创建产品
        
        Args:
            session: 数据库会话
            product_create: 创建请求
            
        Returns:
            创建的产品
        """
        # 验证规则一致性
        self._validate_product_rules(product_create)
        
        # 创建模型
        product_model = ProductModel(
            id=product_create.id,
            name=product_create.name,
            type=product_create.type,
            weather_type=product_create.weather_type.value,
            description=product_create.description,
            icon=product_create.icon,
            risk_rules=product_create.risk_rules.model_dump(),
            payout_rules=product_create.payout_rules.model_dump(),
            version=product_create.version,
            is_active=product_create.is_active,
        )
        
        session.add(product_model)
        await session.commit()
        await session.refresh(product_model)
        
        logger.info(
            f"Product created: {product_model.id}",
            extra={
                "product_id": product_model.id,
                "weather_type": product_model.weather_type,
                "version": product_model.version,
            }
        )
        
        return self._model_to_schema(product_model)
    
    async def update(
        self,
        session: AsyncSession,
        product_id: str,
        product_update: ProductUpdate
    ) -> Optional[Product]:
        """
        更新产品
        
        Args:
            session: 数据库会话
            product_id: 产品ID
            product_update: 更新请求
            
        Returns:
            更新后的产品，如果不存在则返回None
        """
        result = await session.execute(
            select(ProductModel).where(ProductModel.id == product_id)
        )
        product_model = result.scalar_one_or_none()
        
        if not product_model:
            return None
        
        # 应用更新
        update_data = product_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field in ("risk_rules", "payout_rules") and value is not None:
                # JSONB字段需要转换
                setattr(product_model, field, value.model_dump())
            else:
                setattr(product_model, field, value)
        
        await session.commit()
        await session.refresh(product_model)
        
        logger.info(
            f"Product updated: {product_id}",
            extra={
                "product_id": product_id,
                "updated_fields": list(update_data.keys()),
                "new_version": product_model.version,
            }
        )
        
        return self._model_to_schema(product_model)
    
    def _model_to_schema(self, model: ProductModel) -> Product:
        """将SQLAlchemy模型转换为Pydantic schema"""
        from app.schemas.product import RiskRules, PayoutRules
        
        return Product(
            id=model.id,
            name=model.name,
            type=model.type,
            weather_type=WeatherType(model.weather_type),
            description=model.description,
            icon=model.icon,
            risk_rules=RiskRules.model_validate(model.risk_rules),
            payout_rules=PayoutRules.model_validate(model.payout_rules) if model.payout_rules else None,
            version=model.version,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
    
    def _model_to_list_item(self, model: ProductModel) -> ProductListItem:
        """将模型转换为列表项"""
        # 提取阈值摘要
        thresholds_summary = None
        if model.risk_rules and "thresholds" in model.risk_rules:
            thresholds_summary = model.risk_rules["thresholds"]
        
        return ProductListItem(
            id=model.id,
            name=model.name,
            type=model.type,
            weather_type=WeatherType(model.weather_type),
            icon=model.icon,
            description=model.description,
            version=model.version,
            is_active=model.is_active,
            thresholds_summary=thresholds_summary,
        )
    
    def _apply_mode_pruning(
        self,
        product: Product,
        access_mode: AccessMode
    ) -> Product:
        """
        应用Mode裁剪
        
        规则:
        - Demo/Public: payoutRules 可能被裁剪或设为None
        - Partner: payoutRules 部分字段可能被裁剪
        - Admin: 返回完整 payoutRules
        """
        if access_mode == AccessMode.DEMO_PUBLIC:
            # Demo/Public: 不返回 payoutRules
            product.payout_rules = None
            logger.debug(
                f"PayoutRules pruned for Demo/Public mode",
                extra={
                    "product_id": product.id,
                    "access_mode": access_mode.value,
                }
            )
        
        # Partner/Admin: 返回完整规则 (未来可扩展更细裁剪)
        
        return product
    
    def _validate_product_rules(self, product: ProductCreate):
        """
        验证产品规则一致性
        
        硬规则:
        - weather_type 一致性 (已在 @field_validator 中验证)
        - thresholds 必须包含 tier1/tier2/tier3
        - timeWindow 必须完整
        """
        # 验证 thresholds
        thresholds = product.risk_rules.thresholds
        if thresholds.tier1 <= 0 or thresholds.tier2 <= 0 or thresholds.tier3 <= 0:
            raise ValueError("All thresholds must be positive")
        
        # 验证 timeWindow
        time_window = product.risk_rules.time_window
        if time_window.size <= 0:
            raise ValueError("timeWindow.size must be positive")
        
        if time_window.step is not None and time_window.step <= 0:
            raise ValueError("timeWindow.step must be positive if provided")
        
        # 验证 payout percentages
        payout = product.payout_rules.payout_percentages
        if payout.tier1 <= 0 or payout.tier2 <= 0 or payout.tier3 <= 0:
            raise ValueError("All payout percentages must be positive")
        
        if payout.tier3 > product.payout_rules.total_cap:
            raise ValueError("tier3 payout cannot exceed total_cap")


# 全局Service实例
product_service = ProductService()
