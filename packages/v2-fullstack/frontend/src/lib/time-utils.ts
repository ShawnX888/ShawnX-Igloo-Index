/**
 * 时间与时区处理工具函数 (前端)
 * 
 * 提供UTC转换、展示格式化等工具。
 * 
 * Reference:
 * - docs/v2/v2实施细则/04-时间与时区口径统一-细则.md
 * 
 * CRITICAL:
 * - 前端只负责展示转换
 * - 业务边界对齐在后端完成
 * - 所有发送到后端的时间必须是UTC
 */

import {
  TimeRangeUTC,
  EventTimestamp,
  TimeWindowType,
  TimeGranularity,
} from '@/types/time';

// ============================================================================
// 时区转换 (展示用)
// ============================================================================

/**
 * 将UTC时间转换为本地时间
 * 
 * 用途: UI展示
 * 
 * @param utcTime - UTC时间 (ISO 8601 string)
 * @param targetTimezone - 目标时区 (可选, 默认用户本地时区)
 * @returns 格式化的本地时间字符串
 */
export function formatUTCToLocal(
  utcTime: string,
  targetTimezone?: string,
  format: 'datetime' | 'date' | 'time' = 'datetime'
): string {
  const date = new Date(utcTime);
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: targetTimezone,
  };
  
  if (format === 'datetime') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  } else if (format === 'date') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
  } else if (format === 'time') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * 将本地时间转换为UTC (用于发送到后端)
 * 
 * @param localDate - 本地Date对象
 * @returns UTC ISO 8601 string
 */
export function toUTC(localDate: Date): string {
  return localDate.toISOString();
}

/**
 * 解析UTC时间字符串为Date对象
 * 
 * @param utcString - UTC ISO 8601 string
 * @returns Date对象
 */
export function parseUTC(utcString: string): Date {
  return new Date(utcString);
}

// ============================================================================
// 时间范围工具
// ============================================================================

/**
 * 计算时间范围的持续时间
 * 
 * @param timeRange - 时间范围
 * @returns 持续时间(小时)
 */
export function calculateDurationHours(timeRange: TimeRangeUTC): number {
  const start = parseUTC(timeRange.start);
  const end = parseUTC(timeRange.end);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * 计算时间范围的持续时间(天数)
 * 
 * @param timeRange - 时间范围
 * @returns 持续时间(天)
 */
export function calculateDurationDays(timeRange: TimeRangeUTC): number {
  return calculateDurationHours(timeRange) / 24;
}

/**
 * 验证时间范围是否有效
 * 
 * @param timeRange - 时间范围
 * @returns [是否有效, 错误信息]
 */
export function validateTimeRange(timeRange: TimeRangeUTC): [boolean, string | null] {
  const start = parseUTC(timeRange.start);
  const end = parseUTC(timeRange.end);
  
  if (end <= start) {
    return [false, 'end must be after start'];
  }
  
  return [true, null];
}

/**
 * 创建时间范围 (从本地Date对象)
 * 
 * @param startLocal - 起始时间(本地)
 * @param endLocal - 结束时间(本地)
 * @param regionTimezone - 区域时区(可选)
 * @returns TimeRangeUTC
 */
export function createTimeRange(
  startLocal: Date,
  endLocal: Date,
  regionTimezone?: string
): TimeRangeUTC {
  return {
    start: toUTC(startLocal),
    end: toUTC(endLocal),
    region_timezone: regionTimezone,
  };
}

// ============================================================================
// 展示格式化
// ============================================================================

/**
 * 格式化事件时间戳用于展示
 * 
 * @param eventTime - 事件时间戳
 * @param showTimezone - 是否显示时区信息
 * @returns 格式化字符串
 */
export function formatEventTimestamp(
  eventTime: EventTimestamp,
  showTimezone: boolean = false
): string {
  if (eventTime.natural_datetime_display && showTimezone) {
    return eventTime.natural_datetime_display;
  }
  
  if (eventTime.natural_date) {
    const time = parseUTC(eventTime.event_time_utc);
    return `${eventTime.natural_date} ${time.toLocaleTimeString()}`;
  }
  
  return formatUTCToLocal(eventTime.event_time_utc, eventTime.region_timezone);
}

/**
 * 格式化时间范围用于展示
 * 
 * @param timeRange - 时间范围
 * @param format - 格式类型
 * @returns 格式化字符串
 */
export function formatTimeRange(
  timeRange: TimeRangeUTC,
  format: 'short' | 'long' = 'short'
): string {
  const startDate = parseUTC(timeRange.start);
  const endDate = parseUTC(timeRange.end);
  
  if (format === 'short') {
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  }
  
  return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`;
}

/**
 * 获取相对时间描述
 * 
 * @param utcTime - UTC时间字符串
 * @returns 相对时间描述(如: '2 hours ago', 'in 3 days')
 */
export function getRelativeTime(utcTime: string): string {
  const date = parseUTC(utcTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (Math.abs(diffHours) < 1) {
    const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
    return diffMs > 0
      ? `${diffMinutes} minutes ago`
      : `in ${diffMinutes} minutes`;
  }
  
  if (Math.abs(diffHours) < 24) {
    const hours = Math.floor(Math.abs(diffHours));
    return diffMs > 0
      ? `${hours} hours ago`
      : `in ${hours} hours`;
  }
  
  const diffDays = Math.floor(Math.abs(diffHours) / 24);
  return diffMs > 0
    ? `${diffDays} days ago`
    : `in ${diffDays} days`;
}

// ============================================================================
// 快捷时间范围
// ============================================================================

/**
 * 创建预设时间范围
 */
export const TimeRangePresets = {
  /**
   * 最近7天
   */
  last7Days: (regionTimezone?: string): TimeRangeUTC => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return createTimeRange(start, end, regionTimezone);
  },
  
  /**
   * 最近30天
   */
  last30Days: (regionTimezone?: string): TimeRangeUTC => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return createTimeRange(start, end, regionTimezone);
  },
  
  /**
   * 本月
   */
  thisMonth: (regionTimezone?: string): TimeRangeUTC => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return createTimeRange(start, end, regionTimezone);
  },
  
  /**
   * 上月
   */
  lastMonth: (regionTimezone?: string): TimeRangeUTC => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return createTimeRange(start, end, regionTimezone);
  },
  
  /**
   * 今年
   */
  thisYear: (regionTimezone?: string): TimeRangeUTC => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return createTimeRange(start, end, regionTimezone);
  },
  
  /**
   * 自定义范围
   */
  custom: (
    startLocal: Date,
    endLocal: Date,
    regionTimezone?: string
  ): TimeRangeUTC => {
    return createTimeRange(startLocal, endLocal, regionTimezone);
  },
};

// ============================================================================
// 中国时区映射 (简化版)
// ============================================================================

/**
 * 中国省份代码 → 时区映射
 * 
 * 简化版: 大部分使用东八区
 */
export const ChinaProvinceTimezones: Record<string, string> = {
  'CN-GD': 'Asia/Shanghai',  // 广东
  'CN-BJ': 'Asia/Shanghai',  // 北京
  'CN-SH': 'Asia/Shanghai',  // 上海
  'CN-XJ': 'Asia/Urumqi',    // 新疆 (UTC+6)
  'CN-XZ': 'Asia/Shanghai',  // 西藏
  // TODO: 完善其他省份
};

/**
 * 根据区域代码获取时区
 * 
 * @param regionCode - 区域代码(如: 'CN-GD')
 * @returns 时区字符串(如: 'Asia/Shanghai')
 */
export function getTimezoneForRegion(regionCode: string): string {
  const timezone = ChinaProvinceTimezones[regionCode];
  if (!timezone) {
    console.warn(`[TimeUtils] Timezone not found for region: ${regionCode}, using default Asia/Shanghai`);
    return 'Asia/Shanghai';
  }
  return timezone;
}

// ============================================================================
// 时间范围工具
// ============================================================================

/**
 * 判断UTC时间是否在范围内
 * 
 * @param utcTime - UTC时间
 * @param timeRange - 时间范围
 * @returns 是否在范围内
 */
export function isTimeInRange(utcTime: string, timeRange: TimeRangeUTC): boolean {
  const time = parseUTC(utcTime);
  const start = parseUTC(timeRange.start);
  const end = parseUTC(timeRange.end);
  
  return time >= start && time <= end;
}

/**
 * 扩展时间范围 (用于说明扩展窗口)
 * 
 * 前端不执行扩展窗口计算，这只是辅助理解/展示
 * 
 * @param timeRange - 原始时间范围
 * @param extensionHours - 扩展小时数
 * @returns 扩展后的时间范围(仅用于展示说明)
 */
export function explainExtendedRange(
  timeRange: TimeRangeUTC,
  extensionHours: number
): CalculationRangeUTC {
  const start = parseUTC(timeRange.start);
  const calculationStart = new Date(start.getTime() - extensionHours * 60 * 60 * 1000);
  
  return {
    calculation_start: toUTC(calculationStart),
    calculation_end: timeRange.end,
    display_start: timeRange.start,
    display_end: timeRange.end,
    extension_hours: extensionHours,
  };
}
