/**
 * 降雨量热力图图层Hook
 * 使用Google Maps Data Layer显示降雨量数据的半透明纯色高亮效果
 */

import { useEffect, useRef } from 'react';
import { Region, DataType, LatLngLiteral, RegionWeatherData } from '../types';
import { getAdministrativeRegion, googleToGadmName } from '../lib/regionData';
import { getMapModeStyles } from '../config/mapModeStyles';

/**
 * GeoJSON Feature格式
 */
interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    country: string;
    province: string;
    district: string;
    rainfall: number; // 降雨量累计值
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

/**
 * GeoJSON格式
 */
interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * 热力图图层配置
 */
interface RainfallHeatmapLayerConfig {
  /** 地图实例 */
  map: google.maps.Map | null;
  /** 当前区域所属的省/州下的所有市/区 */
  districts: string[];
  /** 区域所属的国家 */
  country: string;
  /** 区域所属的省/州 */
  province: string;
  /** 降雨量数据 */
  rainfallData: RegionWeatherData;
  /** 数据类型（历史/预测） */
  dataType: DataType;
  /** 图层是否可见 */
  visible: boolean;
  /** 地图模式：'2d' 或 '3d' */
  mapMode?: '2d' | '3d';
}

/**
 * 颜色配置
 */
const HEATMAP_COLORS = {
  historical: '#4285F4', // 蓝色系
  predicted: '#9333EA',  // 紫色系
};

/**
 * 计算降雨量累计值
 * 使用 WeatherData 格式（value 字段）
 */
function calculateTotalRainfall(data: { value: number }[]): number {
  if (!data || data.length === 0) return 0;
  return data.reduce((sum, item) => sum + item.value, 0);
}

/**
 * 根据降雨量计算透明度
 * 降雨量越大，透明度越高
 * @param rainfall 当前降雨量
 * @param maxRainfall 最大降雨量
 * @param opacityRange 透明度范围 { min, max }
 */
function calculateOpacity(
  rainfall: number, 
  maxRainfall: number, 
  opacityRange: { min: number; max: number }
): number {
  const intensity = Math.min(rainfall / maxRainfall, 1);
  return opacityRange.min + (opacityRange.max - opacityRange.min) * intensity;
}

/**
 * 将LatLngLiteral数组转换为GeoJSON坐标格式
 */
function convertBoundaryToGeoJSONCoordinates(boundary: LatLngLiteral[]): number[][] {
  return boundary.map((point) => [point.lng, point.lat]);
}

/**
 * 将区域边界数据和降雨量数据转换为GeoJSON格式
 */
async function convertRegionsToGeoJSON(
  country: string,
  province: string,
  districts: string[],
  rainfallData: RegionWeatherData
): Promise<GeoJSON> {
  const features: GeoJSONFeature[] = [];

  const gadmProvince = googleToGadmName(province);

  for (const district of districts) {
    const gadmDistrict = googleToGadmName(district);
    const region: Region = { country, province: gadmProvince, district: gadmDistrict };
    const adminRegion = await getAdministrativeRegion(region);

    if (adminRegion.boundary && adminRegion.boundary.length > 0) {
      const coordinates = convertBoundaryToGeoJSONCoordinates(adminRegion.boundary);
      
      // 闭合多边形
      if (coordinates.length > 0) {
        const firstPoint = coordinates[0];
        const lastPoint = coordinates[coordinates.length - 1];
        if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
          coordinates.push([firstPoint[0], firstPoint[1]]);
        }
      }

      // 获取该区域的降雨量数据（使用Google名称查找）
      const districtData = rainfallData[district] || [];
      const totalRainfall = calculateTotalRainfall(districtData);

      features.push({
        type: 'Feature',
        properties: {
          country: adminRegion.country,
          province: province,
          district: district,
          rainfall: totalRainfall,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * 降雨量热力图图层Hook
 */
export function useRainfallHeatmapLayer({
  map,
  districts,
  country,
  province,
  rainfallData,
  dataType,
  visible,
  mapMode = '2d',
}: RainfallHeatmapLayerConfig) {
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const isInitializedRef = useRef(false);

  // 初始化或更新数据图层
  useEffect(() => {
    if (!map || !visible) {
      // 不可见时移除图层
      if (dataLayerRef.current) {
        dataLayerRef.current.setMap(null);
      }
      return;
    }

    // 检查Google Maps API是否已加载
    if (!window.google?.maps?.Data) {
      console.warn('Google Maps Data API not loaded yet');
      return;
    }

    // 如果已经存在图层，先清理
    if (dataLayerRef.current) {
      dataLayerRef.current.setMap(null);
      dataLayerRef.current = null;
    }

    // 创建新的Data Layer
    const dataLayer = new google.maps.Data();
    dataLayerRef.current = dataLayer;

    // 加载区域边界和降雨量数据
    const loadHeatmap = async () => {
      try {
        console.log('[RainfallHeatmap] Loading heatmap for', { country, province, districtsCount: districts.length });
        console.log('[RainfallHeatmap] Rainfall data keys:', Object.keys(rainfallData));
        
        const geoJSON = await convertRegionsToGeoJSON(
          country,
          province,
          districts,
          rainfallData
        );

        if (geoJSON.features.length === 0) {
          console.warn('[RainfallHeatmap] No heatmap data available');
          return;
        }
        
        console.log('[RainfallHeatmap] Loaded features:', geoJSON.features.length, 'with rainfall values:', geoJSON.features.map(f => ({ district: f.properties.district, rainfall: f.properties.rainfall })));

        // 计算所有区域的最大降雨量（用于归一化）
        const maxRainfall = Math.max(
          ...geoJSON.features.map((f) => f.properties.rainfall),
          1 // 避免除以0
        );

        // 加载GeoJSON数据
        dataLayer.addGeoJson(geoJSON as any, {
          idPropertyName: 'district',
        });

        // 从样式配置读取热力图图层样式
        const styles = getMapModeStyles(mapMode);
        const heatmapStyles = styles.heatmap;
        const fillColor = HEATMAP_COLORS[dataType];
        
        dataLayer.setStyle((feature) => {
          const rainfall = feature.getProperty('rainfall') as number;
          const opacity = calculateOpacity(rainfall, maxRainfall, heatmapStyles.fillOpacity);

          return {
            fillColor,
            fillOpacity: opacity,
            strokeColor: fillColor,
            strokeWeight: heatmapStyles.strokeWeight,
            strokeOpacity: heatmapStyles.strokeOpacity,
            clickable: false, // 关键：禁用点击，防止拦截底层图层的点击事件
          };
        });

        // 添加到地图
        dataLayer.setMap(map);
        isInitializedRef.current = true;
      } catch (error) {
        console.error('Failed to load rainfall heatmap:', error);
      }
    };

    loadHeatmap();

    // 清理函数
    return () => {
      if (dataLayerRef.current) {
        dataLayerRef.current.setMap(null);
        dataLayerRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [map, country, province, districts.join(','), rainfallData, dataType, visible, mapMode]);

  return {
    dataLayer: dataLayerRef.current,
  };
}

