/**
 * 地图服务接口定义
 */

import { MapConfig, LayerConfig, HeatmapData, RiskMarkerData, AdministrativeRegion } from '../types';

/**
 * 地图服务接口
 */
export interface MapService {
  /**
   * 初始化地图
   * @param containerId 容器元素ID
   * @param config 地图配置
   * @returns 是否初始化成功
   */
  initialize(containerId: string, config: MapConfig): Promise<boolean>;

  /**
   * 更新地图中心点和缩放级别
   * @param center 中心点坐标
   * @param zoom 缩放级别
   */
  updateView(center: { lat: number; lng: number }, zoom?: number): void;

  /**
   * 设置图层可见性
   * @param layerType 图层类型
   * @param visible 是否可见
   */
  setLayerVisibility(layerType: string, visible: boolean): void;

  /**
   * 更新热力图数据
   * @param data 热力图数据数组
   * @param layerType 图层类型
   */
  updateHeatmapData(data: HeatmapData[], layerType: 'historical' | 'predicted'): void;

  /**
   * 更新风险标记数据
   * @param data 风险标记数据数组
   * @param layerType 图层类型
   */
  updateRiskMarkers(data: RiskMarkerData[], layerType: 'historical' | 'predicted'): void;

  /**
   * 绘制行政区域边界
   * @param regions 行政区域列表
   */
  drawAdministrativeBoundaries(regions: AdministrativeRegion[]): void;

  /**
   * 清除所有图层
   */
  clearAllLayers(): void;

  /**
   * 销毁地图实例
   */
  destroy(): void;
}

