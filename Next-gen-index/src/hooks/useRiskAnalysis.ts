/**
 * 风险分析Hook
 * 中心化处理风险事件计算与统计，作为系统唯一的风险计算入口
 * 实现《风险计算架构升级方案》中的 #2 和 #4 部分
 * 
 * 使用扩展数据确保时间窗口起始位置的风险事件计算准确
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
  RegionWeatherData
} from '../types';
import { InsuranceProduct } from '../components/home/types';
import { createRiskCalculationService } from '../lib/riskCalculationService';
import { productLibrary } from '../lib/productLibrary';
import { format, startOfDay, isSameDay } from 'date-fns';
import { useExtendedWeatherData } from './useExtendedWeatherData';

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

  // 获取扩展数据（用于选中区域的风险事件计算）
  const {
    extendedHourlyData,
    extendedDailyData,
    extendedDateRange
  } = useExtendedWeatherData(
    selectedRegion,
    dateRange,
    dataType,
    weatherType,
    selectedProduct
  );

  // 辅助函数：根据产品类型过滤风险事件
  // - 对于 hourly 产品：精确时间范围比较
  // - 对于 daily/weekly/monthly 产品：日期范围比较（不考虑时刻）
  const filterRiskEventsByDateRange = useMemo(() => {
    if (!selectedProduct) {
      return (events: RiskEvent[]) => events;
    }
    
    const fullProduct = productLibrary.getProduct(selectedProduct.id);
    const productTimeWindowType = fullProduct?.riskRules?.timeWindow?.type || 'hourly';
    
    return (events: RiskEvent[]): RiskEvent[] => {
      if (productTimeWindowType === 'hourly') {
        // 精确时间范围比较
        return events.filter(event => {
          const eventTime = event.timestamp.getTime();
          return eventTime >= dateRange.from.getTime() && eventTime <= dateRange.to.getTime();
        });
      } else {
        // 日期范围比较（不考虑时刻）
        // 对于 daily/weekly/monthly 产品，如果事件日期在 dateRange 的日期范围内，就计入
        const rangeStartDate = startOfDay(dateRange.from);
        const rangeEndDate = startOfDay(dateRange.to);
        
        return events.filter(event => {
          const eventDate = startOfDay(event.timestamp);
          // 事件日期 >= 范围起始日期 && 事件日期 <= 范围结束日期
          return eventDate >= rangeStartDate && eventDate <= rangeEndDate;
        });
      }
    };
  }, [selectedProduct, dateRange]);

  // 根据产品类型选择合适的扩展数据
  const selectedRegionExtendedData = useMemo<WeatherData[]>(() => {
    if (!selectedProduct || !extendedDateRange) {
      console.log('[useRiskAnalysis] Using original data (no product or no extended date range)', {
        hasProduct: !!selectedProduct,
        hasExtendedDateRange: !!extendedDateRange,
        district: selectedRegion.district
      });
      return allRegionsWeatherData[selectedRegion.district] || [];
    }

    const fullProduct = productLibrary.getProduct(selectedProduct.id);
    if (!fullProduct?.riskRules?.timeWindow) {
      console.log('[useRiskAnalysis] Using original data (no timeWindow config)', {
        productId: selectedProduct.id,
        district: selectedRegion.district
      });
      return allRegionsWeatherData[selectedRegion.district] || [];
    }

    // 根据 timeWindow.type 选择合适的数据粒度
    const timeWindowType = fullProduct.riskRules.timeWindow.type;
    const selectedData = timeWindowType === 'hourly' ? extendedHourlyData : extendedDailyData;
    
    // 日志：数据选择
    console.log('[useRiskAnalysis] Selected extended data', {
      productId: selectedProduct.id,
      timeWindowType,
      dataType: timeWindowType === 'hourly' ? 'hourly' : 'daily',
      extendedDataLength: selectedData.length,
      originalDataLength: (allRegionsWeatherData[selectedRegion.district] || []).length,
      district: selectedRegion.district
    });
    
    return selectedData;
  }, [selectedProduct, extendedHourlyData, extendedDailyData, extendedDateRange, allRegionsWeatherData, selectedRegion.district]);

  // --- 1. 计算原始风险事件列表（使用扩展数据）---
  const riskEvents = useMemo(() => {
    if (!selectedProduct || !allRegionsWeatherData || !selectedRegion.district) {
      return [];
    }

    // 尝试从缓存中获取历史数据
    // 缓存键包含：产品ID、区域、天气类型、数据类型、用户选择的时间范围
    // 注意：扩展时间范围是基于产品配置和用户选择的时间范围计算的，
    // 如果产品和用户选择的时间范围相同，扩展时间范围也应该相同
    // 所以缓存键不需要包含扩展时间范围信息
    const cacheKey = dataType === 'historical' 
      ? `${selectedProduct.id}-${selectedRegion.country}-${selectedRegion.province}-${weatherType}-${dataType}-${format(dateRange.from, 'yyyyMMdd')}-${format(dateRange.to, 'yyyyMMdd')}`
      : null;

    if (cacheKey && historicalRiskCache.has(cacheKey)) {
      // 返回缓存中当前城市的事件（已过滤到用户选择的时间窗口）
      const cachedEvents = historicalRiskCache.get(cacheKey)!.filter(e => e.region.district === selectedRegion.district);
      // 根据产品类型过滤到用户选择的时间窗口
      return filterRiskEventsByDateRange(cachedEvents);
    }

    // 计算当前省份所有城市的事件（用于后续地图标记聚合）
    const allProvinceEvents: RiskEvent[] = [];
    
    try {
      for (const [district, data] of Object.entries(allRegionsWeatherData)) {
        const region: Region = { ...selectedRegion, district };
        
        // 对于选中区域，使用扩展数据；对于其他区域，使用原始数据
        const dataToUse = district === selectedRegion.district 
          ? selectedRegionExtendedData 
          : data;
        
        // 确定使用的 dateRange：
        // - 对于选中区域：如果使用扩展数据，传递 extendedDateRange 给计算服务
        //   这样 filterAndSortWeatherData 会使用扩展时间范围进行过滤，保留扩展数据
        // - 对于其他区域：使用原始 dateRange
        const dateRangeToUse = extendedDateRange && district === selectedRegion.district 
          ? extendedDateRange 
          : dateRange;
        
        // 日志：数据使用情况
        if (district === selectedRegion.district && extendedDateRange) {
          console.log('[useRiskAnalysis] Using extended data for risk calculation', {
            district,
            productId: selectedProduct.id,
            extendedDataLength: dataToUse.length,
            originalDataLength: data.length,
            extendedDateRange: {
              from: extendedDateRange.from.toISOString(),
              to: extendedDateRange.to.toISOString()
            },
            userDateRange: {
              from: dateRange.from.toISOString(),
              to: dateRange.to.toISOString()
            }
          });
        }
        
        const events = riskService.calculateRiskEvents(
          selectedProduct.id,
          region,
          dateRangeToUse,
          dataToUse
        );
        allProvinceEvents.push(...events);
      }
    } catch (error) {
      console.error('Failed to calculate risk events for province:', error);
    }

    // 如果是历史数据，存入缓存（存储所有事件，包括扩展时间范围内的）
    if (cacheKey) {
      historicalRiskCache.set(cacheKey, allProvinceEvents);
    }

    // 返回当前选中城市的事件，并过滤到用户选择的时间窗口
    const selectedDistrictEvents = allProvinceEvents.filter(e => e.region.district === selectedRegion.district);
    
    // 日志：计算完成，准备过滤
    console.log('[useRiskAnalysis] Risk events calculated', {
      productId: selectedProduct.id,
      district: selectedRegion.district,
      totalEventsBeforeFilter: selectedDistrictEvents.length,
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString()
      },
      extendedDateRange: extendedDateRange ? {
        from: extendedDateRange.from.toISOString(),
        to: extendedDateRange.to.toISOString()
      } : null
    });
    
    // 根据产品类型过滤到用户选择的时间窗口
    // - 对于 hourly 产品：精确时间范围比较
    // - 对于 daily/weekly/monthly 产品：日期范围比较（不考虑时刻）
    const filteredEvents = filterRiskEventsByDateRange(selectedDistrictEvents);
    
    // 日志：过滤结果
    console.log('[useRiskAnalysis] Risk events filtered', {
      productId: selectedProduct.id,
      district: selectedRegion.district,
      eventsBeforeFilter: selectedDistrictEvents.length,
      eventsAfterFilter: filteredEvents.length,
      filteredOut: selectedDistrictEvents.length - filteredEvents.length
    });
    
    return filteredEvents;
  }, [selectedProduct, selectedRegion, dateRange, weatherType, dataType, allRegionsWeatherData, riskService, selectedRegionExtendedData, extendedDateRange, filterRiskEventsByDateRange]);

  // --- 2. 全域统计 (Map Markers Data) ---
  // 用于地图展示：城市 -> 风险事件总数 (不分级)
  // 注意：地图标记基于过滤后的风险事件（只包含用户选择时间范围内的事件）
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
      // 如果没有缓存（如预测数据），则重新计算
      // 对于选中区域，使用扩展数据；对于其他区域，使用原始数据
      try {
        for (const [district, data] of Object.entries(allRegionsWeatherData)) {
          const region: Region = { ...selectedRegion, district };
          
          // 对于选中区域，使用扩展数据；对于其他区域，使用原始数据
          const dataToUse = district === selectedRegion.district 
            ? selectedRegionExtendedData 
            : data;
          
          const events = riskService.calculateRiskEvents(
            selectedProduct.id, 
            region, 
            extendedDateRange && district === selectedRegion.district ? extendedDateRange : dateRange, 
            dataToUse
          );
          allEvents.push(...events);
        }
      } catch (e) {
        console.error('Failed to calculate risk events for map markers:', e);
      }
    }

    // 根据产品类型过滤到用户选择的时间窗口
    // - 对于 hourly 产品：精确时间范围比较
    // - 对于 daily/weekly/monthly 产品：日期范围比较（不考虑时刻）
    const filteredEvents = filterRiskEventsByDateRange(allEvents);

    // 按城市聚合（基于过滤后的事件）
    const result = Object.entries(allRegionsWeatherData).map(([district, data]) => {
      const region: Region = { ...selectedRegion, district };
      const districtEvents = filteredEvents.filter(e => e.region.district === district);
      const totalEvents = districtEvents.length;
      
      const riskLevel: 'low' | 'medium' | 'high' = totalEvents > 5 ? 'high' : totalEvents > 2 ? 'medium' : 'low';
      
      return {
        id: `${selectedProduct.id}-${district}`,
        region,
        weatherType,
        value: data.reduce((acc, curr) => acc + curr.value, 0) / (data.length || 1),
        riskLevel,
        events: totalEvents
      };
    });

    return result;
  }, [selectedProduct, allRegionsWeatherData, selectedRegion, dateRange, weatherType, dataType, riskService, selectedRegionExtendedData, extendedDateRange, filterRiskEventsByDateRange]);

  // --- 3. 详细统计 (Detailed Statistics for DataDashboard) ---
  // 用于数据面板：选中城市的风险分级统计
  // 注意：应该使用已经过滤好的 riskEvents，而不是重新计算
  // 这样可以确保统计信息与显示的风险事件列表一致
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
      // 直接使用已经过滤好的 riskEvents 来计算统计信息
      // 这样可以确保统计信息与显示的风险事件列表一致
      return riskService.calculationEngine.calculateRiskStatistics(riskEvents);
    } catch (error) {
      console.error('Failed to calculate detailed statistics:', error);
      return defaultStats;
    }
  }, [selectedProduct, riskEvents, weatherType, riskService]);

  return {
    riskEvents,
    mapMarkersData,
    detailedStatistics,
    isCalculated: detailedStatistics.total > 0 || !!selectedProduct
  };
}

