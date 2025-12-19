/**
 * 风险分析Hook
 * 中心化处理风险事件计算与统计，作为系统唯一的风险计算入口
 * 实现《风险计算架构升级方案》中的 #2 和 #4 部分
 */

import { useMemo } from 'react';
import { 
  Region, 
  DateRange, 
  DataType, 
  WeatherType, 
  WeatherData, 
  RiskEvent, 
  RiskData, 
  RiskStatistics,
  InsuranceProduct,
  RegionWeatherData
} from '../types';
import { createRiskCalculationService } from '../lib/riskCalculationService';
import { productLibrary } from '../lib/productLibrary';
import { format } from 'date-fns';

// --- #4 缓存与持久化策略 ---
// 历史数据缓存 (Memory Cache)
// 仅针对 dataType === 'historical' 的计算结果进行记忆
// Key 包含产品、区域（省份级别）、天气类型、数据类型、时间范围
const historicalRiskCache = new Map<string, RiskEvent[]>();

/**
 * 清除风险事件缓存
 * @param pattern 可选的匹配模式，如果提供则只清除匹配的缓存项（支持产品ID等）
 */
export function clearRiskCache(pattern?: string): void {
  if (!pattern) {
    historicalRiskCache.clear();
    return;
  }

  // 清除匹配模式的缓存项
  const keysToDelete: string[] = [];
  for (const key of historicalRiskCache.keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => historicalRiskCache.delete(key));
}

/**
 * 风险分析 Hook
 */
export function useRiskAnalysis(
  selectedRegion: Region,
  dateRange: DateRange,
  selectedProduct: InsuranceProduct | null,
  weatherType: WeatherType,
  dataType: DataType,
  allRegionsWeatherData: RegionWeatherData // 包含当前省份所有城市的数据
) {
  // 初始化风险计算服务
  const riskService = useMemo(() => createRiskCalculationService(productLibrary), []);

  // --- 1. 计算原始风险事件列表 ---
  const riskEvents = useMemo(() => {
    if (!selectedProduct || !allRegionsWeatherData || !selectedRegion.district) {
      return [];
    }

    // 尝试从缓存中获取历史数据
    const cacheKey = dataType === 'historical' 
      ? `${selectedProduct.id}-${selectedRegion.country}-${selectedRegion.province}-${weatherType}-${dataType}-${format(dateRange.from, 'yyyyMMdd')}-${format(dateRange.to, 'yyyyMMdd')}`
      : null;

    if (cacheKey && historicalRiskCache.has(cacheKey)) {
      // 返回缓存中当前城市的事件
      return historicalRiskCache.get(cacheKey)!.filter(e => e.region.district === selectedRegion.district);
    }

    // 计算当前省份所有城市的事件（用于后续地图标记聚合）
    const allProvinceEvents: RiskEvent[] = [];
    
    try {
      for (const [district, data] of Object.entries(allRegionsWeatherData)) {
        const region: Region = { ...selectedRegion, district };
        const events = riskService.calculateRiskEvents(
          selectedProduct.id,
          region,
          dateRange,
          data
        );
        allProvinceEvents.push(...events);
      }
    } catch (error) {
      console.error('Failed to calculate risk events for province:', error);
    }

    // 如果是历史数据，存入缓存
    if (cacheKey) {
      historicalRiskCache.set(cacheKey, allProvinceEvents);
    }

    // 返回当前选中城市的事件
    return allProvinceEvents.filter(e => e.region.district === selectedRegion.district);
  }, [selectedProduct, selectedRegion, dateRange, weatherType, dataType, allRegionsWeatherData, riskService]);

  // --- 2. 全域统计 (Map Markers Data) ---
  // 用于地图展示：城市 -> 风险事件总数 (不分级)
  const mapMarkersData = useMemo<RiskData[]>(() => {
    if (!selectedProduct || !allRegionsWeatherData) return [];

    // 获取当前省份所有城市的事件列表（从缓存或当前计算结果）
    const cacheKey = dataType === 'historical' 
      ? `${selectedProduct.id}-${selectedRegion.country}-${selectedRegion.province}-${weatherType}-${dataType}-${format(dateRange.from, 'yyyyMMdd')}-${format(dateRange.to, 'yyyyMMdd')}`
      : null;
    
    let allEvents: RiskEvent[] = [];
    if (cacheKey && historicalRiskCache.has(cacheKey)) {
      allEvents = historicalRiskCache.get(cacheKey)!;
    } else {
      // 如果没有缓存（如预测数据），则使用上面计算出的当前选中城市的事件是不够的，
      // 但在 useMemo(riskEvents) 中其实已经算过了全省的，只是最后 filter 了。
      // 为了效率，我们可以让 riskEvents 同时也返回全省的数据，或者在这里重新快速聚合。
      // 这里采用重新计算/聚合的方式保持 Hook 逻辑清晰
      try {
        for (const [district, data] of Object.entries(allRegionsWeatherData)) {
          const region: Region = { ...selectedRegion, district };
          const events = riskService.calculateRiskEvents(selectedProduct.id, region, dateRange, data);
          allEvents.push(...events);
        }
      } catch (e) {}
    }

    // 按城市聚合
    const result = Object.entries(allRegionsWeatherData).map(([district, data]) => {
      const region: Region = { ...selectedRegion, district };
      const districtEvents = allEvents.filter(e => e.region.district === district);
      const totalEvents = districtEvents.length;
      
      return {
        id: `${selectedProduct.id}-${district}`,
        region,
        weatherType,
        value: data.reduce((acc, curr) => acc + curr.value, 0) / (data.length || 1),
        riskLevel: totalEvents > 5 ? 'high' : totalEvents > 2 ? 'medium' : 'low',
        events: totalEvents
      };
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9b65e1ca-e15e-461c-9d2b-d9c022103649',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRiskAnalysis.ts:149',message:'mapMarkersData calculated',data:{selectedProductId:selectedProduct.id,allEventsCount:allEvents.length,resultCount:result.length,resultEvents:result.map(r=>({district:r.region.district,events:r.events}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    return result;
  }, [selectedProduct, allRegionsWeatherData, selectedRegion, dateRange, weatherType, dataType, riskService]);

  // --- 3. 详细统计 (Detailed Statistics for DataDashboard) ---
  // 用于数据面板：选中城市的风险分级统计
  const detailedStatistics = useMemo<RiskStatistics>(() => {
    const defaultStats: RiskStatistics = {
      total: 0,
      byLevel: { tier1: 0, tier2: 0, tier3: 0 },
      byDataType: { historical: 0, predicted: 0 },
      byWeatherType: { [weatherType]: 0 } as any,
      byDataTypeAndLevel: {
        historical: { tier1: 0, tier2: 0, tier3: 0 },
        predicted: { tier1: 0, tier2: 0, tier3: 0 }
      },
      byWeatherTypeAndLevel: {
        [weatherType]: { tier1: 0, tier2: 0, tier3: 0 }
      } as any,
      byDataTypeAndWeatherType: {
        historical: { [weatherType]: 0 } as any,
        predicted: { [weatherType]: 0 } as any
      },
      byDataTypeAndWeatherTypeAndLevel: {
        historical: { [weatherType]: { tier1: 0, tier2: 0, tier3: 0 } } as any,
        predicted: { [weatherType]: { tier1: 0, tier2: 0, tier3: 0 } } as any
      },
      severity: '-'
    };

    if (!selectedProduct || riskEvents.length === 0) {
      return defaultStats;
    }

    try {
      return riskService.calculateRiskStatistics(
        selectedProduct.id,
        selectedRegion,
        dateRange,
        allRegionsWeatherData[selectedRegion.district] || []
      );
    } catch (error) {
      console.error('Failed to calculate detailed statistics:', error);
      return defaultStats;
    }
  }, [selectedProduct, selectedRegion, dateRange, allRegionsWeatherData, riskEvents, weatherType, riskService]);

  return {
    riskEvents,
    mapMarkersData,
    detailedStatistics,
    isCalculated: detailedStatistics.total > 0 || !!selectedProduct
  };
}

