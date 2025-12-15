/**
 * 数据相关类型定义
 */

import { Region } from './region';

/**
 * 降雨量数据类型
 */
export type RainfallType = 'historical' | 'predicted';

/**
 * 降雨量数据
 */
export interface RainfallData {
  /** 日期时间（ISO格式） */
  date: string;
  /** 降雨量（mm） */
  amount: number;
  /** 风险级别（可选） */
  risk?: 'low' | 'medium' | 'high';
}

/**
 * 小时级降雨量数据
 */
export interface HourlyRainfallData extends RainfallData {
  /** 小时（0-23） */
  hour: number;
}

/**
 * 日级降雨量数据
 */
export interface DailyRainfallData extends RainfallData {
  /** 日期 */
  day: string;
}

/**
 * 区域降雨量数据集合
 * Key: 区域名称（district），Value: 降雨量数据数组
 */
export interface RegionData {
  [districtName: string]: RainfallData[];
}

/**
 * 时间范围
 */
export interface DateRange {
  /** 起始日期 */
  from: Date;
  /** 结束日期 */
  to: Date;
  /** 起始小时（0-23） */
  startHour: number;
  /** 结束小时（0-23） */
  endHour: number;
}

/**
 * 时间窗口配置
 */
export interface TimeWindowConfig {
  /** 窗口类型 */
  type: 'hourly' | 'daily' | 'weekly' | 'monthly';
  /** 窗口大小（小时/天/周/月） */
  size: number;
  /** 滑动步长 */
  step?: number;
}

