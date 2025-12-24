/**
 * 通用扩展数据获取 Hook
 * 用于风险叠加示意图和风险事件计算
 * 
 * 扩展逻辑：
 * - 扩展起始时间 = dateRange.from - 数据计算窗口大小
 * - 扩展结束时间 = dateRange.to（保持不变）
 * 
 * 根据产品 riskRules.timeWindow.type 判断时间单位：
 * - 'hourly': 扩展 timeWindow.size 小时（保持原有时刻）
 * - 'daily': 扩展 timeWindow.size 天（起始时刻为 00:00:00 本地时区）
 * - 'weekly': 扩展 timeWindow.size 周（起始时刻为 00:00:00 本地时区）
 * - 'monthly': 扩展到当月1号（起始时刻为 00:00:00 本地时区）
 */

import { useMemo } from 'react';
import { Region, DateRange, DataType, WeatherType, WeatherData } from '../types';
import { useWeatherData, useDailyWeatherData } from './useWeatherData';
import { productLibrary } from '../lib/productLibrary';
import { InsuranceProduct } from '../components/home/types';
import { subHours, subDays, subWeeks, startOfMonth, startOfDay } from 'date-fns';

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
    if (timeWindow.type === 'hourly') {
      // 小时级窗口：扩展 windowSize 小时
      // 问题：数据生成器会使用 setHours(startHour, 0, 0, 0) 重新对齐时间（本地时区）
      // 解决方案：扩展的from需要确保数据生成器对齐到startHour后，仍然包含回溯所需的数据
      // 逻辑：
      // 1. 获取dateRange.from的本地时间，设置为startHour:00:00（这是数据生成器的起始时间）
      // 2. 从这个时间减去windowSize小时，得到扩展的from（本地时区）
      // 3. 数据生成器会对这个扩展的from重新对齐到startHour，但因为我们提前了windowSize小时，
      //    对齐后的第一个数据点（dateRange.from对齐到startHour）在扩展数据中的索引就是windowSize
      // 4. 这样第一个数据点可以回溯到索引0到windowSize，共windowSize+1个数据点
      const baseTime = new Date(dateRange.from);
      baseTime.setHours(dateRange.startHour, 0, 0, 0); // 对齐到startHour（本地时区）
      // 减去windowSize小时（本地时区），这样数据生成器对齐后，第一个数据点可以回溯windowSize小时
      extendedFrom = subHours(baseTime, windowSize);
    } else if (timeWindow.type === 'daily') {
      // 天级窗口：扩展 windowSize 天
      // 先减去windowSize天，然后对齐到当天00:00:00 本地时区，确保数据生成器能生成完整数据
      // 扩展起始时刻统一为 00:00:00 本地时区
      extendedFrom = subDays(dateRange.from, windowSize);
      // 使用本地时区的 startOfDay，确保与日级数据生成逻辑一致
      extendedFrom = startOfDay(extendedFrom);
    } else if (timeWindow.type === 'weekly') {
      // 周级窗口：扩展 windowSize 周
      // 先减去windowSize周，然后对齐到当天00:00:00 本地时区
      // 扩展起始时刻统一为 00:00:00 本地时区
      extendedFrom = subWeeks(dateRange.from, windowSize);
      // 使用本地时区的 startOfDay，确保与日级数据生成逻辑一致
      extendedFrom = startOfDay(extendedFrom);
    } else if (timeWindow.type === 'monthly') {
      // 月级窗口：扩展到当月1号00:00:00 本地时区
      // 先获取当月1号，然后设置为本地时区 00:00:00
      // 扩展起始时刻统一为 00:00:00 本地时区
      const monthStart = startOfMonth(dateRange.from);
      extendedFrom = startOfDay(monthStart);
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

