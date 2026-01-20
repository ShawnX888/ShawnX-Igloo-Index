/**
 * Shared Common Types - v2 Shared Contract
 * 
 * 核心数据结构定义
 */

import { AccessMode, DataType, RegionScope, WeatherType } from './enums';

/**
 * 时间范围（Time Range）
 * 
 * 时间必须使用 UTC ISO 8601 格式
 * 例如: "2025-01-01T00:00:00Z"
 */
export interface TimeRange {
  /** 开始时间（UTC ISO 8601） */
  start: string;
  /** 结束时间（UTC ISO 8601） */
  end: string;
}

/**
 * 区域（Region）
 * 
 * 统一区域编码格式：{country}-{province}[-{district}]
 * 例如: "CN-11-0101" (中国-北京市-东城区)
 */
export interface Region {
  /** 统一区域编码 */
  code: string;
  /** 区域层级 */
  scope: RegionScope;
  /** 区域名称 */
  name: string;
  /** 时区（IANA Time Zone，如 "Asia/Shanghai"） */
  timezone: string;
  /** 几何边界（GeoJSON，可选） */
  geometry?: GeoJSON.Geometry;
}

/**
 * 响应元数据（Response Metadata）
 * 
 * 所有 Data Product 响应必须包含的元数据
 */
export interface ResponseMetadata {
  /** 请求追踪ID（用于日志关联） */
  trace_id: string;
  /** 关联ID（可选，用于跨服务追踪） */
  correlation_id?: string;
  /** 访问模式 */
  access_mode: AccessMode;
  /** 预测批次ID（predicted 数据时必需） */
  prediction_run_id?: string;
  /** 是否命中缓存 */
  cache_hit: boolean;
  /** 响应生成时间（UTC ISO 8601） */
  generated_at: string;
}

/**
 * 统一输入维度（Unified Input Dimensions）
 * 
 * 所有 Data Product 请求的必需参数
 */
export interface BaseQueryParams {
  /** 统一区域编码 */
  region_code: string;
  /** 时间范围（UTC） */
  time_range: TimeRange;
  /** 数据类型 */
  data_type: DataType;
  /** 天气类型 */
  weather_type: WeatherType;
  /** 产品ID（可选） */
  product_id?: string;
  /** 访问模式 */
  access_mode: AccessMode;
  /** 预测批次ID（predicted 时必需） */
  prediction_run_id?: string;
}

/**
 * 扩展查询参数（Optional Query Extensions）
 */
export interface ExtendedQueryParams extends BaseQueryParams {
  /** 区域层级 */
  region_scope?: RegionScope;
  /** 区域时区 */
  region_timezone?: string;
  /** 数据粒度 */
  granularity?: string;
  /** 地图图层ID */
  layer_id?: string;
}

/**
 * 可观测性字段（Observability Fields）
 */
export interface ObservabilityContext {
  /** 请求追踪ID */
  trace_id: string;
  /** 关联ID */
  correlation_id?: string;
  /** 请求时间（UTC ISO 8601） */
  request_timestamp: string;
}

/**
 * 分页参数（Pagination Params）
 */
export interface PaginationParams {
  /** 页码（从1开始） */
  page: number;
  /** 每页数量 */
  page_size: number;
}

/**
 * 分页响应（Paginated Response）
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  page_size: number;
  /** 总页数 */
  total_pages: number;
  /** 是否有下一页 */
  has_next: boolean;
  /** 是否有上一页 */
  has_previous: boolean;
  /** 元数据 */
  metadata: ResponseMetadata;
}

/**
 * API 错误响应（Error Response）
 */
export interface ErrorResponse {
  /** 错误代码 */
  error_code: string;
  /** 错误消息 */
  message: string;
  /** 详细信息（可选） */
  details?: Record<string, unknown>;
  /** 请求追踪ID */
  trace_id: string;
  /** 时间戳 */
  timestamp: string;
}
