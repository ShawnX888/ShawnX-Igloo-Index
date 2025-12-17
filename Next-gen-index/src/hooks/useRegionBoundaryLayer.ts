/**
 * 区域边界图层Hook
 * 使用Google Maps Data Layer加载和显示行政区域边界
 */

import { useEffect, useRef } from 'react';
import { Region, AdministrativeRegion, LatLngLiteral } from '../types';
import { getDistrictsInProvince, getAdministrativeRegion } from '../lib/regionData';

/**
 * GeoJSON Feature格式
 */
interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    country: string;
    province: string;
    district: string;
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
 * 区域边界图层配置
 */
interface RegionBoundaryLayerConfig {
  /** 地图实例 */
  map: google.maps.Map | null;
  /** 当前选中的区域 */
  selectedRegion: Region;
  /** 当前区域所属的省/州下的所有市/区 */
  districts: string[];
  /** 区域所属的国家 */
  country: string;
  /** 区域所属的省/州 */
  province: string;
  /** 区域选择回调函数 */
  onRegionSelect?: (region: Region) => void;
}

/**
 * 将LatLngLiteral数组转换为GeoJSON坐标格式
 */
function convertBoundaryToGeoJSONCoordinates(
  boundary: LatLngLiteral[]
): number[][] {
  return boundary.map((point) => [point.lng, point.lat]);
}

/**
 * 将区域边界数据转换为GeoJSON格式
 */
async function convertRegionsToGeoJSON(
  country: string,
  province: string,
  districts: string[]
): Promise<GeoJSON> {
  const features: GeoJSONFeature[] = [];

  // 限定范围：只加载指定省/州下的所有市/区的边界数据
  // districts 参数应该已经通过 getDistrictsInProvince 过滤，只包含同一省/州下的市/区
  console.log(`Loading boundaries for ${districts.length} districts in ${province}, ${country}`);

  // 为每个市/区创建Feature（仅限当前省/州）
  for (const district of districts) {
    const region: Region = { country, province, district };
    const adminRegion = await getAdministrativeRegion(region);

    // 双重验证：确保区域属于指定的省/州（防止数据错误）
    if (adminRegion.province !== province || adminRegion.country !== country) {
      console.warn(`Skipping ${district}: province/country mismatch (expected ${province}, ${country}, got ${adminRegion.province}, ${adminRegion.country})`);
      continue;
    }

    if (adminRegion.boundary && adminRegion.boundary.length > 0) {
      const coordinates = convertBoundaryToGeoJSONCoordinates(adminRegion.boundary);
      // 闭合多边形（确保第一个点和最后一个点相同）
      if (coordinates.length > 0) {
        const firstPoint = coordinates[0];
        const lastPoint = coordinates[coordinates.length - 1];
        if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
          coordinates.push([firstPoint[0], firstPoint[1]]);
        }
      }

      features.push({
        type: 'Feature',
        properties: {
          country: adminRegion.country,
          province: adminRegion.province,
          district: adminRegion.district,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      });
    }
  }

  console.log(`Loaded ${features.length} boundary features for ${province}, ${country}`);
  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * 区域边界图层Hook
 */
export function useRegionBoundaryLayer({
  map,
  selectedRegion,
  districts,
  country,
  province,
  onRegionSelect,
}: RegionBoundaryLayerConfig) {
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const isInitializedRef = useRef(false);

  // 初始化数据图层
  useEffect(() => {
    if (!map) {
      return;
    }

    // 检查Google Maps API是否已加载
    if (!window.google?.maps?.Data) {
      console.warn('Google Maps Data API not loaded yet');
      return;
    }

    // 如果已经初始化，先清理
    if (dataLayerRef.current) {
      dataLayerRef.current.setMap(null);
      dataLayerRef.current = null;
    }

    // 创建新的Data Layer
    const dataLayer = new google.maps.Data();
    dataLayerRef.current = dataLayer;

    // 加载区域边界数据
    const loadBoundaries = async () => {
      try {
        // 转换为GeoJSON格式
        const geoJSON = await convertRegionsToGeoJSON(country, province, districts);

        if (geoJSON.features.length === 0) {
          console.warn('No boundary data available for regions');
          return;
        }

        // 加载GeoJSON数据
        // 注意: loadGeoJson 只接受 URL 字符串，addGeoJson 接受 GeoJSON 对象
        // 使用 addGeoJson 直接加载 GeoJSON 对象
        dataLayer.addGeoJson(geoJSON as any, {
          idPropertyName: 'district',
        });

        // 设置默认样式
        dataLayer.setStyle((feature) => {
          const district = feature.getProperty('district');
          const isSelected = selectedRegion.district === district;

          return {
            fillColor: isSelected ? '#E3F2FD' : '#F5F5F5',
            fillOpacity: isSelected ? 0.6 : 0.3,
            strokeColor: isSelected ? '#4285F4' : 'transparent',
            strokeWeight: isSelected ? 3 : 0,
            strokeOpacity: isSelected ? 1 : 0,
          };
        });

        // 添加点击事件
        dataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
          const district = event.feature.getProperty('district');
          const clickedRegion: Region = {
            country: event.feature.getProperty('country'),
            province: event.feature.getProperty('province'),
            district,
          };

          if (onRegionSelect) {
            onRegionSelect(clickedRegion);
          }

          // 可选：自动缩放到该区域
          const geometry = event.feature.getGeometry();
          if (geometry && 'getBounds' in geometry) {
            const bounds = (geometry as google.maps.Data.Polygon).getBounds();
            if (bounds) {
              map.fitBounds(bounds);
            }
          }
        });

        // 设置鼠标悬停样式
        dataLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
          dataLayer.overrideStyle(event.feature, {
            strokeColor: '#4285F4',
            strokeWeight: 2,
            strokeOpacity: 0.8,
          });
        });

        dataLayer.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
          const district = event.feature.getProperty('district');
          const isSelected = selectedRegion.district === district;
          dataLayer.overrideStyle(event.feature, {
            strokeColor: isSelected ? '#4285F4' : 'transparent',
            strokeWeight: isSelected ? 3 : 0,
            strokeOpacity: isSelected ? 1 : 0,
          });
        });

        // 添加到地图
        dataLayer.setMap(map);
        isInitializedRef.current = true;
      } catch (error) {
        console.error('Failed to load region boundaries:', error);
      }
    };

    loadBoundaries();

    // 清理函数
    return () => {
      if (dataLayerRef.current) {
        dataLayerRef.current.setMap(null);
        dataLayerRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [map, country, province, districts.join(','), selectedRegion.district]); // 依赖：地图实例、国家、省/州、市/区列表、选中区域

  // 更新选中区域的样式
  useEffect(() => {
    if (!dataLayerRef.current || !isInitializedRef.current) {
      return;
    }

    // 更新所有区域的样式
    dataLayerRef.current.forEach((feature) => {
      const district = feature.getProperty('district');
      const isSelected = selectedRegion.district === district;

      dataLayerRef.current!.overrideStyle(feature, {
        fillColor: isSelected ? '#E3F2FD' : '#F5F5F5',
        fillOpacity: isSelected ? 0.6 : 0.3,
        strokeColor: isSelected ? '#4285F4' : 'transparent',
        strokeWeight: isSelected ? 3 : 0,
        strokeOpacity: isSelected ? 1 : 0,
      });
    });
  }, [selectedRegion]);

  // 当地图或选中区域变化时，自动定位到选中区域
  useEffect(() => {
    if (!map || !dataLayerRef.current || !isInitializedRef.current) {
      return;
    }

    // 查找选中区域的特征
    dataLayerRef.current.forEach((feature) => {
      const district = feature.getProperty('district');
      if (district === selectedRegion.district) {
        const geometry = feature.getGeometry();
        if (geometry && 'getBounds' in geometry) {
          const bounds = (geometry as google.maps.Data.Polygon).getBounds();
          if (bounds) {
            map.fitBounds(bounds, { padding: 50 });
          }
        }
      }
    });
  }, [map, selectedRegion, isInitializedRef.current]);

  return {
    dataLayer: dataLayerRef.current,
  };
}

