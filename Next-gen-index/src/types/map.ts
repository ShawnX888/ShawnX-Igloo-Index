/**
 * 地图相关类型定义
 */

import { AdministrativeRegion } from './region';
import { RainfallData } from './data';
import { RiskEvent } from './risk';

/**
 * 地图配置
 */
export interface MapConfig {
  /** 地图中心点 */
  center: {
    lat: number;
    lng: number;
  };
  /** 缩放级别 */
  zoom: number;
  /** 地图样式ID（可选） */
  mapId?: string;
  /** 是否启用地图控件 */
  controls?: boolean;
}

/**
 * 图层类型
 */
export type LayerType = 
  | 'historical-rainfall' 
  | 'predicted-rainfall' 
  | 'historical-risk' 
  | 'predicted-risk';

/**
 * 图层配置
 */
export interface LayerConfig {
  /** 图层类型 */
  type: LayerType;
  /** 是否可见 */
  visible: boolean;
  /** 图层透明度（0-1） */
  opacity?: number;
}

/**
 * 热力图数据
 */
export interface HeatmapData {
  /** 区域信息 */
  region: AdministrativeRegion;
  /** 降雨量数据 */
  rainfall: number;
  /** 数据类型 */
  type: 'historical' | 'predicted';
}

/**
 * 风险标记数据
 */
export interface RiskMarkerData {
  /** 区域中心点 */
  center: {
    lat: number;
    lng: number;
  };
  /** 风险事件列表 */
  events: RiskEvent[];
  /** 事件总数 */
  totalEvents: number;
  /** 数据类型 */
  type: 'historical' | 'predicted';
}

