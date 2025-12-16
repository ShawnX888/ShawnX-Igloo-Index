/**
 * 风险计算引擎接口定义
 */

import { Product, Region, DateRange, WeatherData, RiskEvent, RiskStatistics } from '../types';

/**
 * 风险计算引擎接口
 */
export interface RiskCalculationEngine {
  /**
   * 计算风险事件
   * @param product 产品对象
   * @param region 区域信息
   * @param dateRange 时间范围
   * @param weatherData 天气数据数组（支持多种天气类型）
   * @returns 风险事件列表
   */
  calculateRiskEvents(
    product: Product,
    region: Region,
    dateRange: DateRange,
    weatherData: WeatherData[]
  ): RiskEvent[];

  /**
   * 计算风险统计信息
   * @param events 风险事件列表
   * @returns 风险统计数据
   */
  calculateRiskStatistics(events: RiskEvent[]): RiskStatistics;

  /**
   * 验证产品规则配置
   * @param product 产品对象
   * @returns 验证结果，true表示配置有效
   */
  validateProductRules(product: Product): boolean;
}

