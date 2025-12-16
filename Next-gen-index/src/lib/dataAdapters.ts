/**
 * 数据适配器函数
 * 用于在迁移过程中转换数据格式（临时，迁移完成后可移除）
 */

import { WeatherData, RainfallData, RegionWeatherData, RegionData } from '../types';

/**
 * 将WeatherData转换为RainfallData（向后兼容）
 */
export function convertWeatherDataToRainfallData(weatherData: WeatherData[]): RainfallData[] {
  return weatherData.map(item => ({
    date: item.date,
    amount: item.value, // value -> amount
    risk: item.risk
  }));
}

/**
 * 将RegionWeatherData转换为RegionData（向后兼容）
 */
export function convertRegionWeatherDataToRegionData(weatherData: RegionWeatherData): RegionData {
  const result: RegionData = {};
  for (const [district, data] of Object.entries(weatherData)) {
    result[district] = convertWeatherDataToRainfallData(data);
  }
  return result;
}

/**
 * 将RainfallData转换为WeatherData
 */
export function convertRainfallDataToWeatherData(rainfallData: RainfallData[], weatherType: 'rainfall' = 'rainfall'): WeatherData[] {
  return rainfallData.map(item => ({
    date: item.date,
    value: item.amount, // amount -> value
    risk: item.risk,
    weatherType
  }));
}

/**
 * 将RegionData转换为RegionWeatherData
 */
export function convertRegionDataToRegionWeatherData(regionData: RegionData, weatherType: 'rainfall' = 'rainfall'): RegionWeatherData {
  const result: RegionWeatherData = {};
  for (const [district, data] of Object.entries(regionData)) {
    result[district] = convertRainfallDataToWeatherData(data, weatherType);
  }
  return result;
}

