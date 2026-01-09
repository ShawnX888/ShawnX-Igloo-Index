/**
 * 通用扩展数据获取 Hook
 * 用于风险叠加示意图和风险事件计算
 * 
 * 扩展逻辑：
 * - 扩展起始时间 = dateRange.from - 数据计算窗口大小
 * - 扩展结束时间 = dateRange.to（保持不变）
 * 
 * 注意：dateRange.from 和 dateRange.to 已经是 UTC 时间
 * 
 * 根据产品 riskRules.timeWindow.type 判断时间单位：
 * - 'hourly': 扩展 timeWindow.size 小时（保持原有时刻，UTC）
 * - 'daily': 扩展 timeWindow.size 天（起始时刻为 00:00:00 UTC）
 * - 'weekly': 扩展 timeWindow.size 周（起始时刻为 00:00:00 UTC）
 * - 'monthly': 扩展到当月1号（起始时刻为 00:00:00 UTC）
 */

import { useMemo } from 'react';
import { Region, DateRange, DataType, WeatherType, WeatherData } from '../types';
import { useWeatherData, useDailyWeatherData } from './useWeatherData';
import { productLibrary } from '../lib/productLibrary';
import { InsuranceProduct } from '../components/home/types';
import { subHours, subDays, subWeeks } from 'date-fns';

/**
 * 通用扩展数据获取 Hook
 * 用于风险叠加示意图和风险事件计算
 * 
 * @param selectedRegion 选中的区域
 * @param dateRange 用户选择的时间窗口（Map Settings）
 * @param dataType 数据类型
 * @param weatherType 天气类型
 * @param selectedProduct 选中的产品（用于获取 riskRules）
 * @returns 扩展后的天气数据（小时级和日级）
 */
export function useExtendedWeatherData(
  selectedRegion: Region,
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType,
  selectedProduct: InsuranceProduct | null
): {
  extendedHourlyData: WeatherData[];
  extendedDailyData: WeatherData[];
  extendedDateRange: DateRange | null;
} {
  // 计算扩展的时间范围
  const extendedDateRange = useMemo<DateRange | null>(() => {
    if (!selectedProduct || !dateRange?.from || !dateRange?.to) {
      return null;
    }

    const fullProduct = productLibrary.getProduct(selectedProduct.id);
    if (!fullProduct?.riskRules?.timeWindow) {
      return null;
    }

    const { timeWindow } = fullProduct.riskRules;
    const windowSize = timeWindow.size;
    let extendedFrom: Date;

    // 根据 timeWindow.type 判断时间单位
    // dateRange.from 和 dateRange.to 已经是 UTC 时间
    if (timeWindow.type === 'hourly') {
      // 小时级窗口：扩展 windowSize 小时（UTC）
      // 直接减去 windowSize 小时，然后对齐到小时边界（UTC）
      extendedFrom = subHours(dateRange.from, windowSize);
      // 对齐到小时边界（UTC）
      extendedFrom = new Date(Date.UTC(
        extendedFrom.getUTCFullYear(),
        extendedFrom.getUTCMonth(),
        extendedFrom.getUTCDate(),
        extendedFrom.getUTCHours(),
        0, 0, 0
      ));
    } else if (timeWindow.type === 'daily') {
      // 天级窗口：扩展 windowSize 天（UTC）
      // 先减去 windowSize 天，然后对齐到当天 00:00:00 UTC
      extendedFrom = subDays(dateRange.from, windowSize);
      // 对齐到当天 00:00:00 UTC
      extendedFrom = new Date(Date.UTC(
        extendedFrom.getUTCFullYear(),
        extendedFrom.getUTCMonth(),
        extendedFrom.getUTCDate(),
        0, 0, 0, 0
      ));
    } else if (timeWindow.type === 'weekly') {
      // 周级窗口：扩展 windowSize 周（UTC）
      // 先减去 windowSize 周，然后对齐到当天 00:00:00 UTC
      extendedFrom = subWeeks(dateRange.from, windowSize);
      // 对齐到当天 00:00:00 UTC
      extendedFrom = new Date(Date.UTC(
        extendedFrom.getUTCFullYear(),
        extendedFrom.getUTCMonth(),
        extendedFrom.getUTCDate(),
        0, 0, 0, 0
      ));
    } else if (timeWindow.type === 'monthly') {
      // 月级窗口：扩展到当月1号 00:00:00 UTC
      // 获取当月1号，然后设置为 00:00:00 UTC
      extendedFrom = new Date(Date.UTC(
        dateRange.from.getUTCFullYear(),
        dateRange.from.getUTCMonth(),
        1, // 1号
        0, 0, 0, 0
      ));
    } else {
      // 未知类型，不扩展
      return null;
    }

    const result = {
      from: extendedFrom,
      to: dateRange.to,
      startHour: dateRange.startHour,
      endHour: dateRange.endHour,
    };

    // 日志：扩展时间范围计算
    console.log('[useExtendedWeatherData] Extended date range calculated', {
      productId: selectedProduct.id,
      timeWindowType: timeWindow.type,
      windowSize,
      originalRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString()
      },
      extendedRange: {
        from: result.from.toISOString(),
        to: result.to.toISOString()
      },
      extensionHours: (result.from.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60)
    });

    return result;
  }, [selectedProduct, dateRange]);

  // 获取扩展后的天气数据
  // 使用产品ID作为缓存上下文，确保不同产品的扩展数据不会互相干扰
  const extendedAllRegionsData = useWeatherData(
    selectedRegion,
    extendedDateRange || dateRange, // 如果没有扩展，使用原始 dateRange
    dataType,
    weatherType,
    selectedProduct?.id ? `extended-${selectedProduct.id}` : undefined // 传递产品ID作为缓存上下文
  );

  // 生成扩展的日级数据（从小时级数据累计）
  const extendedAllRegionsDailyData = useDailyWeatherData(
    extendedAllRegionsData,
    extendedDateRange || dateRange,
    weatherType
  );

  // 提取选中区域的扩展数据
  const extendedHourlyData = useMemo(() => {
    if (!extendedDateRange) {
      console.warn('[useExtendedWeatherData] extendedDateRange is null, returning empty array', {
        selectedProduct: selectedProduct?.id,
        dateRange: dateRange?.from ? dateRange.from.toISOString() : 'null'
      });
      return [];
    }
    const data = extendedAllRegionsData[selectedRegion.district] || [];
    
    if (data.length === 0) {
      console.warn('[useExtendedWeatherData] Extended hourly data is empty', {
        district: selectedRegion.district,
        extendedDateRange: {
          from: extendedDateRange.from.toISOString(),
          to: extendedDateRange.to.toISOString()
        },
        allRegionsKeys: Object.keys(extendedAllRegionsData),
        selectedProduct: selectedProduct?.id
      });
    }
    
    // 日志：扩展小时级数据
    if (data.length > 0) {
      console.log('[useExtendedWeatherData] Extended hourly data loaded', {
        district: selectedRegion.district,
        dataLength: data.length,
        firstDate: data[0]?.date,
        lastDate: data[data.length - 1]?.date,
        extendedDateRange: extendedDateRange ? {
          from: extendedDateRange.from.toISOString(),
          to: extendedDateRange.to.toISOString()
        } : null
      });
    }
    
    return data;
  }, [extendedAllRegionsData, selectedRegion.district, extendedDateRange, selectedProduct]);

  const extendedDailyData = useMemo(() => {
    if (!extendedDateRange) {
      console.warn('[useExtendedWeatherData] extendedDateRange is null, returning empty array', {
        selectedProduct: selectedProduct?.id,
        dateRange: dateRange?.from ? dateRange.from.toISOString() : 'null'
      });
      return [];
    }
    const data = extendedAllRegionsDailyData[selectedRegion.district] || [];
    
    if (data.length === 0) {
      console.warn('[useExtendedWeatherData] Extended daily data is empty', {
        district: selectedRegion.district,
        extendedDateRange: {
          from: extendedDateRange.from.toISOString(),
          to: extendedDateRange.to.toISOString()
        },
        allRegionsKeys: Object.keys(extendedAllRegionsDailyData),
        selectedProduct: selectedProduct?.id
      });
    }
    
    // 日志：扩展日级数据
    if (data.length > 0) {
      console.log('[useExtendedWeatherData] Extended daily data loaded', {
        district: selectedRegion.district,
        dataLength: data.length,
        firstDate: data[0]?.date,
        lastDate: data[data.length - 1]?.date,
        extendedDateRange: extendedDateRange ? {
          from: extendedDateRange.from.toISOString(),
          to: extendedDateRange.to.toISOString()
        } : null
      });
    }
    
    return data;
  }, [extendedAllRegionsDailyData, selectedRegion.district, extendedDateRange, selectedProduct]);

  return {
    extendedHourlyData,
    extendedDailyData,
    extendedDateRange,
  };
}

