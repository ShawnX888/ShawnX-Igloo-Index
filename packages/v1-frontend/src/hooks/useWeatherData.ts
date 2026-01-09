/**
 * 通用天气数据Hook
 * 提供数据生成、缓存和补充功能，支持多种天气类型
 */

import { useMemo } from 'react';
import { Region, DateRange, DataType, WeatherType, RegionWeatherData, WeatherData, WeatherStatistics } from '../types';
import { weatherDataGenerator } from '../lib/weatherDataGenerator';
import { calculateWeatherStatistics } from '../lib/weatherStatistics';

/**
 * 使用天气数据的Hook
 * 
 * @param selectedRegion 选中的区域
 * @param dateRange 时间范围
 * @param dataType 数据类型（历史/预测）
 * @param weatherType 天气类型（降雨量/温度/风速等）
 * @param cacheContext 可选的缓存上下文（如产品ID），用于区分不同产品的扩展数据
 * @returns 区域天气数据集合
 */
export function useWeatherData(
  selectedRegion: Region,
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType,
  cacheContext?: string
): RegionWeatherData {
  return useMemo(() => {
    // 验证输入参数
    if (!selectedRegion || !dateRange || !dateRange.from || !dateRange.to) {
      return {};
    }

    // 检查缓存
    if (weatherDataGenerator.hasData(selectedRegion, dateRange, dataType, weatherType, cacheContext)) {
      return weatherDataGenerator.generate(selectedRegion, dateRange, dataType, weatherType, cacheContext);
    }

    // 生成新数据
    return weatherDataGenerator.generate(selectedRegion, dateRange, dataType, weatherType, cacheContext);
  }, [selectedRegion, dateRange, dataType, weatherType, cacheContext]);
}

/**
 * 获取日级数据（从小时级数据累计）
 * 
 * @param hourlyData 小时级数据
 * @param dateRange 时间范围
 * @param weatherType 天气类型
 * @returns 日级数据
 */
export function useDailyWeatherData(
  hourlyData: RegionWeatherData,
  dateRange: DateRange,
  weatherType: WeatherType
): RegionWeatherData {
  return useMemo(() => {
    if (!hourlyData || Object.keys(hourlyData).length === 0) {
      return {};
    }

    const dailyData: RegionWeatherData = {};

    for (const [district, data] of Object.entries(hourlyData)) {
      dailyData[district] = weatherDataGenerator.getDailyData(data, dateRange, weatherType);
    }

    return dailyData;
  }, [hourlyData, dateRange, weatherType]);
}

/**
 * 获取天气统计数据的Hook
 * 
 * @param hourlyData 小时级数据
 * @param dailyData 日级数据
 * @param dateRange 时间范围
 * @param dataType 数据类型
 * @param weatherType 天气类型
 * @returns 天气统计对象
 */
export function useWeatherStatistics(
  hourlyData: WeatherData[],
  dailyData: WeatherData[],
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType
): WeatherStatistics {
  return useMemo(() => {
    return calculateWeatherStatistics(hourlyData, dailyData, dateRange, dataType, weatherType);
  }, [hourlyData, dailyData, dateRange, dataType, weatherType]);
}

