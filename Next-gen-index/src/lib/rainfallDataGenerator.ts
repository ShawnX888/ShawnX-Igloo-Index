/**
 * Mock降雨量数据生成器（向后兼容）
 * 实现RainfallDataGenerator接口，内部使用WeatherDataGenerator
 * 
 * @deprecated 推荐使用 WeatherDataGenerator 替代
 */

import { Region, DateRange, DataType, RegionData, RainfallData, WeatherData } from '../types';
import { RainfallDataGenerator } from '../interfaces/dataGenerator';
import { weatherDataGenerator } from './weatherDataGenerator';

/**
 * 将WeatherData转换为RainfallData（向后兼容）
 */
function convertWeatherDataToRainfallData(weatherData: WeatherData[]): RainfallData[] {
  return weatherData.map(item => ({
    date: item.date,
    amount: item.value, // value -> amount
    risk: item.risk
  }));
}

/**
 * 将RegionWeatherData转换为RegionData（向后兼容）
 */
function convertRegionWeatherDataToRegionData(weatherData: Record<string, WeatherData[]>): RegionData {
  const result: RegionData = {};
  for (const [district, data] of Object.entries(weatherData)) {
    result[district] = convertWeatherDataToRainfallData(data);
  }
  return result;
}

/**
 * Mock降雨量数据生成器实现（向后兼容）
 * 内部使用WeatherDataGenerator，转换为RainfallData格式
 */
export class MockRainfallDataGenerator implements RainfallDataGenerator {
  /**
   * 生成降雨量数据
   */
  generate(region: Region, dateRange: DateRange, type: DataType): RegionData {
    // 使用通用天气数据生成器，生成降雨量数据
    const weatherData = weatherDataGenerator.generate(region, dateRange, type, 'rainfall');
    return convertRegionWeatherDataToRegionData(weatherData);
  }

  /**
   * 检查数据是否存在
   */
  hasData(region: Region, dateRange: DateRange, type: DataType): boolean {
    return weatherDataGenerator.hasData(region, dateRange, type, 'rainfall');
  }

  /**
   * 补充缺失的数据
   */
  supplement(
    region: Region,
    dateRange: DateRange,
    type: DataType,
    existingData: RegionData
  ): RegionData {
    // 转换为WeatherData格式
    const weatherData: Record<string, WeatherData[]> = {};
    for (const [district, data] of Object.entries(existingData)) {
      weatherData[district] = data.map(item => ({
        date: item.date,
        value: item.amount,
        risk: item.risk,
        weatherType: 'rainfall' as const
      }));
    }

    // 使用通用生成器补充数据
    const supplemented = weatherDataGenerator.supplement(region, dateRange, type, 'rainfall', weatherData);
    return convertRegionWeatherDataToRegionData(supplemented);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    weatherDataGenerator.clearCache();
  }

  /**
   * 获取日级数据（从小时级数据累计）
   */
  getDailyData(hourlyData: RainfallData[], dateRange: DateRange): RainfallData[] {
    // 转换为WeatherData格式
    const weatherData: WeatherData[] = hourlyData.map(item => ({
      date: item.date,
      value: item.amount,
      risk: item.risk,
      weatherType: 'rainfall' as const
    }));

    // 使用通用生成器获取日级数据
    const dailyWeatherData = weatherDataGenerator.getDailyData(weatherData, dateRange, 'rainfall');
    return convertWeatherDataToRainfallData(dailyWeatherData);
  }
}

// 导出单例实例
export const rainfallDataGenerator = new MockRainfallDataGenerator();
