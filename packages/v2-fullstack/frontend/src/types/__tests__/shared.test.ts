/**
 * 测试Shared Contract基线的验收用例
 * 
 * Reference: docs/v2/v2实施细则/01-Shared-Contract基线-细则.md
 * 
 * CRITICAL: 所有测试必须与后端 tests/test_shared_contract.py 保持对应
 */

import {
  RegionScope,
  DataType,
  WeatherType,
  AccessMode,
  SharedDimensions,
  TimeRange,
  SeriesData,
  EventData,
  AggregationData,
  LegendMeta,
  DataProductResponse,
  TraceContext,
  ResponseMeta,
  validateSharedDimensions,
  toCacheKey,
  createTraceContext,
} from '../shared';

describe('Enums', () => {
  describe('RegionScope', () => {
    it('should have correct values', () => {
      expect(RegionScope.PROVINCE).toBe('province');
      expect(RegionScope.DISTRICT).toBe('district');
    });
  });

  describe('DataType', () => {
    it('should have correct values', () => {
      expect(DataType.HISTORICAL).toBe('historical');
      expect(DataType.PREDICTED).toBe('predicted');
    });
  });

  describe('WeatherType', () => {
    it('should have correct values', () => {
      expect(WeatherType.RAINFALL).toBe('rainfall');
      expect(WeatherType.WIND).toBe('wind');
      expect(WeatherType.TEMPERATURE).toBe('temperature');
    });
  });

  describe('AccessMode', () => {
    it('should have correct values', () => {
      expect(AccessMode.DEMO_PUBLIC).toBe('demo_public');
      expect(AccessMode.PARTNER).toBe('partner');
      expect(AccessMode.ADMIN_INTERNAL).toBe('admin_internal');
    });
  });
});

describe('SharedDimensions', () => {
  const baseTimeRange: TimeRange = {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-31T23:59:59Z',
  };

  describe('historical dimensions', () => {
    it('should accept valid historical dimensions', () => {
      const dimensions: SharedDimensions = {
        region_scope: RegionScope.PROVINCE,
        region_code: 'CN-GD',
        time_range: baseTimeRange,
        data_type: DataType.HISTORICAL,
        weather_type: WeatherType.RAINFALL,
        access_mode: AccessMode.DEMO_PUBLIC,
        product_id: 'daily_rainfall',
        prediction_run_id: undefined,
      };

      const { valid, errors } = validateSharedDimensions(dimensions);
      expect(valid).toBe(true);
      expect(errors).toEqual([]);
    });
  });

  describe('predicted dimensions', () => {
    it('should accept valid predicted dimensions with run_id', () => {
      const dimensions: SharedDimensions = {
        region_scope: RegionScope.PROVINCE,
        region_code: 'CN-GD',
        time_range: baseTimeRange,
        data_type: DataType.PREDICTED,
        weather_type: WeatherType.RAINFALL,
        access_mode: AccessMode.DEMO_PUBLIC,
        prediction_run_id: 'run-2025-01-20-001',
      };

      const { valid, errors } = validateSharedDimensions(dimensions);
      expect(valid).toBe(true);
      expect(errors).toEqual([]);
    });

    it('should reject predicted dimensions without run_id', () => {
      const dimensions: SharedDimensions = {
        region_scope: RegionScope.PROVINCE,
        region_code: 'CN-GD',
        time_range: baseTimeRange,
        data_type: DataType.PREDICTED,
        weather_type: WeatherType.RAINFALL,
        access_mode: AccessMode.DEMO_PUBLIC,
        prediction_run_id: undefined,
      };

      const { valid, errors } = validateSharedDimensions(dimensions);
      expect(valid).toBe(false);
      expect(errors).toContain('prediction_run_id is required when data_type is predicted');
    });

    it('should reject historical dimensions with run_id', () => {
      const dimensions: SharedDimensions = {
        region_scope: RegionScope.PROVINCE,
        region_code: 'CN-GD',
        time_range: baseTimeRange,
        data_type: DataType.HISTORICAL,
        weather_type: WeatherType.RAINFALL,
        access_mode: AccessMode.DEMO_PUBLIC,
        prediction_run_id: 'run-2025-01-20-001',
      };

      const { valid, errors } = validateSharedDimensions(dimensions);
      expect(valid).toBe(false);
      expect(errors).toContain('prediction_run_id must not be provided when data_type is historical');
    });
  });

  describe('cache key generation', () => {
    it('should generate cache key for historical data', () => {
      const dimensions: SharedDimensions = {
        region_scope: RegionScope.PROVINCE,
        region_code: 'CN-GD',
        time_range: baseTimeRange,
        data_type: DataType.HISTORICAL,
        weather_type: WeatherType.RAINFALL,
        access_mode: AccessMode.DEMO_PUBLIC,
        product_id: 'daily_rainfall',
      };

      const cacheKey = toCacheKey(dimensions);

      expect(cacheKey).toContain('region:province:CN-GD');
      expect(cacheKey).toContain('dtype:historical');
      expect(cacheKey).toContain('weather:rainfall');
      expect(cacheKey).toContain('mode:demo_public');
      expect(cacheKey).toContain('product:daily_rainfall');
      expect(cacheKey).not.toContain('run:');
    });

    it('should include prediction_run_id in cache key for predicted data', () => {
      const dimensions: SharedDimensions = {
        region_scope: RegionScope.PROVINCE,
        region_code: 'CN-GD',
        time_range: baseTimeRange,
        data_type: DataType.PREDICTED,
        weather_type: WeatherType.RAINFALL,
        access_mode: AccessMode.DEMO_PUBLIC,
        prediction_run_id: 'run-2025-01-20-001',
      };

      const cacheKey = toCacheKey(dimensions);

      expect(cacheKey).toContain('run:run-2025-01-20-001');
    });

    it('should generate consistent cache keys for identical dimensions', () => {
      const dimensions1: SharedDimensions = {
        region_scope: RegionScope.PROVINCE,
        region_code: 'CN-GD',
        time_range: baseTimeRange,
        data_type: DataType.HISTORICAL,
        weather_type: WeatherType.RAINFALL,
        access_mode: AccessMode.DEMO_PUBLIC,
      };

      const dimensions2: SharedDimensions = {
        region_scope: RegionScope.PROVINCE,
        region_code: 'CN-GD',
        time_range: baseTimeRange,
        data_type: DataType.HISTORICAL,
        weather_type: WeatherType.RAINFALL,
        access_mode: AccessMode.DEMO_PUBLIC,
      };

      expect(toCacheKey(dimensions1)).toBe(toCacheKey(dimensions2));
    });
  });
});

describe('Output DTOs', () => {
  describe('SeriesData', () => {
    it('should create valid series data', () => {
      const series: SeriesData = {
        timestamps: ['2025-01-01T00:00:00Z'],
        values: [100.5],
        unit: 'mm',
      };

      expect(series.timestamps.length).toBe(series.values.length);
      expect(series.unit).toBe('mm');
    });
  });

  describe('EventData', () => {
    it('should create valid historical event', () => {
      const event: EventData = {
        event_id: 'evt-001',
        timestamp: '2025-01-01T00:00:00Z',
        event_type: 'risk',
        tier_level: 2,
        trigger_value: '105.5',
        threshold_value: '100.0',
        data_type: DataType.HISTORICAL,
        prediction_run_id: undefined,
      };

      expect(event.data_type).toBe(DataType.HISTORICAL);
      expect(event.prediction_run_id).toBeUndefined();
    });

    it('should create valid predicted event with run_id', () => {
      const event: EventData = {
        event_id: 'evt-002',
        timestamp: '2025-01-01T00:00:00Z',
        event_type: 'risk',
        tier_level: 3,
        data_type: DataType.PREDICTED,
        prediction_run_id: 'run-2025-01-20-001',
      };

      expect(event.data_type).toBe(DataType.PREDICTED);
      expect(event.prediction_run_id).toBe('run-2025-01-20-001');
    });
  });

  describe('AggregationData', () => {
    it('should create valid aggregation', () => {
      const agg: AggregationData = {
        aggregation_key: 'CN-GD',
        aggregation_method: 'sum',
        value: '1250.5',
        unit: 'mm',
        label: 'Guangdong Province',
      };

      expect(agg.aggregation_method).toBe('sum');
      expect(agg.unit).toBe('mm');
    });
  });

  describe('LegendMeta', () => {
    it('should create valid historical legend', () => {
      const legend: LegendMeta = {
        data_type: DataType.HISTORICAL,
        weather_type: WeatherType.RAINFALL,
        unit: 'mm',
        thresholds: { tier1: '50.0', tier2: '100.0', tier3: '150.0' },
      };

      expect(legend.data_type).toBe(DataType.HISTORICAL);
      expect(legend.prediction_run_id).toBeUndefined();
    });

    it('should create valid predicted legend with run_id', () => {
      const legend: LegendMeta = {
        data_type: DataType.PREDICTED,
        weather_type: WeatherType.RAINFALL,
        unit: 'mm',
        prediction_run_id: 'run-2025-01-20-001',
        prediction_generated_at: '2025-01-20T00:00:00Z',
      };

      expect(legend.data_type).toBe(DataType.PREDICTED);
      expect(legend.prediction_run_id).toBe('run-2025-01-20-001');
    });
  });
});

describe('DataProductResponse', () => {
  it('should create complete response', () => {
    const traceContext: TraceContext = {
      trace_id: 'trace-001',
      access_mode: AccessMode.DEMO_PUBLIC,
      region_code: 'CN-GD',
      data_type: DataType.HISTORICAL,
      weather_type: WeatherType.RAINFALL,
      request_at: '2025-01-20T00:00:00Z',
    };

    const response: DataProductResponse = {
      series: [
        {
          timestamps: ['2025-01-01T00:00:00Z'],
          values: [100.5],
          unit: 'mm',
        },
      ],
      events: [
        {
          event_id: 'evt-001',
          timestamp: '2025-01-01T00:00:00Z',
          event_type: 'risk',
          data_type: DataType.HISTORICAL,
        },
      ],
      aggregations: [
        {
          aggregation_key: 'CN-GD',
          aggregation_method: 'sum',
          value: '1250.5',
        },
      ],
      legend: {
        data_type: DataType.HISTORICAL,
        weather_type: WeatherType.RAINFALL,
        unit: 'mm',
      },
      meta: {
        trace_context: traceContext,
        cached: false,
        response_at: '2025-01-20T00:00:01Z',
      },
    };

    expect(response.series).toBeDefined();
    expect(response.events).toBeDefined();
    expect(response.aggregations).toBeDefined();
    expect(response.legend.data_type).toBe(DataType.HISTORICAL);
    expect(response.meta.trace_context.trace_id).toBe('trace-001');
  });
});

describe('Observability', () => {
  describe('createTraceContext', () => {
    it('should create trace context with auto-generated trace_id', () => {
      const dimensions: Partial<SharedDimensions> = {
        access_mode: AccessMode.DEMO_PUBLIC,
        region_code: 'CN-GD',
        data_type: DataType.HISTORICAL,
        weather_type: WeatherType.RAINFALL,
      };

      const traceContext = createTraceContext(dimensions);

      expect(traceContext.trace_id).toBeDefined();
      expect(traceContext.trace_id).toContain('trace-');
      expect(traceContext.access_mode).toBe(AccessMode.DEMO_PUBLIC);
      expect(traceContext.region_code).toBe('CN-GD');
    });

    it('should accept custom trace_id', () => {
      const traceContext = createTraceContext({
        access_mode: AccessMode.DEMO_PUBLIC,
      }, 'custom-trace-001');

      expect(traceContext.trace_id).toBe('custom-trace-001');
    });
  });

  describe('ResponseMeta', () => {
    it('should create response meta with cache info', () => {
      const traceContext: TraceContext = {
        trace_id: 'trace-001',
        access_mode: AccessMode.DEMO_PUBLIC,
        request_at: '2025-01-20T00:00:00Z',
      };

      const meta: ResponseMeta = {
        trace_context: traceContext,
        cached: true,
        cache_key: 'region:province:CN-GD|...',
        warnings: ['Data incomplete for 2 districts'],
        response_at: '2025-01-20T00:00:01Z',
      };

      expect(meta.cached).toBe(true);
      expect(meta.cache_key).toBeDefined();
      expect(meta.warnings).toHaveLength(1);
    });
  });
});
