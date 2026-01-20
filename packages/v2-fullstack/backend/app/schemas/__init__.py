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

from app.schemas.access_control import (
    # Enums
    PruningDimension,
    DataProductType,
    UnauthorizedAccessStrategy,
    
    # Pruning Rules
    FieldPruningRule,
    GranularityPruningRule,
    CapabilityPruningRule,
    ModePruningPolicy,
    
    # Registry & Utilities
    PruningPolicyRegistry,
    FieldPruner,
    UnauthorizedAccessResponse,
)

from app.schemas.prediction import (
    # Enums
    PredictionRunStatus,
    PredictionRunSource,
    
    # Prediction Run
    PredictionRunBase,
    PredictionRunCreate,
    PredictionRun,
    PredictionRunUpdate,
    
    # Active Run
    ActiveRunInfo,
    ActiveRunSwitchRequest,
    ActiveRunSwitchRecord,
    
    # Consistency
    PredictionConsistencyCheck,
    
    # Query
    PredictionRunFilter,
    PredictionRunListResponse,
)

from app.schemas.time import (
    # Enums
    TimeWindowType,
    TimeGranularity,
    
    # Time Range
    TimeRangeUTC,
    CalculationRangeUTC,
    
    # Timezone Alignment
    TimezoneAlignmentMeta,
    
    # Event Timestamp
    EventTimestamp,
    
    # Consistency
    TimeConsistencyCheck,
    
    # Frequency
    FrequencyLimitMeta,
)

from app.schemas.product import (
    # Risk Rules
    TimeWindow,
    Thresholds,
    Calculation,
    RiskRules,
    
    # Payout Rules
    PayoutPercentages,
    PayoutRules,
    
    # Product
    ProductBase,
    ProductCreate,
    ProductUpdate,
    Product,
    ProductListItem,
    ProductListResponse,
    ProductFilter,
)

__all__ = [
    # Shared Contract - Enums
    "RegionScope",
    "DataType",
    "WeatherType",
    "AccessMode",
    
    # Shared Contract - Input Dimensions
    "SharedDimensions",
    "TimeRange",
    
    # Shared Contract - Output DTOs
    "SeriesData",
    "EventData",
    "AggregationData",
    "LegendMeta",
    "DataProductResponse",
    
    # Shared Contract - Observability
    "TraceContext",
    
    # Access Control - Enums
    "PruningDimension",
    "DataProductType",
    "UnauthorizedAccessStrategy",
    
    # Access Control - Pruning Rules
    "FieldPruningRule",
    "GranularityPruningRule",
    "CapabilityPruningRule",
    "ModePruningPolicy",
    
    # Access Control - Registry & Utilities
    "PruningPolicyRegistry",
    "FieldPruner",
    "UnauthorizedAccessResponse",
    
    # Prediction Run - Enums
    "PredictionRunStatus",
    "PredictionRunSource",
    
    # Prediction Run - Schemas
    "PredictionRunBase",
    "PredictionRunCreate",
    "PredictionRun",
    "PredictionRunUpdate",
    
    # Prediction Run - Active Run
    "ActiveRunInfo",
    "ActiveRunSwitchRequest",
    "ActiveRunSwitchRecord",
    
    # Prediction Run - Consistency
    "PredictionConsistencyCheck",
    
    # Prediction Run - Query
    "PredictionRunFilter",
    "PredictionRunListResponse",
    
    # Time - Enums
    "TimeWindowType",
    "TimeGranularity",
    
    # Time - Time Range
    "TimeRangeUTC",
    "CalculationRangeUTC",
    
    # Time - Timezone Alignment
    "TimezoneAlignmentMeta",
    
    # Time - Event Timestamp
    "EventTimestamp",
    
    # Time - Consistency
    "TimeConsistencyCheck",
    
    # Time - Frequency
    "FrequencyLimitMeta",
    
    # Product - Risk Rules
    "TimeWindow",
    "Thresholds",
    "Calculation",
    "RiskRules",
    
    # Product - Payout Rules
    "PayoutPercentages",
    "PayoutRules",
    
    # Product - Schemas
    "ProductBase",
    "ProductCreate",
    "ProductUpdate",
    "Product",
    "ProductListItem",
    "ProductListResponse",
    "ProductFilter",
]
