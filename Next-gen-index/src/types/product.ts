/**
 * 产品相关类型定义
 */

import { TimeWindowConfig } from './data';

/**
 * 产品类型
 */
export type ProductType = 'daily' | 'weekly' | 'monthly';

/**
 * 风险级别
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * 阈值配置
 */
export interface Threshold {
  /** 阈值数值 */
  value: number;
  /** 对应的风险级别 */
  level: RiskLevel;
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
  /** 数据单位 */
  unit: 'mm' | 'inch';
}

/**
 * 风险事件触发规则
 */
export interface RiskRule {
  /** 触发类型 */
  triggerType: ProductType;
  /** 时间窗口配置 */
  timeWindow: TimeWindowConfig;
  /** 阈值配置数组（多档阈值） */
  thresholds: Threshold[];
  /** 计算逻辑配置 */
  calculation: CalculationConfig;
}

/**
 * 保险产品
 */
export interface Product {
  /** 产品唯一标识 */
  id: string;
  /** 产品名称 */
  name: string;
  /** 产品类型 */
  type: ProductType;
  /** 产品描述 */
  description: string;
  /** 产品图标 */
  icon: string;
  /** 风险事件触发规则 */
  riskRules: RiskRule;
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

