/**
 * 风险相关类型定义
 */

import { Region } from './region';
import { WeatherType } from './data';

/**
 * 风险级别（对应阈值档位）
 * tier 1, tier 2, tier 3 分别对应产品配置中的三个阈值档位
 */
export type RiskTier = 'tier1' | 'tier2' | 'tier3';

/**
 * 风险事件
 */
export interface RiskEvent {
  /** 事件唯一标识 */
  id: string;
  /** 关联的产品ID */
  productId: string;
  /** 区域信息 */
  region: Region;
  /** 时间戳 */
  timestamp: Date;
  /** 数据类型：历史或预测 */
  dataType: 'historical' | 'predicted';
  /** 天气类型，对应产品的weatherType字段 */
  weatherType: WeatherType;
  /** 风险级别（对应阈值档位） */
  level: RiskTier;
  /** 事件类型 */
  type: string;
  /** 触发值（如累计降雨量） */
  value: number;
  /** 事件描述（可选） */
  description?: string;
}

/**
 * 风险统计数据
 */
export interface RiskStatistics {
  /** 总事件数 */
  total: number;
  /** 按级别统计 */
  byLevel: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  /** 严重程度（整体评估）
   * 规则：若没有风险事件为"-"，若最高级别为tier 1为低，tier 2为中，tier 3为高
   */
  severity: 'low' | 'medium' | 'high' | 'none' | '-';
}

/**
 * 风险数据（用于地图展示）
 */
export interface RiskData {
  /** 区域标识 */
  id: string;
  /** 区域名称（district） */
  district: string;
  /** 降雨量 */
  rainfall: number;
  /** 风险级别（向后兼容，使用旧的 low/medium/high 格式） */
  riskLevel: 'low' | 'medium' | 'high';
  /** 事件数量 */
  events: number;
}

