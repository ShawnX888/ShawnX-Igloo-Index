/**
 * 区域相关类型定义
 */

/**
 * 基础区域信息
 */
export interface Region {
  country: string;
  province: string;
  district: string;
}

/**
 * 行政区域信息（包含地理信息）
 */
export interface AdministrativeRegion extends Region {
  /** 区域中心点坐标 */
  center: {
    lat: number;
    lng: number;
  };
  /** 区域边界坐标（GeoJSON格式） */
  boundary: LatLngLiteral[];
}

/**
 * 经纬度坐标
 */
export interface LatLngLiteral {
  lat: number;
  lng: number;
}

/**
 * 区域搜索选项
 */
export interface RegionSearchOptions {
  /** 搜索关键词 */
  query?: string;
  /** 国家过滤 */
  country?: string;
  /** 省/州过滤 */
  province?: string;
}

