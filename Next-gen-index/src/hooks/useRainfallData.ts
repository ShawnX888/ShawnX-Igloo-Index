/**
 * 降雨量数据Hook
 * 提供数据生成、缓存和补充功能
 */

import { useMemo } from 'react';
import { Region, DateRange, RainfallType, RegionData } from '../types';
import { rainfallDataGenerator } from '../lib/rainfallDataGenerator';

/**
 * 使用降雨量数据的Hook
 * 
 * @param selectedRegion 选中的区域
 * @param dateRange 时间范围
 * @param rainfallType 数据类型（历史/预测）
 * @returns 区域降雨量数据集合
 */
export function useRainfallData(
  selectedRegion: Region,
  dateRange: DateRange,
  rainfallType: RainfallType
): RegionData {
  return useMemo(() => {
    // 验证输入参数
    if (!selectedRegion || !dateRange || !dateRange.from || !dateRange.to) {
      return {};
    }

    // 检查缓存
    if (rainfallDataGenerator.hasData(selectedRegion, dateRange, rainfallType)) {
      return rainfallDataGenerator.generate(selectedRegion, dateRange, rainfallType);
    }

    // 生成新数据
    return rainfallDataGenerator.generate(selectedRegion, dateRange, rainfallType);
  }, [selectedRegion, dateRange, rainfallType]);
}

/**
 * 获取日级数据（从小时级数据累计）
 * 
 * @param hourlyData 小时级数据
 * @param dateRange 时间范围
 * @returns 日级数据
 */
export function useDailyData(
  hourlyData: RegionData,
  dateRange: DateRange
): RegionData {
  return useMemo(() => {
    if (!hourlyData || Object.keys(hourlyData).length === 0) {
      return {};
    }

    const dailyData: RegionData = {};

    for (const [district, data] of Object.entries(hourlyData)) {
      dailyData[district] = rainfallDataGenerator.getDailyData(data, dateRange);
    }

    return dailyData;
  }, [hourlyData, dateRange]);
}

