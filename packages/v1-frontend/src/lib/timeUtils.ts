/**
 * 时间处理工具函数
 * 
 * 统一使用 UTC 时间作为内部标准，仅在 UI 显示时转换为本地时区
 * 
 * 原则：
 * - 内部计算和存储：UTC 时间
 * - UI 显示：本地时间
 * - 用户输入：本地时间 → 转换为 UTC 存储
 */

import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';

/**
 * 获取用户时区
 * @returns 用户时区字符串（如 'Asia/Shanghai', 'America/New_York'）
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * 将本地时间转换为 UTC
 * 
 * 使用场景：
 * - 用户选择日期/时间后，需要转换为 UTC 存储
 * - Calendar 组件选择日期后转换
 * 
 * @param localDate 本地时间
 * @returns UTC 时间
 * 
 * @example
 * const localDate = new Date(2025, 11, 18, 14, 0, 0); // 本地时间 2025-12-18 14:00
 * const utcDate = localToUTC(localDate); // 转换为 UTC
 */
export function localToUTC(localDate: Date): Date {
  const tz = getUserTimezone();
  return fromZonedTime(localDate, tz);
}

/**
 * 将 UTC 时间转换为本地时间
 * 
 * 使用场景：
 * - 显示 UTC 时间戳时，转换为用户本地时间
 * - 图表日期格式化
 * - UI 时间显示
 * 
 * @param utcDate UTC 时间
 * @returns 本地时间
 * 
 * @example
 * const utcDate = new Date('2025-12-18T06:00:00Z'); // UTC 时间
 * const localDate = utcToLocal(utcDate); // 转换为本地时间（如 UTC+8 则为 14:00）
 */
export function utcToLocal(utcDate: Date): Date {
  const tz = getUserTimezone();
  return toZonedTime(utcDate, tz);
}

/**
 * 格式化 UTC 日期为本地时间显示
 * 
 * 使用场景：
 * - 图表 X 轴日期格式化
 * - 时间范围显示
 * - 风险事件时间显示
 * 
 * @param utcDate UTC 时间
 * @param formatStr 格式化字符串（date-fns 格式）
 * @returns 格式化后的本地时间字符串
 * 
 * @example
 * const utcDate = new Date('2025-12-18T06:00:00Z');
 * formatUTCDate(utcDate, 'MMM dd, yyyy HH:mm'); // "Dec 18, 2025 14:00" (UTC+8)
 */
export function formatUTCDate(utcDate: Date, formatStr: string): string {
  const localDate = utcToLocal(utcDate);
  return format(localDate, formatStr);
}

/**
 * 获取 UTC 日期的本地小时数
 * 
 * 用于显示用户选择的小时（本地时区）
 * 
 * @param utcDate UTC 时间
 * @returns 本地时区的小时数 (0-23)
 */
export function getLocalHour(utcDate: Date): number {
  const localDate = utcToLocal(utcDate);
  return localDate.getHours();
}

/**
 * 创建 UTC 日期（从本地时间组件）
 * 
 * 用于从用户输入的日期组件（年、月、日、时）创建 UTC 日期
 * 
 * @param year 年份
 * @param month 月份 (0-11)
 * @param day 日期 (1-31)
 * @param hour 小时 (0-23)，默认为 0
 * @param minute 分钟 (0-59)，默认为 0
 * @param second 秒 (0-59)，默认为 0
 * @returns UTC 日期
 */
export function createUTCDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  // 先创建本地时间
  const localDate = new Date(year, month, day, hour, minute, second);
  // 转换为 UTC
  return localToUTC(localDate);
}

