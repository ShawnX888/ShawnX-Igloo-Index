"""
Seed Products Data

从 products.json 加载产品配置到数据库

Usage:
    python -m app.seeds.seed_products

Reference:
- docs/v2/v2实施细则/05-产品表与Product-Service-细则.md
"""

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, Product

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_products(session: AsyncSession):
    """
    加载产品配置到数据库
    
    Args:
        session: 数据库会话
    """
    # 读取产品配置
    seed_file = Path(__file__).parent / "products.json"
    with open(seed_file, "r", encoding="utf-8") as f:
        products_data = json.load(f)
    
    logger.info(f"Loading {len(products_data)} products from {seed_file}")
    
    # 逐个创建或更新产品
    for product_data in products_data:
        product_id = product_data["id"]
        
        # 检查是否已存在
        from sqlalchemy import select
        result = await session.execute(
            select(Product).where(Product.id == product_id)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            logger.info(f"Product already exists: {product_id}, skipping...")
            continue
        
        # 创建新产品
        product = Product(
            id=product_data["id"],
            name=product_data["name"],
            type=product_data["type"],
            weather_type=product_data["weather_type"],
            description=product_data.get("description"),
            icon=product_data.get("icon"),
            risk_rules=product_data["risk_rules"],
            payout_rules=product_data["payout_rules"],
            version=product_data.get("version", "v1.0.0"),
            is_active=product_data.get("is_active", True),
        )
        
        session.add(product)
        logger.info(f"Created product: {product_id}")
    
    await session.commit()
    logger.info("✅ All products seeded successfully")


async def main():
    """主函数"""
    # TODO: 从环境变量读取数据库URL
    # DATABASE_URL = os.getenv("DATABASE_URL")
    DATABASE_URL = "postgresql+asyncpg://user:password@localhost/igloo"
    
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    # 创建表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # 加载数据
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        await seed_products(session)
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
