/**
 * Mock降雨量数据生成器
 * 实现RainfallDataGenerator接口，提供数据生成、缓存和补充功能
 */

import { Region, DateRange, RainfallType, RegionData, RainfallData } from '../types';
import { RainfallDataGenerator } from '../interfaces/dataGenerator';
import { addDays, addHours, format, differenceInHours, differenceInDays, startOfDay, isBefore, isAfter } from 'date-fns';

/**
 * 区域种子生成器
 * 根据区域信息生成唯一的种子值，确保同一区域的数据一致
 */
function generateRegionSeed(region: Region): number {
  const seedString = `${region.country}-${region.province}-${region.district}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 确定性随机数生成器（基于种子）
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInRange(min: number, max: number): number {
    return min + (this.next() * (max - min));
  }
}

/**
 * 获取同一省/州下的所有市/区
 * 注意：这里使用硬编码的区域层级，未来应该从区域数据管理模块获取
 */
function getDistrictsInProvince(region: Region): string[] {
  // 临时硬编码的区域层级（与ControlPanel中的HIERARCHY保持一致）
  const HIERARCHY: Record<string, Record<string, string[]>> = {
    "Indonesia": {
      "Jakarta": ["Jakarta Selatan", "Jakarta Timur", "Jakarta Barat", "Jakarta Pusat"],
      "West Java": ["Bandung", "Bogor", "Bekasi", "Jakarta Selatan"], // 添加默认区域
      "Bali": ["Denpasar", "Ubud"]
    },
    "Thailand": {
      "Bangkok": ["Bang Rak", "Pathum Wan", "Chatuchak"],
      "Chiang Mai": ["Mueang", "Mae Rim"]
    },
    "Vietnam": {
      "Ho Chi Minh": ["District 1", "District 3", "Thu Duc"],
      "Hanoi": ["Hoan Kiem", "Tay Ho"]
    }
  };

  const districts = HIERARCHY[region.country]?.[region.province] || [];
  // 如果找不到对应的省/州，至少返回当前选中的市/区
  if (districts.length === 0) {
    return [region.district];
  }
  // 确保选中的市/区在列表中
  if (!districts.includes(region.district)) {
    districts.push(region.district);
  }
  return districts;
}

/**
 * 生成小时级降雨量数据
 */
function generateHourlyData(
  region: Region,
  dateRange: DateRange,
  type: RainfallType,
  random: SeededRandom
): RainfallData[] {
  const data: RainfallData[] = [];
  const { from, to, startHour, endHour } = dateRange;

  // 计算时间范围（小时）
  let currentTime = new Date(from);
  currentTime.setHours(startHour, 0, 0, 0);
  const endTime = new Date(to);
  endTime.setHours(endHour, 0, 0, 0);

  // 区域特征：不同区域有不同的降雨模式
  const regionSeed = generateRegionSeed(region);
  const baseAmount = type === 'historical' 
    ? 20 + (regionSeed % 50)  // 历史数据：20-70mm基础值
    : 15 + (regionSeed % 40); // 预测数据：15-55mm基础值

  // 时间特征：不同时间段有不同的降雨模式
  // 使用 <= 比较，确保包含结束时间
  while (currentTime.getTime() <= endTime.getTime()) {
    const hour = currentTime.getHours();
    const dayOfYear = Math.floor((currentTime.getTime() - new Date(currentTime.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    
    // 时间因子：白天降雨较少，夜间和下午较多
    let timeFactor = 1.0;
    if (hour >= 6 && hour < 12) {
      timeFactor = 0.3; // 上午较少
    } else if (hour >= 12 && hour < 18) {
      timeFactor = 1.5; // 下午较多
    } else if (hour >= 18 && hour < 24) {
      timeFactor = 1.2; // 晚上较多
    } else {
      timeFactor = 0.8; // 凌晨
    }

    // 季节性因子：模拟季节性变化
    const seasonalFactor = 0.8 + 0.4 * Math.sin((dayOfYear / 365) * 2 * Math.PI);

    // 随机波动（基于种子，确保确定性）
    const randomFactor = 0.7 + (random.next() * 0.6); // 0.7-1.3

    // 计算降雨量
    let amount = baseAmount * timeFactor * seasonalFactor * randomFactor;

    // 历史数据和预测数据的不同处理
    if (type === 'historical') {
      // 历史数据：更稳定，波动较小
      amount = amount * (0.9 + random.next() * 0.2);
    } else {
      // 预测数据：可以有一定的随机性
      amount = amount * (0.8 + random.next() * 0.4);
    }

    // 确保降雨量在合理范围内（0-200mm）
    amount = Math.max(0, Math.min(200, amount));

    // 计算风险级别
    let risk: 'low' | 'medium' | 'high' | undefined;
    if (amount >= 100) {
      risk = 'high';
    } else if (amount >= 50) {
      risk = 'medium';
    } else if (amount >= 20) {
      risk = 'low';
    }

    data.push({
      date: currentTime.toISOString(),
      amount: Math.round(amount * 100) / 100, // 保留2位小数
      risk
    });

    // 移动到下一个小时
    currentTime = addHours(currentTime, 1);
  }

  return data;
}

/**
 * 生成日级降雨量数据（从小时级数据累计）
 */
function generateDailyData(
  hourlyData: RainfallData[],
  dateRange: DateRange
): RainfallData[] {
  const dailyMap = new Map<string, { amount: number; riskCounts: { low: number; medium: number; high: number } }>();

  hourlyData.forEach(item => {
    const date = new Date(item.date);
    const dayKey = format(startOfDay(date), 'yyyy-MM-dd');

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { amount: 0, riskCounts: { low: 0, medium: 0, high: 0 } });
    }

    const dayData = dailyMap.get(dayKey)!;
    dayData.amount += item.amount;

    if (item.risk === 'low') dayData.riskCounts.low++;
    if (item.risk === 'medium') dayData.riskCounts.medium++;
    if (item.risk === 'high') dayData.riskCounts.high++;
  });

  const dailyData: RainfallData[] = [];
  const { from, to } = dateRange;
  let currentDate = startOfDay(from);
  const endDate = startOfDay(to);

  // 使用 <= 比较，确保包含结束日期
  while (currentDate.getTime() <= endDate.getTime()) {
    const dayKey = format(currentDate, 'yyyy-MM-dd');
    const dayData = dailyMap.get(dayKey);

    if (dayData) {
      // 确定风险级别（基于最高风险小时）
      let risk: 'low' | 'medium' | 'high' | undefined;
      if (dayData.riskCounts.high > 0) {
        risk = 'high';
      } else if (dayData.riskCounts.medium > 0) {
        risk = 'medium';
      } else if (dayData.riskCounts.low > 0) {
        risk = 'low';
      }

      dailyData.push({
        date: currentDate.toISOString(),
        amount: Math.round(dayData.amount * 100) / 100,
        risk
      });
    } else {
      // 如果某天没有数据，添加0值
      dailyData.push({
        date: currentDate.toISOString(),
        amount: 0
      });
    }

    currentDate = addDays(currentDate, 1);
  }

  return dailyData;
}

/**
 * 检查数据是否完整
 */
function isDataComplete(
  data: RegionData,
  districts: string[],
  dateRange: DateRange
): boolean {
  if (!data || Object.keys(data).length === 0) {
    return false;
  }

  // 检查所有区域是否都有数据
  for (const district of districts) {
    if (!data[district] || data[district].length === 0) {
      return false;
    }

    // 检查时间范围是否完整
    const districtData = data[district];
    const firstDate = new Date(districtData[0].date);
    const lastDate = new Date(districtData[districtData.length - 1].date);

    if (isBefore(firstDate, dateRange.from) || isAfter(lastDate, dateRange.to)) {
      return false;
    }
  }

  return true;
}

/**
 * 补充缺失的数据
 */
function supplementData(
  existingData: RegionData,
  region: Region,
  dateRange: DateRange,
  type: RainfallType,
  districts: string[]
): RegionData {
  const result: RegionData = { ...existingData };

  for (const district of districts) {
    const existingDistrictData = existingData[district] || [];
    
    // 如果该区域没有数据，生成完整数据
    if (existingDistrictData.length === 0) {
      const districtRegion: Region = { ...region, district };
      const regionSeed = generateRegionSeed(districtRegion);
      const random = new SeededRandom(regionSeed);
      const hourlyData = generateHourlyData(districtRegion, dateRange, type, random);
      result[district] = hourlyData;
      continue;
    }

    // 检查时间范围，补充缺失的时间段
    const firstDate = new Date(existingDistrictData[0].date);
    const lastDate = new Date(existingDistrictData[existingDistrictData.length - 1].date);

    // 如果数据不完整，重新生成（简化处理）
    if (isBefore(firstDate, dateRange.from) || isAfter(lastDate, dateRange.to)) {
      const districtRegion: Region = { ...region, district };
      const regionSeed = generateRegionSeed(districtRegion);
      const random = new SeededRandom(regionSeed);
      const hourlyData = generateHourlyData(districtRegion, dateRange, type, random);
      result[district] = hourlyData;
    } else {
      result[district] = existingDistrictData;
    }
  }

  return result;
}

/**
 * Mock降雨量数据生成器实现
 */
export class MockRainfallDataGenerator implements RainfallDataGenerator {
  private cache: Map<string, RegionData> = new Map();

  /**
   * 生成缓存key
   */
  private getCacheKey(region: Region, dateRange: DateRange, type: RainfallType): string {
    const fromStr = format(dateRange.from, 'yyyy-MM-dd-HH');
    const toStr = format(dateRange.to, 'yyyy-MM-dd-HH');
    return `${region.country}-${region.province}-${type}-${fromStr}-${toStr}`;
  }

  /**
   * 生成降雨量数据
   */
  generate(region: Region, dateRange: DateRange, type: RainfallType): RegionData {
    const cacheKey = this.getCacheKey(region, dateRange, type);
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const cachedData = this.cache.get(cacheKey)!;
      const districts = getDistrictsInProvince(region);
      
      // 验证缓存数据是否完整
      if (isDataComplete(cachedData, districts, dateRange)) {
        return cachedData;
      }
    }

    // 生成新数据
    const districts = getDistrictsInProvince(region);
    const result: RegionData = {};

    for (const district of districts) {
      const districtRegion: Region = { ...region, district };
      const regionSeed = generateRegionSeed(districtRegion);
      const random = new SeededRandom(regionSeed);

      // 生成小时级数据
      const hourlyData = generateHourlyData(districtRegion, dateRange, type, random);
      
      // 同时提供小时级和日级数据（这里返回小时级，日级可以通过累计计算）
      result[district] = hourlyData;
    }

    // 缓存数据
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * 检查数据是否存在
   */
  hasData(region: Region, dateRange: DateRange, type: RainfallType): boolean {
    const cacheKey = this.getCacheKey(region, dateRange, type);
    
    if (!this.cache.has(cacheKey)) {
      return false;
    }

    const cachedData = this.cache.get(cacheKey)!;
    const districts = getDistrictsInProvince(region);
    
    return isDataComplete(cachedData, districts, dateRange);
  }

  /**
   * 补充缺失的数据
   */
  supplement(
    region: Region,
    dateRange: DateRange,
    type: RainfallType,
    existingData: RegionData
  ): RegionData {
    const districts = getDistrictsInProvince(region);
    const supplemented = supplementData(existingData, region, dateRange, type, districts);
    
    // 更新缓存
    const cacheKey = this.getCacheKey(region, dateRange, type);
    this.cache.set(cacheKey, supplemented);

    return supplemented;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取日级数据（从小时级数据累计）
   */
  getDailyData(hourlyData: RainfallData[], dateRange: DateRange): RainfallData[] {
    return generateDailyData(hourlyData, dateRange);
  }
}

// 导出单例实例
export const rainfallDataGenerator = new MockRainfallDataGenerator();

