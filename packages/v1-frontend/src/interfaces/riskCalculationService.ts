/**
 * 风险计算服务接口定义
 * 提供产品库与计算引擎的协同接口
 */

import { Region, DateRange, WeatherData, RiskEvent, RiskStatistics } from '../types';

/**
 * 风险计算服务接口
 * 封装产品库与计算引擎的协同逻辑
 */
export interface RiskCalculationService {
  /**
   * 计算风险事件
   * @param productId 产品ID
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param weatherData 天气数据数组
   * @returns 风险事件列表
   * @throws 如果产品不存在或计算失败，抛出错误
   */
  calculateRiskEvents(
    productId: string,
    region: Region,
    dateRange: DateRange,
    weatherData: WeatherData[]
  ): RiskEvent[];

  /**
   * 计算风险统计信息
   * @param productId 产品ID
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param weatherData 天气数据数组
   * @returns 风险统计数据
   * @throws 如果产品不存在或计算失败，抛出错误
   */
  calculateRiskStatistics(
    productId: string,
    region: Region,
    dateRange: DateRange,
    weatherData: WeatherData[]
  ): RiskStatistics;

  /**
   * 批量计算多个产品的风险事件
   * @param productIds 产品ID数组
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param weatherData 天气数据数组
   * @returns 产品ID到风险事件列表的映射
   */
  calculateMultipleProducts(
    productIds: string[],
    region: Region,
    dateRange: DateRange,
    weatherData: WeatherData[]
  ): Map<string, RiskEvent[]>;

  /**
   * 验证产品是否存在
   * @param productId 产品ID
   * @returns 产品是否存在
   */
  hasProduct(productId: string): boolean;
}

