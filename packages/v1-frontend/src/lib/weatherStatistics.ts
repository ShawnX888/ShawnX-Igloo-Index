/**
 * 天气统计计算工具
 */

import { WeatherData, DateRange, DataType, WeatherType, WeatherStatistics } from '../types';

/**
 * 计算天气统计数据
 * 
 * @param hourlyData 小时级天气数据
 * @param dailyData 日级天气数据
 * @param dateRange 时间范围
 * @param dataType 数据类型（历史/预测）
 * @param weatherType 天气类型
 * @returns 天气统计对象
 */
export function calculateWeatherStatistics(
  hourlyData: WeatherData[],
  dailyData: WeatherData[],
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType
): WeatherStatistics {
  // 1. 计算时间窗口
  const diffMs = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  // 2. 计算统计指标
  const totalValue = dailyData.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const avgDaily = dailyData.length > 0 ? totalValue / dailyData.length : 0;
  const avgHourly = hourlyData.length > 0 ? totalValue / hourlyData.length : 0;
  
  const allValues = hourlyData.length > 0 ? hourlyData.map(d => d.value) : dailyData.map(d => d.value);
  const max = allValues.length > 0 ? Math.max(...allValues) : 0;
  const min = allValues.length > 0 ? Math.min(...allValues) : 0;

  return {
    timeWindow: { days, hours },
    metrics: {
      total: Math.round(totalValue * 100) / 100,
      avgDaily: Math.round(avgDaily * 100) / 100,
      avgHourly: Math.round(avgHourly * 100) / 100,
      max: Math.round(max * 100) / 100,
      min: Math.round(min * 100) / 100,
    },
    dataType,
    weatherType
  };
}

