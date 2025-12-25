/**
 * 地图模式样式配置
 * 统一管理不同 mapMode 下的样式，便于后续调优和维护
 */

/**
 * 边界图层样式配置
 */
export interface BoundaryLayerStyles {
  strokeWeight: number;
  strokeOpacity: number;
  fillOpacity: number;
  strokeColor: string;
  selectedStrokeWeight: number;
  selectedStrokeOpacity: number;
  selectedFillOpacity: number;
  selectedFillColor: string;
}

/**
 * 热力图图层样式配置
 */
export interface HeatmapLayerStyles {
  fillOpacity: { min: number; max: number };
  strokeWeight: number;
  strokeOpacity: number;
}

/**
 * 标记图层样式配置
 */
export interface MarkerLayerStyles {
  sizeMultiplier: number;
  shadow: 'light' | 'enhanced' | 'strong';
  opacity: { min: number; max: number };
}

/**
 * Vector Map + 3D Buildings 地图配置样式（第一阶段）
 */
export interface Vector3DMapConfigStyles {
  zoom: number;        // 必须 >= 17
  tilt: number;        // 必须设置 (45-67.5)
  heading: number;     // 0-360
  rotateControl: boolean;
}

/**
 * 2D 地图配置样式
 */
export interface Map2DConfigStyles {
  zoom: number;
  tilt: number;
  heading: number;
  rotateControl: boolean;
}

/**
 * 地图配置样式联合类型
 */
export type MapConfigStyles = Vector3DMapConfigStyles | Map2DConfigStyles;

/**
 * 地图模式样式配置
 */
export interface MapModeStyles {
  boundary: BoundaryLayerStyles;
  heatmap: HeatmapLayerStyles;
  markers: MarkerLayerStyles;
  map: MapConfigStyles;
}

/**
 * 地图模式样式配置对象
 * 第一阶段：2D 和 Vector Map + 3D Buildings
 */
export const mapModeStyles: Record<'2d' | '3d', MapModeStyles> = {
  '2d': {
    boundary: {
      strokeWeight: 1,
      strokeOpacity: 0.4,
      fillOpacity: 0.6,
      strokeColor: '#C0C0C0',
      selectedStrokeWeight: 3,
      selectedStrokeOpacity: 1,
      selectedFillOpacity: 0.6,
      selectedFillColor: '#E3F2FD',
    },
    heatmap: {
      fillOpacity: { min: 0.15, max: 0.7 },
      strokeWeight: 0.5,
      strokeOpacity: 0.3,
    },
    markers: {
      sizeMultiplier: 1.0,
      shadow: 'light',
      opacity: { min: 0.4, max: 0.9 },
    },
    map: {
      zoom: 11,
      tilt: 0,
      heading: 0,
      rotateControl: false,
    } as Map2DConfigStyles,
  },
  '3d': {
    // Vector Map + 3D Buildings
    boundary: {
      strokeWeight: 3,
      strokeOpacity: 0.8,
      fillOpacity: 0.7,
      strokeColor: '#C0C0C0',
      selectedStrokeWeight: 4,
      selectedStrokeOpacity: 1,
      selectedFillOpacity: 0.7,
      selectedFillColor: '#E3F2FD',
    },
    heatmap: {
      fillOpacity: { min: 0.2, max: 0.8 },
      strokeWeight: 1,
      strokeOpacity: 0.4,
    },
    markers: {
      sizeMultiplier: 1.2,
      shadow: 'enhanced',
      opacity: { min: 0.5, max: 0.95 },
    },
    map: {
      zoom: 18,        // 必须 >= 17
      tilt: 45,        // 必须设置 (45-67.5)
      heading: 0,      // 0-360
      rotateControl: true,
    } as Vector3DMapConfigStyles,
  },
};

/**
 * 获取指定模式的样式配置
 */
export function getMapModeStyles(mapMode: '2d' | '3d'): MapModeStyles {
  return mapModeStyles[mapMode];
}

/**
 * 检查是否为 Vector 3D 配置
 */
export function isVector3DConfig(config: MapConfigStyles): config is Vector3DMapConfigStyles {
  return 'zoom' in config && config.zoom >= 17;
}

