/**
 * 风险计算服务实现
 * 实现产品库与风险计算引擎的协同机制
 * 仅涉及产品级的风险事件触发条件计算，不涉及保单级的赔付计算
 */

import {
  Region,
  DateRange,
  WeatherData,
  RiskEvent,
  RiskStatistics,
} from '../types';
import { RiskCalculationService as IRiskCalculationService } from '../interfaces/riskCalculationService';
import { ProductLibrary } from '../interfaces/productLibrary';
import { RiskCalculationEngine } from '../interfaces/riskCalculation';
import { createRiskCalculationEngine } from './riskCalculationEngine';

/**
 * 风险计算服务实现类
 */
export class RiskCalculationServiceImpl implements IRiskCalculationService {
  private productLibrary: ProductLibrary;
  private calculationEngine: RiskCalculationEngine;

  constructor(productLibrary: ProductLibrary, calculationEngine?: RiskCalculationEngine) {
    this.productLibrary = productLibrary;
    // 如果没有提供计算引擎，则创建一个新的实例
    this.calculationEngine = calculationEngine || createRiskCalculationEngine(productLibrary);
  }

  /**
   * 计算风险事件
   */
  calculateRiskEvents(
    productId: string,
    region: Region,
    dateRange: DateRange,
    weatherData: WeatherData[]
  ): RiskEvent[] {
    // 1. 从产品库获取产品定义
    const product = this.productLibrary.getProduct(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // 2. 验证产品规则配置
    if (!this.calculationEngine.validateProductRules(product)) {
      throw new Error(`Invalid product rules for product: ${productId}`);
    }

    // 3. 传递给计算引擎进行计算
    try {
      const events = this.calculationEngine.calculateRiskEvents(
        product,
        region,
        dateRange,
        weatherData
      );

      // 4. 返回计算结果
      // 注意：返回的 RiskEvent 包含以下字段：
      // - dataType: 'historical' | 'predicted' - 标识数据类型
      // - weatherType: WeatherType - 标识对应的天气类型（如 'rainfall'），对应产品的weatherType字段
      // - level: 'tier1' | 'tier2' | 'tier3' - 对应阈值档位
      // - productId: string - 关联的产品ID
      // - region: Region - 区域信息
      // - timestamp: Date - 时间戳
      // - value: number - 触发值
      return events;
    } catch (error) {
      throw new Error(
        `Failed to calculate risk events for product ${productId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 计算风险统计信息
   */
  calculateRiskStatistics(
    productId: string,
    region: Region,
    dateRange: DateRange,
    weatherData: WeatherData[]
  ): RiskStatistics {
    try {
      // 1. 计算风险事件
      const events = this.calculateRiskEvents(productId, region, dateRange, weatherData);

      // 2. 计算统计信息
      const statistics = this.calculationEngine.calculateRiskStatistics(events);
      return statistics;
    } catch (error) {
      // 提供一致的错误处理，包含步骤信息
      // 无论错误来自步骤1（计算风险事件）还是步骤2（计算统计信息），都提供统一的错误上下文
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to calculate risk statistics for product ${productId}: ${errorMessage}`
      );
    }
  }

  /**
   * 批量计算多个产品的风险事件
   */
  calculateMultipleProducts(
    productIds: string[],
    region: Region,
    dateRange: DateRange,
    weatherData: WeatherData[]
  ): Map<string, RiskEvent[]> {
    const results = new Map<string, RiskEvent[]>();

    for (const productId of productIds) {
      try {
        const events = this.calculateRiskEvents(productId, region, dateRange, weatherData);
        results.set(productId, events);
      } catch (error) {
        // 记录错误但继续处理其他产品
        console.warn(
          `Failed to calculate risk events for product ${productId}:`,
          error instanceof Error ? error.message : String(error)
        );
        results.set(productId, []);
      }
    }

    return results;
  }

  /**
   * 验证产品是否存在
   */
  hasProduct(productId: string): boolean {
    return this.productLibrary.hasProduct(productId);
  }
}

/**
 * 创建风险计算服务实例
 */
export function createRiskCalculationService(
  productLibrary: ProductLibrary,
  calculationEngine?: RiskCalculationEngine
): IRiskCalculationService {
  return new RiskCalculationServiceImpl(productLibrary, calculationEngine);
}

// 导出类型
export type { RiskCalculationService } from '../interfaces/riskCalculationService';

