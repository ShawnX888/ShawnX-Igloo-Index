/**
 * Data Product Types - v2 Shared Contract
 * 
 * 数据产品输出DTO分类：Series / Events / Aggregations
 */

import { DataType, TierLevel, WeatherType } from './enums';
import { ResponseMetadata } from './common';

/**
 * ============================================================================
 * Series（时间序列）
 * ============================================================================
 * 用于展示随时间变化的数据（如天气趋势、风险累计值）
 */

/**
 * 时间序列数据点
 */
export interface SeriesDataPoint {
  /** 时间戳（UTC ISO 8601） */
  timestamp: string;
  /** 数值 */
  value: number;
  /** 单位（如 "mm", "km/h", "°C"） */
  unit: string;
}

/**
 * 时间序列响应
 */
export interface SeriesResponse {
  /** 数据类型 */
  data_type: DataType;
  /** 天气类型（可选） */
  weather_type?: WeatherType;
  /** 时间序列数据 */
  series: SeriesDataPoint[];
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * 多序列响应（用于 Timeline 三泳道）
 */
export interface MultiSeriesResponse {
  /** 数据类型 */
  data_type: DataType;
  /** 序列数据（按名称分组） */
  series: Record<string, SeriesDataPoint[]>;
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * ============================================================================
 * Events（事件列表）
 * ============================================================================
 * 用于展示离散事件（如风险事件、理赔记录）
 */

/**
 * 事件基础结构
 */
export interface EventBase {
  /** 事件ID */
  id: string;
  /** 事件时间（UTC ISO 8601） */
  timestamp: string;
  /** 区域编码 */
  region_code: string;
  /** 数据类型 */
  data_type: DataType;
}

/**
 * 风险事件（Risk Event）
 */
export interface RiskEvent extends EventBase {
  /** 产品ID */
  product_id: string;
  /** 天气类型 */
  weather_type: WeatherType;
  /** 风险等级 */
  tier_level: TierLevel;
  /** 触发值 */
  trigger_value: number;
  /** 阈值 */
  threshold_value: number;
  /** 单位 */
  unit: string;
  /** 预测批次ID（predicted 时必需） */
  prediction_run_id?: string;
  /** 规则版本或哈希（用于追溯） */
  rules_hash?: string;
}

/**
 * 理赔事件（Claim Event）
 */
export interface ClaimEvent extends EventBase {
  /** 理赔单号 */
  claim_number: string;
  /** 保单ID */
  policy_id: string;
  /** 关联的风险事件ID（可选） */
  risk_event_id?: string;
  /** 风险等级 */
  tier_level: TierLevel;
  /** 赔付百分比 */
  payout_percentage: number;
  /** 赔付金额（Access Mode 可能裁剪） */
  payout_amount?: number;
  /** 状态 */
  status: string;
}

/**
 * 事件列表响应
 */
export interface EventsResponse<T extends EventBase = EventBase> {
  /** 事件列表 */
  events: T[];
  /** 总数 */
  total: number;
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * ============================================================================
 * Aggregations（聚合结果）
 * ============================================================================
 * 用于展示统计汇总（如KPI、排名）
 */

/**
 * 聚合维度
 */
export interface AggregationDimension {
  /** 维度名称（如 "region", "product", "tier"） */
  name: string;
  /** 维度值列表 */
  values: string[];
}

/**
 * KPI 指标
 */
export interface KPIMetric {
  /** 指标名称 */
  name: string;
  /** 当前值 */
  value: number;
  /** 单位（可选） */
  unit?: string;
  /** 与上期对比（可选，百分比） */
  change_percent?: number;
  /** 趋势方向（可选：up/down/flat） */
  trend?: string;
}

/**
 * 排名项
 */
export interface RankingItem {
  /** 排名 */
  rank: number;
  /** 实体ID（如 region_code） */
  entity_id: string;
  /** 实体名称 */
  entity_name: string;
  /** 指标值 */
  value: number;
  /** 单位（可选） */
  unit?: string;
  /** 占比（可选，百分比） */
  percentage?: number;
}

/**
 * 聚合响应
 */
export interface AggregationResponse {
  /** 聚合维度 */
  dimensions: AggregationDimension[];
  /** 指标数据（字段名 -> 数值） */
  metrics: Record<string, number>;
  /** 聚合范围说明（如 "province_level", "district_level"） */
  aggregation_scope: string;
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * KPI 响应
 */
export interface KPIResponse {
  /** KPI 指标列表 */
  kpis: KPIMetric[];
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * 排名响应
 */
export interface RankingResponse {
  /** 排名列表 */
  rankings: RankingItem[];
  /** 总数 */
  total: number;
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * ============================================================================
 * Data Product 特化类型
 * ============================================================================
 */

/**
 * L0 Dashboard 响应（省级态势）
 */
export interface L0DashboardResponse {
  /** KPI 指标 */
  kpis: KPIMetric[];
  /** Top5 排名（Combined/Policies/Claims） */
  rankings: {
    combined?: RankingItem[];
    policies?: RankingItem[];
    claims?: RankingItem[];
  };
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * L1 Region Intelligence 响应（区域情报）
 */
export interface L1RegionIntelligenceResponse {
  /** 概览 KPI */
  overview: KPIMetric[];
  /** 统一时间轴（三泳道：Weather/Risk/Claims） */
  timeline: {
    weather: SeriesDataPoint[];
    risk: SeriesDataPoint[];
    claims: SeriesDataPoint[];
  };
  /** 趋势分析（可选） */
  trends?: Record<string, SeriesDataPoint[]>;
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * L2 Evidence 响应（证据链）
 */
export interface L2EvidenceResponse {
  /** 风险事件列表 */
  risk_events: RiskEvent[];
  /** 理赔事件列表 */
  claim_events: ClaimEvent[];
  /** 事件关联（risk_event_id -> claim_event_ids） */
  associations: Record<string, string[]>;
  /** 总数 */
  total: number;
  /** 响应元数据 */
  metadata: ResponseMetadata;
}

/**
 * Map Overlays 响应（地图叠加层）
 */
export interface MapOverlaysResponse {
  /** 渲染数据（按图层分组） */
  layers: Record<string, unknown>;
  /** 图例信息 */
  legend: {
    type: string;
    unit: string;
    thresholds?: number[];
    colors?: string[];
  };
  /** 响应元数据 */
  metadata: ResponseMetadata;
}
