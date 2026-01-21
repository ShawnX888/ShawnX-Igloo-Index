"""
Data Products Services (L0/L1/Overlays) - MVP framework.

Phase 1/2: return schema-correct responses with explicit capability flags,
without claims facts (claims_available=false).
"""

from __future__ import annotations

from decimal import Decimal
from typing import List
from uuid import uuid4

from app.schemas.shared import (
    AggregationData,
    DataProductResponse,
    LegendMeta,
    ResponseMeta,
    SeriesData,
    SharedDimensions,
    TraceContext,
)


CLAIMS_UNAVAILABLE_REASON = "not_implemented_until_phase_3"


def _build_trace_context(dimensions: SharedDimensions) -> TraceContext:
    return TraceContext(
        trace_id=uuid4().hex,
        access_mode=dimensions.access_mode,
        region_code=dimensions.region_code,
        time_range_start=dimensions.time_range.start,
        time_range_end=dimensions.time_range.end,
        data_type=dimensions.data_type,
        weather_type=dimensions.weather_type,
        product_id=dimensions.product_id,
        prediction_run_id=dimensions.prediction_run_id,
    )


def _build_meta(dimensions: SharedDimensions, warnings: List[str]) -> ResponseMeta:
    return ResponseMeta(
        trace_context=_build_trace_context(dimensions),
        cached=False,
        cache_key=dimensions.to_cache_key(),
        warnings=warnings or None,
    )


def _build_legend(dimensions: SharedDimensions, *, unit: str, description: str) -> LegendMeta:
    return LegendMeta(
        data_type=dimensions.data_type,
        weather_type=dimensions.weather_type,
        unit=unit,
        prediction_run_id=dimensions.prediction_run_id,
        description=description,
        region_timezone=dimensions.region_timezone,
        claims_available=False,
        claims_unavailable_reason=CLAIMS_UNAVAILABLE_REASON,
        claims_series_status="disabled",
    )


class L0DashboardService:
    """L0 Dashboard Data Product (MVP skeleton)."""

    def build_response(self, dimensions: SharedDimensions) -> DataProductResponse:
        warnings = [
            "L0 Dashboard is in framework-only mode (no persisted facts yet).",
            f"claims_available=false: {CLAIMS_UNAVAILABLE_REASON}",
        ]
        legend = _build_legend(
            dimensions,
            unit="CNY",
            description="L0 KPI/Pareto skeleton response (Phase 1/2).",
        )

        # No facts yet; return empty aggregations.
        aggregations: List[AggregationData] = []

        return DataProductResponse(
            aggregations=aggregations,
            legend=legend,
            meta=_build_meta(dimensions, warnings),
        )


class MapOverlaysService:
    """Map Overlays Data Product (MVP skeleton)."""

    def build_response(self, dimensions: SharedDimensions) -> DataProductResponse:
        warnings = [
            "Map Overlays is in framework-only mode (no persisted facts yet).",
            f"claims_available=false: {CLAIMS_UNAVAILABLE_REASON}",
        ]
        legend = _build_legend(
            dimensions,
            unit="unitless",
            description="Overlays skeleton response (Phase 1/2).",
        )

        return DataProductResponse(
            aggregations=[],
            legend=legend,
            meta=_build_meta(dimensions, warnings),
        )


class L1RegionIntelligenceService:
    """L1 Region Intelligence Data Product (MVP skeleton)."""

    def build_response(self, dimensions: SharedDimensions) -> DataProductResponse:
        warnings = [
            "L1 Intelligence is in framework-only mode (no persisted facts yet).",
            f"claims_available=false: {CLAIMS_UNAVAILABLE_REASON}",
        ]
        legend = _build_legend(
            dimensions,
            unit="mixed",
            description="L1 Overview/Timeline skeleton response (Phase 1/2).",
        )

        return DataProductResponse(
            series=[],
            events=[],
            aggregations=[],
            legend=legend,
            meta=_build_meta(dimensions, warnings),
        )


l0_dashboard_service = L0DashboardService()
map_overlays_service = MapOverlaysService()
l1_intelligence_service = L1RegionIntelligenceService()
