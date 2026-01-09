/**
 * 数据相关类型定义
 */

import { Region } from './region';

/**
 * 天气数据类型
 * 支持多种天气指标：降雨量、温度、风速、湿度等
 */
export type WeatherType = 'rainfall' | 'temperature' | 'wind' | 'humidity' | 'pressure' | 'snowfall';

/**
 * 数据类型（历史/预测）
 */
export type DataType = 'historical' | 'predicted';

/**
 * 降雨量数据类型（向后兼容）
 * @deprecated 使用 WeatherType 和 DataType 替代
 */
export type RainfallType = DataType;

/**
 * 天气统计数据
 */
export interface WeatherStatistics {
  /** 时间窗口 */
  timeWindow: {
    days: number;
    hours: number;
  };
  /** 统计指标 */
  metrics: {
    total: number;
    avgDaily: number;
    avgHourly: number;
    max: number;
    min: number;
  };
  /** 数据类型 */
  dataType: DataType;
  /** 天气类型 */
  weatherType: WeatherType;
}

/**
 * 通用天气数据接口
 * 支持不同类型的天气指标
 */
export interface WeatherData {
  /** 日期时间（ISO格式） */
  date: string;
  /** 数值（根据天气类型有不同的单位和含义） */
  value: number;
  /** 风险级别（可选） */
  risk?: 'low' | 'medium' | 'high';
  /** 天气类型（可选，用于区分数据类型） */
  weatherType?: WeatherType;
}

/**
 * 降雨量数据（向后兼容）
 * @deprecated 使用 WeatherData 替代，weatherType 为 'rainfall'
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
 * 小时级天气数据
 */
export interface HourlyWeatherData extends WeatherData {
  /** 小时（0-23） */
  hour: number;
}

/**
 * 日级天气数据
 */
export interface DailyWeatherData extends WeatherData {
  /** 日期 */
  day: string;
}

/**
 * 小时级降雨量数据（向后兼容）
 * @deprecated 使用 HourlyWeatherData 替代
 */
export interface HourlyRainfallData extends RainfallData {
  /** 小时（0-23） */
  hour: number;
}

/**
 * 日级降雨量数据（向后兼容）
 * @deprecated 使用 DailyWeatherData 替代
 */
export interface DailyRainfallData extends RainfallData {
  /** 日期 */
  day: string;
}

/**
 * 区域天气数据集合
 * Key: 区域名称（district），Value: 天气数据数组
 */
export interface RegionWeatherData {
  [districtName: string]: WeatherData[];
}

/**
 * 区域降雨量数据集合（向后兼容）
 * Key: 区域名称（district），Value: 降雨量数据数组
 * @deprecated 使用 RegionWeatherData 替代
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

