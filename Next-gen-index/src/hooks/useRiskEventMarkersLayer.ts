/**
 * 风险事件标记图层Hook
 * 使用Google Maps Advanced Markers显示风险事件标记
 */

import { useEffect, useRef, useState } from 'react';
import { Region, DataType, RiskData, InsuranceProduct, AdministrativeRegion } from '../types';
import { getAdministrativeRegion, googleToGadmName } from '../lib/regionData';

/**
 * 风险事件标记图层配置
 */
interface RiskEventMarkersLayerConfig {
  /** 地图实例 */
  map: google.maps.Map | null;
  /** 当前区域所属的省/州下的所有市/区 */
  districts: string[];
  /** 区域所属的国家 */
  country: string;
  /** 区域所属的省/州 */
  province: string;
  /** 风险数据 */
  riskData: RiskData[];
  /** 选中区域 */
  selectedRegion: Region;
  /** 数据类型（历史/预测） */
  dataType: DataType;
  /** 选中产品（仅在选中产品时显示标记） */
  selectedProduct: InsuranceProduct | null;
  /** 图层是否可见 */
  visible: boolean;
}

/**
 * 颜色配置
 */
const MARKER_COLORS = {
  historical: '#ef4444', // 红色系
  predicted: '#f97316',  // 橙色系
};

/**
 * 根据事件数量计算标记大小（15-40px）
 */
function calculateMarkerSize(eventCount: number, maxCount: number): number {
  const minSize = 20;
  const maxSize = 50;
  const normalizedCount = Math.min(eventCount / Math.max(maxCount, 1), 1);
  return minSize + normalizedCount * (maxSize - minSize);
}

/**
 * 根据事件数量计算透明度（0.3-0.8）
 */
function calculateOpacity(eventCount: number, maxCount: number): number {
  const minOpacity = 0.4;
  const maxOpacity = 0.9;
  const normalizedCount = Math.min(eventCount / Math.max(maxCount, 1), 1);
  return minOpacity + normalizedCount * (maxOpacity - minOpacity);
}

/**
 * 创建标记内容元素
 */
function createMarkerContent(
  eventCount: number,
  maxCount: number,
  isSelected: boolean,
  baseColor: string
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'risk-marker-container';
  
  const size = calculateMarkerSize(eventCount, maxCount);
  const opacity = calculateOpacity(eventCount, maxCount);
  
  // 主圆形标记
  const marker = document.createElement('div');
  marker.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background-color: ${baseColor};
    opacity: ${opacity};
    display: flex;
    align-items: center;
    justify-content: center;
    animation: risk-emerge 2.5s ease-out infinite;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: transform 0.2s ease;
  `;
  
  // 如果选中，显示事件数量
  if (isSelected && eventCount > 0) {
    const text = document.createElement('span');
    text.textContent = `${eventCount}`;
    text.style.cssText = `
      color: white;
      font-weight: bold;
      font-size: ${Math.max(12, size / 3)}px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    `;
    marker.appendChild(text);
  }
  
  container.appendChild(marker);
  return container;
}

/**
 * 注入动画CSS（只注入一次）
 */
function injectAnimationCSS() {
  const styleId = 'risk-marker-animation-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes risk-emerge {
      0% {
        transform: scale(0.8);
        opacity: 0.3;
      }
      50% {
        transform: scale(1.1);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        opacity: 0.8;
      }
    }
    .risk-marker-container:hover > div {
      transform: scale(1.2) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 风险事件标记图层Hook
 */
export function useRiskEventMarkersLayer({
  map,
  districts,
  country,
  province,
  riskData,
  selectedRegion,
  dataType,
  selectedProduct,
  visible,
}: RiskEventMarkersLayerConfig) {
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const regionCentersRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const [centersLoaded, setCentersLoaded] = useState(false);

  // 注入动画CSS
  useEffect(() => {
    injectAnimationCSS();
  }, []);

  // 预加载区域中心点
  useEffect(() => {
    const loadCenters = async () => {
      setCentersLoaded(false);
      regionCentersRef.current.clear();
      const gadmProvince = googleToGadmName(province);
      
      for (const district of districts) {
        const gadmDistrict = googleToGadmName(district);
        const region: Region = { country, province: gadmProvince, district: gadmDistrict };
        
        try {
          const adminRegion = await getAdministrativeRegion(region);
          if (adminRegion.center) {
            regionCentersRef.current.set(district, adminRegion.center);
          }
        } catch (error) {
          console.warn(`Failed to load center for ${district}`);
        }
      }
      
      setCentersLoaded(true);
    };

    loadCenters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, province, JSON.stringify(districts)]);

  // 创建/更新标记
  useEffect(() => {
    // 清除旧标记
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];

    // 不可见或无产品时不显示
    if (!map || !visible || !selectedProduct) {
      return;
    }

    // Wait for region centers to load before creating markers
    if (!centersLoaded || regionCentersRef.current.size === 0) {
      return;
    }

    // 检查 AdvancedMarkerElement 是否可用
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) {
      console.warn('AdvancedMarkerElement not available');
      return;
    }

    // 过滤当前数据类型的风险数据
    const filteredRiskData = riskData.filter(d => d.events > 0);
    
    if (filteredRiskData.length === 0) {
      return;
    }

    // 计算最大事件数
    const maxEvents = Math.max(...filteredRiskData.map(d => d.events), 1);
    const baseColor = MARKER_COLORS[dataType];

    // 为每个有风险事件的区域创建标记
    const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

    for (const risk of filteredRiskData) {
      const districtName = risk.region.district;
      const center = regionCentersRef.current.get(districtName);
      
      if (!center) {
        continue;
      }

      const isSelected = selectedRegion.district === districtName;
      const content = createMarkerContent(risk.events, maxEvents, isSelected, baseColor);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: center,
        content,
        title: `${districtName}: ${risk.events} events`,
        gmpClickable: false, // 关键：确保标记不会拦截底层图层的点击事件
      });

      newMarkers.push(marker);
    }

    markersRef.current = newMarkers;
  }, [map, visible, selectedProduct, riskData, selectedRegion, dataType, districts, country, province, centersLoaded]);

  // 清理函数
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
      markersRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, riskData, selectedRegion.district, dataType, selectedProduct, visible, JSON.stringify(districts)]);

  return {
    markers: markersRef.current,
  };
}

