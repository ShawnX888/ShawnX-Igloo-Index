/**
 * 产品相关类型定义
 */

import { TimeWindowConfig, WeatherType } from './data';

/**
 * 产品类型（时间维度）
 */
export type ProductType = 'daily' | 'weekly' | 'monthly';

/**
 * 风险级别（对应阈值档位）
 * @deprecated 使用 RiskTier ('tier1' | 'tier2' | 'tier3') 替代
 */
export type RiskLevel = 'tier1' | 'tier2' | 'tier3';

/**
 * 阈值配置
 */
export interface Threshold {
  /** 阈值数值 */
  value: number;
  /** 对应的风险级别（tier 1, tier 2, tier 3） */
  level: 'tier1' | 'tier2' | 'tier3';
  /** 阈值标签（可选） */
  label?: string;
}

/**
 * 计算逻辑配置
 */
export interface CalculationConfig {
  /** 累计方式 */
  aggregation: 'sum' | 'average' | 'max' | 'min';
  /** 比较运算符 */
  operator: '>' | '<' | '>=' | '<=' | '==';
  /** 数据单位（根据天气类型不同） */
  unit: 'mm' | 'inch' | 'celsius' | 'fahrenheit' | 'kmh' | 'mph' | 'percent' | 'hpa' | 'psi';
}

/**
 * 风险事件触发规则
 */
export interface RiskRule {
  /** 触发类型（时间维度） */
  triggerType: ProductType;
  /** 天气类型（数据维度） */
  weatherType: WeatherType;
  /** 时间窗口配置 */
  timeWindow: TimeWindowConfig;
  /** 阈值配置数组（多档阈值） */
  thresholds: Threshold[];
  /** 计算逻辑配置 */
  calculation: CalculationConfig;
}

/**
 * 保单级的赔付原则（仅用于教育展示，不参与计算）
 */
export interface PayoutRule {
  /** 赔付频率限制（仅用于教育展示） */
  frequencyLimit?: string; // 如 "once per day per policy", "once per month per policy"
  
  /** 理赔额度百分比（仅用于教育展示，前端展示百分比数值）
   * tier 1: 20%, tier 2: 50%, tier 3: 100%
   */
  payoutPercentages: {
    tier1: number; // 20
    tier2: number; // 50
    tier3: number; // 100
  };
}

/**
 * 保险产品
 */
export interface Product {
  /** 产品唯一标识 */
  id: string;
  /** 产品名称 */
  name: string;
  /** 产品类型（时间维度：daily/weekly/monthly） */
  type: ProductType;
  /** 天气类型（数据维度：rainfall/temperature/wind等） */
  weatherType: WeatherType;
  /** 产品描述 */
  description: string;
  /** 产品图标 */
  icon: string;
  /** 产品级的风险事件触发规则（用于计算） */
  riskRules: RiskRule;
  /** 保单级的赔付原则（可选，仅用于教育展示，不参与计算） */
  payoutRules?: PayoutRule;
}

/**
 * 产品库配置
 */
export interface ProductLibraryConfig {
  /** 产品列表 */
  products: Product[];
  /** 产品版本（可选） */
  version?: string;
}

