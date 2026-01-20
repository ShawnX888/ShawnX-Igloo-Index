/**
 * 时间与时区统一口径 Types
 * 
 * 本模块定义v2时间三层口径:
 * - Storage & Transport: UTC (DB TIMESTAMPTZ, API timestamps)
 * - Business Boundary: region_timezone (自然日/月边界对齐)
 * - Presentation: user local timezone (UI展示)
 * 
 * Reference:
 * - docs/v2/v2实施细则/04-时间与时区口径统一-细则.md
 * - docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md
 * 
 * 硬规则:
 * - 存储/传输统一UTC
 * - 业务判断(per day/month)必须按 region_timezone
 * - 前端展示时转换，但不影响业务计算
 * 
 * CRITICAL: 必须与 backend/app/schemas/time.py 保持完全一致
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * 时间窗口类型
 * 
 * 对应产品规则中的 timeWindow
 */
export enum TimeWindowType {
  HOURLY = 'hourly',    // 小时级: 按UTC连续回溯，无需自然边界
  DAILY = 'daily',      // 日级: 边界对齐到 region_timezone 自然日
  WEEKLY = 'weekly',    // 周级: 边界对齐到 region_timezone 自然周
  MONTHLY = 'monthly',  // 月级: 边界对齐到 region_timezone 自然月
}

/**
 * 时间粒度
 */
export enum TimeGranularity {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

// ============================================================================
// Time Range (展示窗口)
// ============================================================================

/**
 * 时间范围 (UTC)
 * 
 * 用途: Data Product请求的展示窗口
 * 
 * 规则:
 * - start/end 都是 UTC (ISO 8601 format)
 * - end 必须晚于 start
 * - 可选包含 region_timezone 用于业务边界对齐
 */
export interface TimeRangeUTC {
  /** 起始时间(UTC, ISO 8601) */
  start: string;
  /** 结束时间(UTC, ISO 8601) */
  end: string;
  /** 区域时区(如Asia/Shanghai,用于业务边界对齐) */
  region_timezone?: string;
}

// ============================================================================
// Calculation Range (计算窗口 - 含扩展)
// ============================================================================

/**
 * 计算窗口 (UTC, 包含扩展)
 * 
 * 用途: 后端计算时可能需要扩展窗口以保证边界完整性
 * 
 * 规则:
 * - calculation_start <= display_start
 * - calculation_end >= display_end
 * - 输出必须裁剪回 display 范围
 */
export interface CalculationRangeUTC {
  /** 计算起始时间(UTC, ISO 8601,可能早于展示窗口) */
  calculation_start: string;
  /** 计算结束时间(UTC, ISO 8601) */
  calculation_end: string;
  /** 展示起始时间(UTC, ISO 8601,用户请求的time_range.start) */
  display_start: string;
  /** 展示结束时间(UTC, ISO 8601,用户请求的time_range.end) */
  display_end: string;
  /** 起始扩展的小时数 */
  extension_hours?: number;
}

// ============================================================================
// 时区对齐元信息
// ============================================================================

/**
 * 时区对齐元信息
 * 
 * 用途: 在Meta/Legend中说明时间口径
 */
export interface TimezoneAlignmentMeta {
  /** 区域时区(业务边界) */
  region_timezone: string;
  /** 是否进行了自然边界对齐(daily/weekly/monthly) */
  alignment_applied: boolean;
  /** 时间窗口类型 */
  time_window_type?: TimeWindowType;
  /** 对齐细节(如: '自然日边界: 2025-01-20 00:00 CST → 2025-01-19 16:00 UTC') */
  alignment_details?: string;
}

// ============================================================================
// 事件时间标准格式
// ============================================================================

/**
 * 事件时间戳 (标准格式)
 * 
 * 用途: 统一事件类数据的时间字段
 */
export interface EventTimestamp {
  /** 事件时间(UTC, ISO 8601,权威字段) */
  event_time_utc: string;
  /** 事件发生地时区 */
  region_timezone: string;
  /** 自然日期(region_tz视角,如'2025-01-20',用于UI展示) */
  natural_date?: string;
  /** 自然日期时间(region_tz视角,如'2025-01-20 14:30:00 CST') */
  natural_datetime_display?: string;
}

// ============================================================================
// 时间口径验证
// ============================================================================

/**
 * 时间口径一致性检查结果
 * 
 * 用于验证L0/L1/L2是否使用了一致的时间边界
 */
export interface TimeConsistencyCheck {
  /** 是否一致 */
  consistent: boolean;
  /** 检查的时间范围 */
  time_range_utc: TimeRangeUTC;
  /** 区域时区 */
  region_timezone: string;
  /** 数据产品 → (start, end) 映射 */
  data_products: Record<string, [string, string]>;
  /** 时间边界不一致的数据产品 */
  inconsistent_products?: string[];
  /** 修复建议 */
  recommendation?: string;
}

// ============================================================================
// Per Day/Month 规则元信息
// ============================================================================

/**
 * 频次限制元信息
 * 
 * 用于解释"once per day/month"等规则的时区语义
 */
export interface FrequencyLimitMeta {
  /** 频次类型(如: 'once_per_day', 'once_per_month') */
  frequency_type: string;
  /** 周期边界(如: 'natural_day', 'natural_month') */
  period_boundary: string;
  /** 边界时区(如: 'Asia/Shanghai') */
  boundary_timezone: string;
  /** 示例说明(如: '北京时间2025-01-20 00:00:00对应UTC 2025-01-19 16:00:00') */
  example_explanation?: string;
}
