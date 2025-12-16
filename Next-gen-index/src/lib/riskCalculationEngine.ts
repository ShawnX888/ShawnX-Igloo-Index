/**
 * 风险计算引擎实现
 * 实现产品级的风险事件触发条件计算，不涉及保单级的赔付计算
 */

import {
  Product,
  Region,
  DateRange,
  WeatherData,
  RiskEvent,
  RiskStatistics,
  TimeWindowConfig,
  Threshold,
  CalculationConfig,
  ProductType,
  RiskTier,
  DataType,
  WeatherType,
} from '../types';
import { RiskCalculationEngine as IRiskCalculationEngine } from '../interfaces/riskCalculation';
import { ProductLibrary } from '../interfaces/productLibrary';

/**
 * 计算配置（内部使用）
 */
interface InternalCalculationConfig {
  timeWindow: TimeWindowConfig;
  thresholds: Threshold[];
  calculation: CalculationConfig;
  weatherType: string;
  triggerType: ProductType;
}

/**
 * 风险计算引擎实现类
 */
export class RiskCalculationEngineImpl implements IRiskCalculationEngine {
  constructor(_productLibrary: ProductLibrary) {
    // 保留参数以保持接口一致性，未来可能用于动态加载产品规则、产品验证等
  }

  /**
   * 计算风险事件
   */
  calculateRiskEvents(
    product: Product,
    region: Region,
    dateRange: DateRange,
    weatherData: WeatherData[]
  ): RiskEvent[] {
    // 1. 验证产品规则
    if (!this.validateProductRules(product)) {
      console.warn(`Invalid product rules for product: ${product.id}`);
      return [];
    }

    // 2. 解析产品规则
    const config = this.parseRiskRule(product);
    if (!config) {
      console.warn(`Failed to parse risk rule for product: ${product.id}`);
      return [];
    }

    // 3. 过滤和排序天气数据
    const filteredData = this.filterAndSortWeatherData(
      weatherData,
      product.weatherType,
      dateRange
    );

    if (filteredData.length === 0) {
      return [];
    }

    // 4. 确定数据类型（历史或预测）
    const dataType = this.determineDataType(dateRange);

    // 5. 执行计算
    const events = this.calculateEvents(
      config,
      filteredData,
      product,
      region,
      dateRange,
      dataType
    );

    return events;
  }

  /**
   * 计算风险统计信息
   * 支持按级别、数据类型和天气类型的多维度统计
   */
  calculateRiskStatistics(events: RiskEvent[]): RiskStatistics {
    const total = events.length;

    // 按级别统计
    const byLevel = {
      tier1: events.filter((e) => e.level === 'tier1').length,
      tier2: events.filter((e) => e.level === 'tier2').length,
      tier3: events.filter((e) => e.level === 'tier3').length,
    };

    // 按数据类型统计
    const byDataType = {
      historical: events.filter((e) => e.dataType === 'historical').length,
      predicted: events.filter((e) => e.dataType === 'predicted').length,
    };

    // 按天气类型统计（初始化所有天气类型为0）
    const weatherTypes: WeatherType[] = ['rainfall', 'temperature', 'wind', 'humidity', 'pressure', 'snowfall'];
    const byWeatherType: Record<WeatherType, number> = {} as Record<WeatherType, number>;
    for (const wt of weatherTypes) {
      byWeatherType[wt] = events.filter((e) => e.weatherType === wt).length;
    }

    // 按数据类型和级别的组合统计
    const byDataTypeAndLevel = {
      historical: {
        tier1: events.filter((e) => e.dataType === 'historical' && e.level === 'tier1').length,
        tier2: events.filter((e) => e.dataType === 'historical' && e.level === 'tier2').length,
        tier3: events.filter((e) => e.dataType === 'historical' && e.level === 'tier3').length,
      },
      predicted: {
        tier1: events.filter((e) => e.dataType === 'predicted' && e.level === 'tier1').length,
        tier2: events.filter((e) => e.dataType === 'predicted' && e.level === 'tier2').length,
        tier3: events.filter((e) => e.dataType === 'predicted' && e.level === 'tier3').length,
      },
    };

    // 按天气类型和级别的组合统计
    const byWeatherTypeAndLevel: Record<
      WeatherType,
      {
        tier1: number;
        tier2: number;
        tier3: number;
      }
    > = {} as Record<
      WeatherType,
      {
        tier1: number;
        tier2: number;
        tier3: number;
      }
    >;
    for (const wt of weatherTypes) {
      byWeatherTypeAndLevel[wt] = {
        tier1: events.filter((e) => e.weatherType === wt && e.level === 'tier1').length,
        tier2: events.filter((e) => e.weatherType === wt && e.level === 'tier2').length,
        tier3: events.filter((e) => e.weatherType === wt && e.level === 'tier3').length,
      };
    }

    // 按数据类型和天气类型的组合统计
    const byDataTypeAndWeatherType = {
      historical: {} as Record<WeatherType, number>,
      predicted: {} as Record<WeatherType, number>,
    };
    for (const wt of weatherTypes) {
      byDataTypeAndWeatherType.historical[wt] = events.filter(
        (e) => e.dataType === 'historical' && e.weatherType === wt
      ).length;
      byDataTypeAndWeatherType.predicted[wt] = events.filter(
        (e) => e.dataType === 'predicted' && e.weatherType === wt
      ).length;
    }

    // 按数据类型、天气类型和级别的三维组合统计
    const byDataTypeAndWeatherTypeAndLevel = {
      historical: {} as Record<
        WeatherType,
        {
          tier1: number;
          tier2: number;
          tier3: number;
        }
      >,
      predicted: {} as Record<
        WeatherType,
        {
          tier1: number;
          tier2: number;
          tier3: number;
        }
      >,
    };
    for (const wt of weatherTypes) {
      // 历史数据
      byDataTypeAndWeatherTypeAndLevel.historical[wt] = {
        tier1: events.filter(
          (e) => e.dataType === 'historical' && e.weatherType === wt && e.level === 'tier1'
        ).length,
        tier2: events.filter(
          (e) => e.dataType === 'historical' && e.weatherType === wt && e.level === 'tier2'
        ).length,
        tier3: events.filter(
          (e) => e.dataType === 'historical' && e.weatherType === wt && e.level === 'tier3'
        ).length,
      };
      // 预测数据
      byDataTypeAndWeatherTypeAndLevel.predicted[wt] = {
        tier1: events.filter(
          (e) => e.dataType === 'predicted' && e.weatherType === wt && e.level === 'tier1'
        ).length,
        tier2: events.filter(
          (e) => e.dataType === 'predicted' && e.weatherType === wt && e.level === 'tier2'
        ).length,
        tier3: events.filter(
          (e) => e.dataType === 'predicted' && e.weatherType === wt && e.level === 'tier3'
        ).length,
      };
    }

    // 计算严重程度
    let severity: RiskStatistics['severity'] = '-';
    if (total > 0) {
      // 找到最高级别
      const hasTier3 = byLevel.tier3 > 0;
      const hasTier2 = byLevel.tier2 > 0;
      const hasTier1 = byLevel.tier1 > 0;

      if (hasTier3) {
        severity = 'high';
      } else if (hasTier2) {
        severity = 'medium';
      } else if (hasTier1) {
        severity = 'low';
      }
    }

    return {
      total,
      byLevel,
      byDataType,
      byWeatherType,
      byDataTypeAndLevel,
      byWeatherTypeAndLevel,
      byDataTypeAndWeatherType,
      byDataTypeAndWeatherTypeAndLevel,
      severity,
    };
  }

  /**
   * 验证产品规则配置
   */
  validateProductRules(product: Product): boolean {
    if (!product.riskRules) {
      return false;
    }

    const { riskRules } = product;

    // 检查必需字段
    if (
      !riskRules.triggerType ||
      !riskRules.weatherType ||
      !riskRules.timeWindow ||
      !riskRules.thresholds ||
      !riskRules.calculation
    ) {
      return false;
    }

    // 检查阈值配置
    if (!Array.isArray(riskRules.thresholds) || riskRules.thresholds.length === 0) {
      return false;
    }

    // 检查阈值级别
    const validLevels: RiskTier[] = ['tier1', 'tier2', 'tier3'];
    for (const threshold of riskRules.thresholds) {
      if (!validLevels.includes(threshold.level)) {
        return false;
      }
    }

    // 检查时间窗口配置
    if (!riskRules.timeWindow.type || !riskRules.timeWindow.size) {
      return false;
    }

    // 检查计算配置
    if (!riskRules.calculation.aggregation || !riskRules.calculation.operator) {
      return false;
    }

    return true;
  }

  /**
   * 解析产品规则（产品规则解析器）
   */
  private parseRiskRule(product: Product): InternalCalculationConfig | null {
    const { riskRules } = product;

    // 验证规则配置
    if (!this.validateProductRules(product)) {
      return null;
    }

    return {
      timeWindow: riskRules.timeWindow,
      thresholds: riskRules.thresholds,
      calculation: riskRules.calculation,
      weatherType: riskRules.weatherType,
      triggerType: riskRules.triggerType,
    };
  }

  /**
   * 过滤和排序天气数据
   */
  private filterAndSortWeatherData(
    weatherData: WeatherData[],
    weatherType: string,
    dateRange: DateRange
  ): WeatherData[] {
    // 过滤：匹配天气类型和时间范围
    const filtered = weatherData.filter((data) => {
      // 检查天气类型
      if (data.weatherType && data.weatherType !== weatherType) {
        return false;
      }

      // 检查时间范围
      const dataDate = new Date(data.date);
      return dataDate >= dateRange.from && dataDate <= dateRange.to;
    });

    // 排序：按时间升序
    return filtered.sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }

  /**
   * 确定数据类型（历史或预测）
   */
  private determineDataType(dateRange: DateRange): DataType {
    const now = new Date();
    // 如果时间范围的起始时间在未来，则为预测数据
    if (dateRange.from > now) {
      return 'predicted';
    }
    // 否则为历史数据
    return 'historical';
  }

  /**
   * 执行风险事件计算（基础计算逻辑）
   */
  private calculateEvents(
    config: InternalCalculationConfig,
    weatherData: WeatherData[],
    product: Product,
    region: Region,
    _dateRange: DateRange, // 保留参数以保持接口一致性，未来可能使用
    dataType: DataType
  ): RiskEvent[] {
    // 根据产品类型选择计算策略
    switch (config.triggerType) {
      case 'daily':
        return this.calculateDailyEvents(
          config,
          weatherData,
          product,
          region,
          dataType
        );
      case 'weekly':
        return this.calculateWeeklyEvents(
          config,
          weatherData,
          product,
          region,
          dataType
        );
      case 'monthly':
        return this.calculateMonthlyEvents(
          config,
          weatherData,
          product,
          region,
          dataType
        );
      default:
        console.warn(`Unsupported product type: ${config.triggerType}`);
        return [];
    }
  }

  /**
   * 计算日内产品风险事件（4小时滑动窗口）
   */
  private calculateDailyEvents(
    config: InternalCalculationConfig,
    weatherData: WeatherData[],
    product: Product,
    region: Region,
    dataType: DataType
  ): RiskEvent[] {
    const events: RiskEvent[] = [];
    const windowSize = config.timeWindow.size; // 4小时
    const step = config.timeWindow.step || 1; // 每小时滑动一次

    // 按小时分组数据
    const hourlyData = this.groupByHour(weatherData);

    // 获取所有小时点（0-23）
    const hours = Array.from({ length: 24 }, (_, i) => i);

    for (let i = 0; i < hours.length; i += step) {
      const currentHour = hours[i];

      // 计算滑动窗口（包含当前小时和此前连续3小时）
      const windowHours: number[] = [];
      for (let j = 0; j < windowSize; j++) {
        let hour = currentHour - j;
        // 处理跨天情况（时间区间：00:00 to 23:59）
        if (hour < 0) {
          hour = 24 + hour;
        }
        windowHours.push(hour);
      }

      // 获取窗口内的数据
      const windowData: WeatherData[] = [];
      for (const hour of windowHours) {
        const hourData = hourlyData.get(hour) || [];
        windowData.push(...hourData);
      }

      if (windowData.length === 0) {
        continue;
      }

      // 计算累计值
      const aggregatedValue = this.aggregate(windowData, config.calculation.aggregation);

      // 判断是否触发阈值
      const triggeredThreshold = this.checkThreshold(
        aggregatedValue,
        config.thresholds,
        config.calculation.operator
      );

      if (triggeredThreshold) {
        // 创建风险事件
        const event = this.createRiskEvent(
          product,
          region,
          windowData[windowData.length - 1].date, // 使用窗口最后一个数据点的时间
          dataType,
          triggeredThreshold.level,
          aggregatedValue
        );
        events.push(event);
      }
    }

    return events;
  }

  /**
   * 计算周度产品风险事件（7天滑动窗口）
   */
  private calculateWeeklyEvents(
    config: InternalCalculationConfig,
    weatherData: WeatherData[],
    product: Product,
    region: Region,
    dataType: DataType
  ): RiskEvent[] {
    const events: RiskEvent[] = [];
    const windowSize = config.timeWindow.size; // 7天
    const step = config.timeWindow.step || 1; // 每天滑动一次

    // 按天分组数据
    const dailyData = this.groupByDay(weatherData);

    // 获取所有日期
    const dates = Array.from(dailyData.keys()).sort();

    for (let i = 0; i < dates.length; i += step) {
      const currentDate = dates[i];

      // 计算滑动窗口（包含当天和此前连续6天）
      const windowDates: string[] = [];
      const currentDateObj = new Date(currentDate);
      for (let j = 0; j < windowSize; j++) {
        const date = new Date(currentDateObj);
        date.setDate(date.getDate() - j);
        windowDates.push(date.toISOString().split('T')[0]);
      }

      // 获取窗口内的数据
      const windowData: WeatherData[] = [];
      for (const date of windowDates) {
        const dayData = dailyData.get(date) || [];
        windowData.push(...dayData);
      }

      if (windowData.length === 0) {
        continue;
      }

      // 计算累计值
      const aggregatedValue = this.aggregate(windowData, config.calculation.aggregation);

      // 判断是否触发阈值
      const triggeredThreshold = this.checkThreshold(
        aggregatedValue,
        config.thresholds,
        config.calculation.operator
      );

      if (triggeredThreshold) {
        // 创建风险事件
        const event = this.createRiskEvent(
          product,
          region,
          currentDate,
          dataType,
          triggeredThreshold.level,
          aggregatedValue
        );
        events.push(event);
      }
    }

    return events;
  }

  /**
   * 计算月度产品风险事件（完整自然月）
   */
  private calculateMonthlyEvents(
    config: InternalCalculationConfig,
    weatherData: WeatherData[],
    product: Product,
    region: Region,
    dataType: DataType
  ): RiskEvent[] {
    const events: RiskEvent[] = [];

    // 按月份分组数据
    const monthlyData = this.groupByMonth(weatherData);

    for (const [, monthData] of monthlyData.entries()) {
      if (monthData.length === 0) {
        continue;
      }

      // 计算累计值
      const aggregatedValue = this.aggregate(monthData, config.calculation.aggregation);

      // 判断是否触发阈值
      const triggeredThreshold = this.checkThreshold(
        aggregatedValue,
        config.thresholds,
        config.calculation.operator
      );

      if (triggeredThreshold) {
        // 使用月份的最后一天作为时间戳
        const lastDataPoint = monthData[monthData.length - 1];
        const event = this.createRiskEvent(
          product,
          region,
          lastDataPoint.date,
          dataType,
          triggeredThreshold.level,
          aggregatedValue
        );
        events.push(event);
      }
    }

    return events;
  }

  /**
   * 按小时分组数据
   */
  private groupByHour(weatherData: WeatherData[]): Map<number, WeatherData[]> {
    const grouped = new Map<number, WeatherData[]>();

    for (const data of weatherData) {
      const date = new Date(data.date);
      const hour = date.getHours();

      if (!grouped.has(hour)) {
        grouped.set(hour, []);
      }
      grouped.get(hour)!.push(data);
    }

    return grouped;
  }

  /**
   * 按天分组数据
   */
  private groupByDay(weatherData: WeatherData[]): Map<string, WeatherData[]> {
    const grouped = new Map<string, WeatherData[]>();

    for (const data of weatherData) {
      const date = new Date(data.date);
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!grouped.has(dayKey)) {
        grouped.set(dayKey, []);
      }
      grouped.get(dayKey)!.push(data);
    }

    return grouped;
  }

  /**
   * 按月份分组数据
   */
  private groupByMonth(weatherData: WeatherData[]): Map<string, WeatherData[]> {
    const grouped = new Map<string, WeatherData[]>();

    for (const data of weatherData) {
      const date = new Date(data.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(data);
    }

    return grouped;
  }

  /**
   * 数据累计计算
   */
  private aggregate(data: WeatherData[], aggregation: CalculationConfig['aggregation']): number {
    if (data.length === 0) {
      return 0;
    }

    const values = data.map((d) => d.value);

    switch (aggregation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'average':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'max':
        return Math.max(...values);
      case 'min':
        return Math.min(...values);
      default:
        return 0;
    }
  }

  /**
   * 阈值判断逻辑
   * 返回最高级别的触发阈值（tier3 > tier2 > tier1）
   */
  private checkThreshold(
    value: number,
    thresholds: Threshold[],
    operator: CalculationConfig['operator']
  ): Threshold | null {
    // 按级别优先级排序（tier3 > tier2 > tier1）
    const levelPriority: Record<RiskTier, number> = {
      tier3: 3,
      tier2: 2,
      tier1: 1,
    };

    const sortedThresholds = [...thresholds].sort(
      (a, b) => levelPriority[b.level] - levelPriority[a.level]
    );

    // 检查所有阈值，找到最高级别的触发阈值
    for (const threshold of sortedThresholds) {
      let triggered = false;

      switch (operator) {
        case '>':
          triggered = value > threshold.value;
          break;
        case '<':
          triggered = value < threshold.value;
          break;
        case '>=':
          triggered = value >= threshold.value;
          break;
        case '<=':
          triggered = value <= threshold.value;
          break;
        case '==':
          triggered = value === threshold.value;
          break;
      }

      if (triggered) {
        // 返回最高级别的阈值
        return threshold;
      }
    }

    return null;
  }

  /**
   * 创建风险事件
   */
  private createRiskEvent(
    product: Product,
    region: Region,
    timestamp: string | Date,
    dataType: DataType,
    level: RiskTier,
    value: number
  ): RiskEvent {
    const id = `${product.id}-${region.district}-${new Date(timestamp).toISOString()}-${level}`;

    return {
      id,
      productId: product.id,
      region,
      timestamp: new Date(timestamp),
      dataType,
      weatherType: product.weatherType,
      level,
      type: product.type,
      value,
      description: `${product.name} - ${level} risk event`,
    };
  }
}

// 导出单例实例（需要传入ProductLibrary）
export function createRiskCalculationEngine(
  productLibrary: ProductLibrary
): IRiskCalculationEngine {
  return new RiskCalculationEngineImpl(productLibrary);
}

// 导出类型
export type { RiskCalculationEngine } from '../interfaces/riskCalculation';

