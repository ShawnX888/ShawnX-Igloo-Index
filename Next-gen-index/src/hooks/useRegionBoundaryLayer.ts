/**
 * 区域边界图层Hook
 * 使用Google Maps Data Layer加载和显示行政区域边界
 */

import { useEffect, useRef } from 'react';
import { Region, AdministrativeRegion, LatLngLiteral } from '../types';
import { getDistrictsInProvince, getAdministrativeRegion, googleToGadmName, gadmToGoogleName } from '../lib/regionData';

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
 * 
 * 注意：传入的 province 和 districts 可能是 Google 名称，
 * 需要先转换为 GADM 名称再查询边界数据
 */
async function convertRegionsToGeoJSON(
  country: string,
  province: string,
  districts: string[]
): Promise<GeoJSON> {
  const features: GeoJSONFeature[] = [];

  // 将 Google 名称转换为 GADM 名称
  const gadmProvince = googleToGadmName(province);
  
  console.log(`Loading boundaries for ${districts.length} districts in ${province} (GADM: ${gadmProvince}), ${country}`);

  // 为每个市/区创建Feature
  for (const district of districts) {
    // 将 Google 区名转换为 GADM 区名
    const gadmDistrict = googleToGadmName(district);
    
    // 使用 GADM 名称查询边界数据
    const region: Region = { country, province: gadmProvince, district: gadmDistrict };
    const adminRegion = await getAdministrativeRegion(region);

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
          // 保留原始 Google 名称用于 UI 显示
          country: adminRegion.country,
          province: province, // 使用 Google 名称
          district: district, // 使用 Google 名称
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      });
    } else {
      console.warn(`No boundary data for ${district} (GADM: ${gadmDistrict})`);
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
        dataLayer.addGeoJson(geoJSON as any, {
          idPropertyName: 'district',
        });

        // 设置默认样式
        dataLayer.setStyle((feature) => {
          const featureDistrict = feature.getProperty('district');
          // 支持 Google 名称和 GADM 名称的匹配
          const gadmSelectedDistrict = googleToGadmName(selectedRegion.district);
          const isSelected = featureDistrict === selectedRegion.district || 
                            featureDistrict === gadmSelectedDistrict;

          return {
            fillColor: isSelected ? '#E3F2FD' : '#F5F5F5',
            fillOpacity: isSelected ? 0.6 : 0.2,
            strokeColor: isSelected ? '#4285F4' : '#999999',
            strokeWeight: isSelected ? 3 : 1,
            strokeOpacity: isSelected ? 1 : 0.5,
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

