/**
 * 数据生成器接口定义
 */

import { Region, DateRange, RainfallType, RegionData } from '../types';

/**
 * 降雨量数据生成器接口
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
    type: RainfallType
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
    type: RainfallType
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
    type: RainfallType,
    existingData: RegionData
  ): RegionData;
}

