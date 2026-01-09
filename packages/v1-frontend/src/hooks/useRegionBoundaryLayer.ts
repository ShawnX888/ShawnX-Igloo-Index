/**
 * 区域边界图层Hook
 * 使用Google Maps Data Layer加载和显示行政区域边界
 */

import { useEffect, useRef } from 'react';
import { Region, LatLngLiteral } from '../types';
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
  /** 热力图图层是否可见（影响填充样式） */
  heatmapVisible?: boolean;
  /** 地图模式：'2d' 或 '3d' */
  mapMode?: '2d' | '3d';
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
  heatmapVisible = false,
  mapMode = '2d',
}: RegionBoundaryLayerConfig) {
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const isInitializedRef = useRef(false);
  const pulseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pulseStateRef = useRef(0); // 0-3 脉动状态
  // 使用 ref 存储最新的 selectedRegion、heatmapVisible 和 mapMode，供事件处理器访问
  const selectedRegionRef = useRef<Region>(selectedRegion);
  const heatmapVisibleRef = useRef<boolean>(heatmapVisible);
  const mapModeRef = useRef<'2d' | '3d'>(mapMode);

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

        // 从样式配置读取边界图层样式
        const styles = getMapModeStyles(mapMode);
        const boundaryStyles = styles.boundary;

        // 设置默认样式（从配置读取）
        dataLayer.setStyle((feature) => {
          return {
            fillColor: 'transparent',
            fillOpacity: 0,
            strokeColor: boundaryStyles.strokeColor,
            strokeWeight: boundaryStyles.strokeWeight,
            strokeOpacity: boundaryStyles.strokeOpacity,
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

        // 设置鼠标悬停样式（从配置读取）
        dataLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
          const currentStyles = getMapModeStyles(mapModeRef.current);
          dataLayer.overrideStyle(event.feature, {
            strokeColor: '#4285F4',
            strokeWeight: currentStyles.boundary.selectedStrokeWeight,
            strokeOpacity: currentStyles.boundary.selectedStrokeOpacity,
          });
        });

        dataLayer.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
          // 使用 ref 获取最新的 selectedRegion、heatmapVisible 和 mapMode，避免闭包问题
          const currentSelectedRegion = selectedRegionRef.current;
          const currentHeatmapVisible = heatmapVisibleRef.current;
          const currentMapMode = mapModeRef.current;
          
          // 从样式配置读取样式
          const currentStyles = getMapModeStyles(currentMapMode);
          const boundaryStyles = currentStyles.boundary;
          
          // 清除悬停样式，恢复到由 useEffect 管理的默认样式
          const district = event.feature.getProperty('district');
          const gadmSelectedDistrict = googleToGadmName(currentSelectedRegion.district);
          const isSelected = district === currentSelectedRegion.district || district === gadmSelectedDistrict;
          
          // 填充颜色和透明度
          let fillColor = 'transparent';
          let fillOpacity = 0;
          if (isSelected && !currentHeatmapVisible) {
            fillColor = boundaryStyles.selectedFillColor;
            fillOpacity = boundaryStyles.selectedFillOpacity;
          }

          dataLayer.overrideStyle(event.feature, {
            fillColor,
            fillOpacity,
            strokeColor: isSelected ? '#4285F4' : boundaryStyles.strokeColor,
            strokeWeight: isSelected ? boundaryStyles.selectedStrokeWeight : boundaryStyles.strokeWeight,
            strokeOpacity: isSelected ? boundaryStyles.selectedStrokeOpacity : boundaryStyles.strokeOpacity,
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
  }, [map, country, province, districts.join(','), mapMode]); // 添加 mapMode 依赖，当模式切换时重新加载样式

  // 更新 ref 中的最新值
  useEffect(() => {
    selectedRegionRef.current = selectedRegion;
  }, [selectedRegion]);

  useEffect(() => {
    heatmapVisibleRef.current = heatmapVisible;
  }, [heatmapVisible]);

  useEffect(() => {
    mapModeRef.current = mapMode;
  }, [mapMode]);

  // 更新选中区域的样式（监听 mapMode 变化）
  useEffect(() => {
    if (!dataLayerRef.current || !isInitializedRef.current) {
      return;
    }

    // 从样式配置读取边界图层样式
    const styles = getMapModeStyles(mapMode);
    const boundaryStyles = styles.boundary;

    // 更新所有区域的样式
    dataLayerRef.current.forEach((feature) => {
      const district = feature.getProperty('district');
      const gadmSelectedDistrict = googleToGadmName(selectedRegion.district);
      const isSelected = district === selectedRegion.district || district === gadmSelectedDistrict;

      // 填充颜色和透明度
      let fillColor = 'transparent';
      let fillOpacity = 0;
      if (isSelected && !heatmapVisible) {
        fillColor = boundaryStyles.selectedFillColor;
        fillOpacity = boundaryStyles.selectedFillOpacity;
      }

      dataLayerRef.current!.overrideStyle(feature, {
        fillColor,
        fillOpacity,
        strokeColor: isSelected ? '#4285F4' : boundaryStyles.strokeColor,
        strokeWeight: isSelected ? boundaryStyles.selectedStrokeWeight : boundaryStyles.strokeWeight,
        strokeOpacity: isSelected ? boundaryStyles.selectedStrokeOpacity : boundaryStyles.strokeOpacity,
      });
    });
  }, [selectedRegion, heatmapVisible, mapMode]);

  // 选中区域边框脉动动画（仅在热力图可见时激活）
  useEffect(() => {
    // 清除之前的动画
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = null;
    }

    if (!heatmapVisible) {
      return;
    }

    // 延迟启动动画，确保 dataLayer 已初始化
    const startPulse = () => {
      if (!dataLayerRef.current) {
        return;
      }

      // 脉动动画：边框颜色在橙色系中渐变 + 宽度变化（与蓝色热力图形成对比）
      const pulseStyles = [
        { color: '#E65100', weight: 3 },   // 深橙
        { color: '#F57C00', weight: 4 },
        { color: '#FF9800', weight: 5 },   // 亮橙
        { color: '#FFB74D', weight: 5 },   // 更亮
        { color: '#FF9800', weight: 4 },
        { color: '#F57C00', weight: 3 },
      ];
      
      pulseIntervalRef.current = setInterval(() => {
        if (!dataLayerRef.current) return;
        
        pulseStateRef.current = (pulseStateRef.current + 1) % pulseStyles.length;
        const { color, weight } = pulseStyles[pulseStateRef.current];

        dataLayerRef.current.forEach((feature) => {
          const district = feature.getProperty('district');
          const gadmSelectedDistrict = googleToGadmName(selectedRegion.district);
          const isSelected = district === selectedRegion.district || district === gadmSelectedDistrict;

          if (isSelected) {
            dataLayerRef.current!.overrideStyle(feature, {
              strokeColor: color,
              strokeWeight: weight,
            });
          }
        });
      }, 300); // 每300ms更新一次
    };

    // 延迟100ms启动，确保图层已加载
    const delayTimer = setTimeout(startPulse, 100);

    return () => {
      clearTimeout(delayTimer);
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
      }
    };
  }, [selectedRegion.district, heatmapVisible, country, province]);

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

