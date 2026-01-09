/**
 * 数据生成器接口定义
 */

import { Region, DateRange, DataType, WeatherType, RegionWeatherData, RegionData } from '../types';

/**
 * 天气数据生成器接口（通用接口，支持多种天气类型）
 */
export interface WeatherDataGenerator {
  /**
   * 生成天气数据
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param dataType 数据类型（历史/预测）
   * @param weatherType 天气类型（降雨量/温度/风速等）
   * @returns 区域天气数据集合
   */
  generate(
    region: Region,
    dateRange: DateRange,
    dataType: DataType,
    weatherType: WeatherType
  ): RegionWeatherData;

  /**
   * 检查数据是否存在
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param dataType 数据类型
   * @param weatherType 天气类型
   * @returns 是否存在完整数据
   */
  hasData(
    region: Region,
    dateRange: DateRange,
    dataType: DataType,
    weatherType: WeatherType
  ): boolean;

  /**
   * 补充缺失的数据
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param dataType 数据类型
   * @param weatherType 天气类型
   * @param existingData 已有数据
   * @returns 补充后的完整数据
   */
  supplement(
    region: Region,
    dateRange: DateRange,
    dataType: DataType,
    weatherType: WeatherType,
    existingData: RegionWeatherData
  ): RegionWeatherData;
}

/**
 * 降雨量数据生成器接口（向后兼容）
 * @deprecated 使用 WeatherDataGenerator 替代
 */
export interface RainfallDataGenerator {
  /**
   * 生成降雨量数据
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param type 数据类型（历史/预测）
   * @returns 区域降雨量数据集合
   */
  generate(
    region: Region,
    dateRange: DateRange,
    type: DataType
  ): RegionData;

  /**
   * 检查数据是否存在
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param type 数据类型
   * @returns 是否存在完整数据
   */
  hasData(
    region: Region,
    dateRange: DateRange,
    type: DataType
  ): boolean;

  /**
   * 补充缺失的数据
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param type 数据类型
   * @param existingData 已有数据
   * @returns 补充后的完整数据
   */
  supplement(
    region: Region,
    dateRange: DateRange,
    type: DataType,
    existingData: RegionData
  ): RegionData;
}

