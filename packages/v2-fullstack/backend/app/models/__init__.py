"""
SQLAlchemy Models

所有数据库模型的导出
"""

from app.models.base import Base
from app.models.product import Product
from app.models.policy import Policy
from app.models.weather import WeatherData
from app.models.risk_event import RiskEvent
from app.models.prediction_run import PredictionRun
from app.models.claim import Claim

__all__ = [
    "Base",
    "Product",
    "Policy",
    "WeatherData",
    "RiskEvent",
    "PredictionRun",
    "Claim",
]
