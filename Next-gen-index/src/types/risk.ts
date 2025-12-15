/**
 * 风险相关类型定义
 */

import { Region } from './region';
import { RiskLevel } from './product';

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
  /** 风险级别 */
  level: RiskLevel;
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
    low: number;
    medium: number;
    high: number;
  };
  /** 严重程度（整体评估） */
  severity: RiskLevel | 'none';
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
  /** 风险级别 */
  riskLevel: RiskLevel;
  /** 事件数量 */
  events: number;
}

