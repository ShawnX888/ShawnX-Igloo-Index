/**
 * Shared Contract: 统一维度、DTO分类、枚举定义
 * 
 * 本模块定义了v2全栈架构的核心契约,确保前后端使用一致的:
 * - 输入维度命名与语义
 * - 输出DTO分类
 * - 时间口径
 * - Mode裁剪规则
 * - predicted批次一致性规则
 * 
 * Reference:
 * - docs/v2/v2实施细则/01-Shared-Contract基线-细则.md
 * - docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md
 * 
 * CRITICAL: 必须与 backend/app/schemas/shared.py 保持完全一致
 */

// ============================================================================
// Enums (枚举类型 - 必须与后端保持一致)
// ============================================================================

/**
 * 区域范围级别
 */
export enum RegionScope {
  PROVINCE = 'province',
  DISTRICT = 'district',
  // 可扩展: CITY = 'city', GRID = 'grid'
}

/**
 * 数据类型
 */
export enum DataType {
  HISTORICAL = 'historical',
  PREDICTED = 'predicted',
}

/**
 * 天气类型
 * Reference: RD-多天气类型扩展.md
 */
export enum WeatherType {
  RAINFALL = 'rainfall',
  WIND = 'wind',
  TEMPERATURE = 'temperature',
  // 未来扩展: HUMIDITY = 'humidity', PRESSURE = 'pressure'
}

/**
 * 访问模式 - 影响数据裁剪、默认展开、可用动作
 */
export enum AccessMode {
  DEMO_PUBLIC = 'demo_public',      // Demo/Public: 路演默认,少数字强可视化
  PARTNER = 'partner',              // Partner: 合作伙伴,更深KPI与对比
  ADMIN_INTERNAL = 'admin_internal',  // Admin/Internal: 内部,全量明细
}

// ============================================================================
// Input Dimensions (输入维度 - 最小集合)
// ============================================================================

/**
 * 时间范围
 * 
 * 规则:
 * - 存储与传输使用UTC
 * - 业务边界对齐使用region_timezone
 * - 展示时区仅用于UI渲染
 * 
 * Reference: RD-时间与时区口径统一.md
 */
export interface TimeRange {
  /** 起始时间(UTC) */
  start: string; // ISO 8601 format
  /** 结束时间(UTC) */
  end: string;   // ISO 8601 format
}

/**
 * 共享输入维度 - 所有Data Product请求的最小集合
 * 
 * 硬规则:
 * - region_code/time_range/data_type/weather_type/access_mode 为必须
 * - predicted场景下 prediction_run_id 为必须
 * - 任何新增维度必须先入契约再入实现
 * 
 * 缓存key维度: 至少包含 access_mode; predicted 额外包含 prediction_run_id
 */
export interface SharedDimensions {
  // 必须维度
  /** 区域范围级别 */
  region_scope: RegionScope;
  /** 区域代码(统一编码,如CN-GD表示广东省) */
  region_code: string;
  /** 时间范围(UTC) */
  time_range: TimeRange;
  /** 数据类型 */
  data_type: DataType;
  /** 天气类型 */
  weather_type: WeatherType;
  /** 访问模式(影响输出裁剪) */
  access_mode: AccessMode;
  
  // 可选维度
  /** 产品ID(可选,但一旦使用必须入缓存key) */
  product_id?: string;
  /** 预测批次ID(predicted场景必须) */
  prediction_run_id?: string;
  /** 区域时区(如Asia/Shanghai,用于业务边界对齐) */
  region_timezone?: string;
}

/**
 * 生成缓存key
 * 
 * 硬规则:
 * - 至少包含: region_scope, region_code, time_range, data_type, weather_type, access_mode
 * - predicted场景额外包含: prediction_run_id
 */
export function toCacheKey(dimensions: SharedDimensions): string {
  const parts = [
    `region:${dimensions.region_scope}:${dimensions.region_code}`,
    `time:${dimensions.time_range.start}:${dimensions.time_range.end}`,
    `dtype:${dimensions.data_type}`,
    `weather:${dimensions.weather_type}`,
    `mode:${dimensions.access_mode}`,
  ];
  
  if (dimensions.product_id) {
    parts.push(`product:${dimensions.product_id}`);
  }
  
  if (dimensions.data_type === DataType.PREDICTED && dimensions.prediction_run_id) {
    parts.push(`run:${dimensions.prediction_run_id}`);
  }
  
  return parts.join('|');
}

// ============================================================================
// Output DTOs (输出DTO分类 - 避免混用)
// ============================================================================

/**
 * 时间序列数据
 * 
 * 用途: Timeline三泳道(Weather/Risk/Claims)、趋势图
 */
export interface SeriesData {
  /** 时间点列表(UTC, ISO 8601 format) */
  timestamps: string[];
  /** 数值列表 */
  values: Array<number | string>; // string for Decimal support
  /** 单位(如mm, km/h, celsius) */
  unit: string;
}

/**
 * 事件数据
 * 
 * 用途: risk_events, claim_events
 * 
 * 硬规则:
 * - predicted事件必须包含 prediction_run_id
 * - 必须包含 rule_version 或 rules_hash (支持审计与回溯)
 */
export interface EventData {
  /** 事件ID */
  event_id: string;
  /** 事件时间(UTC, ISO 8601 format) */
  timestamp: string;
  /** 事件类型(risk/claim) */
  event_type: string;
  
  // 可选字段(根据事件类型动态填充)
  /** 风险等级(1/2/3) */
  tier_level?: number;
  /** 触发值 */
  trigger_value?: number | string; // string for Decimal
  /** 阈值 */
  threshold_value?: number | string;
  /** 金额(理赔) */
  amount?: number | string;
  
  // 审计字段
  /** 数据类型 */
  data_type: DataType;
  /** 预测批次ID(predicted事件必须) */
  prediction_run_id?: string;
  /** 规则版本(支持审计) */
  rule_version?: string;
}

/**
 * 聚合数据
 * 
 * 用途: L0 KPI/Pareto（TopN）, Map Overlays区域聚合
 * 
 * 硬规则:
 * - 必须标注聚合维度(aggregation_key)与口径(aggregation_method)
 */
export interface AggregationData {
  /** 聚合维度(如region_code, product_id) */
  aggregation_key: string;
  /** 聚合方法(sum/avg/count/max/min) */
  aggregation_method: 'sum' | 'avg' | 'count' | 'max' | 'min';
  /** 聚合值 */
  value: number | string; // string for Decimal
  /** 单位(可选) */
  unit?: string;
  /** 展示标签(可选) */
  label?: string;
}

/**
 * 图例与元信息
 * 
 * 用途: 解释数据口径、单位、阈值、tiers等
 * 
 * 硬规则:
 * - predicted数据必须包含 prediction_run_id
 * - 必须标注 data_type 与 weather_type
 */
export interface LegendMeta {
  /** 数据类型 */
  data_type: DataType;
  /** 天气类型 */
  weather_type: WeatherType;
  /** 单位 */
  unit: string;
  
  // 阈值/tiers(可选)
  /** 阈值字典(如 {'tier1': 50, 'tier2': 100, 'tier3': 150}) */
  thresholds?: Record<string, number | string>;
  
  // predicted元信息
  /** 预测批次ID(predicted必须) */
  prediction_run_id?: string;
  /** 预测生成时间(UTC, ISO 8601 format) */
  prediction_generated_at?: string;
  
  // 口径说明(Mode-aware)
  /** 口径说明(根据access_mode裁剪) */
  description?: string;
}

/**
 * Data Product统一响应格式
 * 
 * 包含:
 * - series: 时间序列(可选)
 * - events: 事件列表(可选)
 * - aggregations: 聚合数据(可选)
 * - legend: 图例与元信息(必须)
 * - meta: 响应元数据(可观测性)
 */
export interface DataProductResponse {
  /** 时间序列数据 */
  series?: SeriesData[];
  /** 事件数据 */
  events?: EventData[];
  /** 聚合数据 */
  aggregations?: AggregationData[];
  /** 图例与元信息 */
  legend: LegendMeta;
  /** 响应元数据 */
  meta: ResponseMeta;
}

// ============================================================================
// Observability (可观测性)
// ============================================================================

/**
 * 追踪上下文 - 支撑全链路可追溯
 * 
 * 必带字段:
 * - trace_id/correlation_id
 * - 关键维度(access_mode, region_code, data_type, weather_type, product_id, prediction_run_id)
 */
export interface TraceContext {
  /** 追踪ID(全链路唯一) */
  trace_id: string;
  /** 关联ID(可选,用于跨服务关联) */
  correlation_id?: string;
  
  // 关键维度(用于排障)
  access_mode: AccessMode;
  region_code?: string;
  time_range_start?: string; // ISO 8601 format
  time_range_end?: string;
  data_type?: DataType;
  weather_type?: WeatherType;
  product_id?: string;
  prediction_run_id?: string;
  
  // 时间戳
  /** 请求时间(UTC, ISO 8601 format) */
  request_at: string;
}

/**
 * 响应元数据
 * 
 * 用途: 可观测性、缓存状态、警告信息
 */
export interface ResponseMeta {
  /** 追踪上下文 */
  trace_context: TraceContext;
  /** 是否命中缓存 */
  cached: boolean;
  /** 缓存key(用于排障) */
  cache_key?: string;
  /** 警告信息(如数据不完整、降级处理等) */
  warnings?: string[];
  /** 响应时间(UTC, ISO 8601 format) */
  response_at: string;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * 验证SharedDimensions
 * 
 * 硬规则:
 * - predicted场景下必须提供prediction_run_id
 * - historical场景下不能提供prediction_run_id
 */
export function validateSharedDimensions(dimensions: SharedDimensions): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 验证prediction_run_id
  if (dimensions.data_type === DataType.PREDICTED && !dimensions.prediction_run_id) {
    errors.push('prediction_run_id is required when data_type is predicted');
  }
  
  if (dimensions.data_type === DataType.HISTORICAL && dimensions.prediction_run_id) {
    errors.push('prediction_run_id must not be provided when data_type is historical');
  }
  
  // 验证time_range
  const start = new Date(dimensions.time_range.start);
  const end = new Date(dimensions.time_range.end);
  if (end <= start) {
    errors.push('time_range.end must be after time_range.start');
  }
  
  // 验证region_code
  if (dimensions.region_code.length < 2 || dimensions.region_code.length > 20) {
    errors.push('region_code length must be between 2 and 20');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 创建默认TraceContext
 */
export function createTraceContext(
  dimensions: Partial<SharedDimensions>,
  traceId?: string
): TraceContext {
  return {
    trace_id: traceId || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    access_mode: dimensions.access_mode || AccessMode.DEMO_PUBLIC,
    region_code: dimensions.region_code,
    time_range_start: dimensions.time_range?.start,
    time_range_end: dimensions.time_range?.end,
    data_type: dimensions.data_type,
    weather_type: dimensions.weather_type,
    product_id: dimensions.product_id,
    prediction_run_id: dimensions.prediction_run_id,
    request_at: new Date().toISOString(),
  };
}
