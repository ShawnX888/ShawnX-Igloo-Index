/**
 * 降雨量数据Hook（向后兼容）
 * 内部使用useWeatherData，转换为RainfallData格式
 * 
 * @deprecated 推荐使用 useWeatherData 替代
 */

import { Region, DateRange, DataType, RegionData } from '../types';
import { useWeatherData, useDailyWeatherData } from './useWeatherData';
import { 
  convertRegionWeatherDataToRegionData,
  convertRegionDataToRegionWeatherData 
} from '../lib/dataAdapters';

/**
 * 使用降雨量数据的Hook（向后兼容）
 * 
 * @param selectedRegion 选中的区域
 * @param dateRange 时间范围
 * @param rainfallType 数据类型（历史/预测）
 * @returns 区域降雨量数据集合
 */
export function useRainfallData(
  selectedRegion: Region,
  dateRange: DateRange,
  rainfallType: DataType
): RegionData {
  // 使用通用天气数据Hook，指定weatherType为'rainfall'
  const weatherData = useWeatherData(selectedRegion, dateRange, rainfallType, 'rainfall');
  
  // 转换为RegionData格式（向后兼容）
  return convertRegionWeatherDataToRegionData(weatherData);
}

/**
 * 获取日级数据（从小时级数据累计）（向后兼容）
 * 
 * @param hourlyData 小时级数据
 * @param dateRange 时间范围
 * @returns 日级数据
 */
export function useDailyData(
  hourlyData: RegionData,
  dateRange: DateRange
): RegionData {
  // 转换为RegionWeatherData格式
  const weatherData = convertRegionDataToRegionWeatherData(hourlyData, 'rainfall');
  
  // 使用通用日级数据Hook
  const dailyWeatherData = useDailyWeatherData(weatherData, dateRange, 'rainfall');
  
  // 转换回RegionData格式
  return convertRegionWeatherDataToRegionData(dailyWeatherData);
}

