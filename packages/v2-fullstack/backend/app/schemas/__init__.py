"""
Pydantic schemas for the Igloo Insurance SaaS platform.

All schemas follow Pydantic V2 syntax and serve as the Shared Contract
between frontend, backend, and external services.
"""

from app.schemas.shared import (
    # Enums
    RegionScope,
    DataType,
    WeatherType,
    AccessMode,
    
    # Input Dimensions
    SharedDimensions,
    TimeRange,
    
    # Output DTOs
    SeriesData,
    EventData,
    AggregationData,
    LegendMeta,
    DataProductResponse,
    
    # Observability
    TraceContext,
)

__all__ = [
    # Enums
    "RegionScope",
    "DataType",
    "WeatherType",
    "AccessMode",
    
    # Input Dimensions
    "SharedDimensions",
    "TimeRange",
    
    # Output DTOs
    "SeriesData",
    "EventData",
    "AggregationData",
    "LegendMeta",
    "DataProductResponse",
    
    # Observability
    "TraceContext",
]
