/**
 * Mock天气数据生成器（通用）
 * 支持多种天气类型：降雨量、温度、风速、湿度等
 * 实现WeatherDataGenerator接口，提供数据生成、缓存和补充功能
 */

import { Region, DateRange, DataType, WeatherType, RegionWeatherData, WeatherData } from '../types';
import { WeatherDataGenerator } from '../interfaces/dataGenerator';
import { addDays, addHours, format, startOfDay } from 'date-fns';
import { getDistrictsInProvince } from './regionData';

/**
 * 区域种子生成器
 * 根据区域信息和天气类型生成唯一的种子值
 */
function generateRegionSeed(region: Region, weatherType: WeatherType): number {
  const seedString = `${region.country}-${region.province}-${region.district}-${weatherType}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
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
 * 天气数据生成配置
 * 定义不同天气类型的生成参数
 */
interface WeatherGenerationConfig {
  /** 基础值范围 */
  baseRange: { min: number; max: number };
  /** 历史数据调整因子 */
  historicalFactor: number;
  /** 预测数据调整因子 */
  predictedFactor: number;
  /** 时间因子配置（可选） */
  timeFactors?: {
    hour: number;
    factor: number;
  }[];
  /** 季节性因子强度 */
  seasonalStrength?: number;
}

/**
 * 天气类型生成配置映射
 */
const WEATHER_CONFIGS: Record<WeatherType, WeatherGenerationConfig> = {
  rainfall: {
    baseRange: { min: 20, max: 70 },
    historicalFactor: 1.0,
    predictedFactor: 0.9,
    timeFactors: [
      { hour: 6, factor: 0.3 },   // 上午较少
      { hour: 12, factor: 1.5 },  // 下午较多
      { hour: 18, factor: 1.2 },  // 晚上较多
      { hour: 0, factor: 0.8 }    // 凌晨
    ],
    seasonalStrength: 0.4
  },
  temperature: {
    baseRange: { min: 15, max: 35 }, // 摄氏度
    historicalFactor: 1.0,
    predictedFactor: 0.95,
    timeFactors: [
      { hour: 6, factor: 0.7 },   // 早晨较低
      { hour: 12, factor: 1.3 },  // 中午较高
      { hour: 18, factor: 1.0 },  // 傍晚
      { hour: 0, factor: 0.8 }    // 夜间较低
    ],
    seasonalStrength: 0.6
  },
  wind: {
    baseRange: { min: 5, max: 25 }, // km/h
    historicalFactor: 1.0,
    predictedFactor: 0.85,
    timeFactors: [
      { hour: 6, factor: 0.6 },
      { hour: 12, factor: 1.4 },
      { hour: 18, factor: 1.1 },
      { hour: 0, factor: 0.7 }
    ],
    seasonalStrength: 0.3
  },
  humidity: {
    baseRange: { min: 40, max: 90 }, // 百分比
    historicalFactor: 1.0,
    predictedFactor: 0.92,
    timeFactors: [
      { hour: 6, factor: 1.2 },   // 早晨湿度高
      { hour: 12, factor: 0.8 },  // 中午湿度低
      { hour: 18, factor: 1.0 },
      { hour: 0, factor: 1.1 }
    ],
    seasonalStrength: 0.2
  },
  pressure: {
    baseRange: { min: 980, max: 1020 }, // hPa
    historicalFactor: 1.0,
    predictedFactor: 0.98,
    seasonalStrength: 0.1
  },
  snowfall: {
    baseRange: { min: 0, max: 30 }, // cm
    historicalFactor: 1.0,
    predictedFactor: 0.88,
    timeFactors: [
      { hour: 6, factor: 0.5 },
      { hour: 12, factor: 0.8 },
      { hour: 18, factor: 1.2 },
      { hour: 0, factor: 1.0 }
    ],
    seasonalStrength: 0.5
  }
};

/**
 * 计算风险级别（根据天气类型和数值）
 */
function calculateRiskLevel(weatherType: WeatherType, value: number): 'low' | 'medium' | 'high' | undefined {
  const config = WEATHER_CONFIGS[weatherType];
  if (!config) return undefined;

  switch (weatherType) {
    case 'rainfall':
      if (value >= 100) return 'high';
      if (value >= 50) return 'medium';
      if (value >= 20) return 'low';
      return undefined;
    
    case 'temperature':
      if (value >= 35 || value <= 0) return 'high';
      if (value >= 30 || value <= 5) return 'medium';
      if (value >= 25 || value <= 10) return 'low';
      return undefined;
    
    case 'wind':
      if (value >= 20) return 'high';
      if (value >= 15) return 'medium';
      if (value >= 10) return 'low';
      return undefined;
    
    case 'humidity':
      if (value >= 85 || value <= 30) return 'high';
      if (value >= 75 || value <= 40) return 'medium';
      return undefined;
    
    case 'pressure':
      if (value <= 990 || value >= 1015) return 'high';
      if (value <= 995 || value >= 1010) return 'medium';
      return undefined;
    
    case 'snowfall':
      if (value >= 20) return 'high';
      if (value >= 10) return 'medium';
      if (value >= 5) return 'low';
      return undefined;
    
    default:
      return undefined;
  }
}

/**
 * 生成小时级天气数据
 */
function generateHourlyWeatherData(
  region: Region,
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType,
  random: SeededRandom
): WeatherData[] {
  const data: WeatherData[] = [];
  const { from, to, startHour, endHour } = dateRange;
  const config = WEATHER_CONFIGS[weatherType];

  if (!config) {
    console.warn(`No configuration found for weather type: ${weatherType}`);
    return data;
  }

  // 计算时间范围（小时）
  // 判断是否为扩展数据：如果 from 时间已经对齐到小时边界（分钟、秒、毫秒都为0），
  // 且本地时区的小时不是 startHour，则可能是扩展数据
  // 对于扩展数据，我们应该从 from 时间开始生成，而不是重新对齐到 startHour
  let currentTime = new Date(from);
  const fromMinutes = currentTime.getMinutes();
  const fromSeconds = currentTime.getSeconds();
  const fromMilliseconds = currentTime.getMilliseconds();
  const fromHourLocal = currentTime.getHours(); // 本地时区的小时
  
  // 如果 from 时间已经对齐到小时边界（分钟、秒、毫秒都为0），且本地时区的小时不是 startHour，则可能是扩展数据
  // 对于扩展数据，保持原样；对于普通数据，对齐到 startHour
  const isAlignedToHourBoundary = (fromMinutes === 0 && fromSeconds === 0 && fromMilliseconds === 0);
  const isExtendedData = isAlignedToHourBoundary && fromHourLocal !== startHour;
  
  if (!isExtendedData) {
    // 普通数据：对齐到 startHour
    currentTime.setHours(startHour, 0, 0, 0);
  } else {
    // 扩展数据：保持原样，只确保对齐到小时边界（已经是了）
    // 不需要修改，直接从 from 时间开始生成
  }
  const endTime = new Date(to);
  endTime.setHours(endHour, 0, 0, 0);

  // 区域特征：不同区域有不同的天气模式
  const regionSeed = generateRegionSeed(region, weatherType);
  const baseValue = config.baseRange.min + (regionSeed % (config.baseRange.max - config.baseRange.min));

  // 时间特征：不同时间段有不同的天气模式
  while (currentTime.getTime() <= endTime.getTime()) {
    const hour = currentTime.getHours();
    const dayOfYear = Math.floor((currentTime.getTime() - new Date(currentTime.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    
    // 时间因子
    let timeFactor = 1.0;
    if (config.timeFactors) {
      for (let i = config.timeFactors.length - 1; i >= 0; i--) {
        if (hour >= config.timeFactors[i].hour) {
          timeFactor = config.timeFactors[i].factor;
          break;
        }
      }
    }

    // 季节性因子
    const seasonalStrength = config.seasonalStrength || 0.3;
    const seasonalFactor = 1.0 + seasonalStrength * Math.sin((dayOfYear / 365) * 2 * Math.PI);

    // 随机波动（基于种子，确保确定性）
    const randomFactor = 0.7 + (random.next() * 0.6); // 0.7-1.3

    // 计算数值
    let value = baseValue * timeFactor * seasonalFactor * randomFactor;

    // 数据类型调整
    if (dataType === 'historical') {
      value = value * config.historicalFactor;
    } else {
      value = value * config.predictedFactor;
    }

    // 确保数值在合理范围内
    value = Math.max(0, Math.min(value, config.baseRange.max * 1.5));

    // 计算风险级别
    const risk = calculateRiskLevel(weatherType, value);

    data.push({
      date: currentTime.toISOString(),
      value: Math.round(value * 100) / 100, // 保留2位小数
      risk,
      weatherType
    });

    // 移动到下一个小时
    currentTime = addHours(currentTime, 1);
  }

  return data;
}

/**
 * 生成日级天气数据（从小时级数据累计）
 * 
 * 重要：先过滤 hourlyData 到 dateRange 范围，确保日级数据只累计用户选择范围内的数据
 * 这对于扩展数据特别重要：extendedHourlyData 可能包含扩展范围的数据，
 * 但生成日级数据时，应该只累计 dateRange 范围内的数据
 */
function generateDailyWeatherData(
  hourlyData: WeatherData[],
  dateRange: DateRange,
  weatherType: WeatherType
): WeatherData[] {
  const dailyMap = new Map<string, { 
    value: number; 
    count: number; // 用于计算平均值
    riskCounts: { low: number; medium: number; high: number } 
  }>();

  // 先过滤 hourlyData，只保留 dateRange 范围内的数据
  // 这确保了日级数据只累计用户选择范围内的数据，即使 hourlyData 包含更多数据
  const { from, to } = dateRange;
  const filteredHourlyData = hourlyData.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= from && itemDate <= to;
  });

  // 只累计过滤后的数据
  filteredHourlyData.forEach(item => {
    const date = new Date(item.date);
    const dayKey = format(startOfDay(date), 'yyyy-MM-dd');

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { value: 0, count: 0, riskCounts: { low: 0, medium: 0, high: 0 } });
    }

    const dayData = dailyMap.get(dayKey)!;
    
    // 根据天气类型决定累计方式
    if (weatherType === 'rainfall' || weatherType === 'snowfall') {
      // 累计值
      dayData.value += item.value;
    } else {
      // 其他类型（temperature, wind, humidity, pressure）使用平均值
      dayData.value = (dayData.value * dayData.count + item.value) / (dayData.count + 1);
    }
    
    // 更新计数
    dayData.count++;

    if (item.risk === 'low') dayData.riskCounts.low++;
    if (item.risk === 'medium') dayData.riskCounts.medium++;
    if (item.risk === 'high') dayData.riskCounts.high++;
  });

  const dailyData: WeatherData[] = [];
  let currentDate = startOfDay(from);
  const endDate = startOfDay(to);
  
  // 确保包含结束日期当天的数据，即使结束时间不是 00:00:00
  // 使用 addDays(endDate, 1) 作为上限（不包含），这样循环会包含结束日期当天
  const inclusiveEndDate = addDays(endDate, 1);

  while (currentDate.getTime() < inclusiveEndDate.getTime()) {
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
        value: Math.round(dayData.value * 100) / 100,
        risk,
        weatherType
      });
    } else {
      // 如果某天没有数据，添加0值
      dailyData.push({
        date: currentDate.toISOString(),
        value: 0,
        weatherType
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
  data: RegionWeatherData,
  districts: string[],
  dateRange: DateRange
): boolean {
  if (!data || Object.keys(data).length === 0) {
    return false;
  }

  for (const district of districts) {
    if (!data[district] || data[district].length === 0) {
      return false;
    }

    const districtData = data[district];
    const firstDate = new Date(districtData[0].date);
    const lastDate = new Date(districtData[districtData.length - 1].date);

    if (firstDate.getTime() > dateRange.from.getTime() || lastDate.getTime() < dateRange.to.getTime()) {
      return false;
    }
  }

  return true;
}

/**
 * Mock天气数据生成器实现
 */
export class MockWeatherDataGenerator implements WeatherDataGenerator {
  private cache: Map<string, RegionWeatherData> = new Map();

  /**
   * 生成缓存key
   * @param cacheContext 可选的缓存上下文（如产品ID），用于区分不同产品的扩展数据
   */
  private getCacheKey(
    region: Region,
    dateRange: DateRange,
    dataType: DataType,
    weatherType: WeatherType,
    cacheContext?: string
  ): string {
    const fromStr = format(dateRange.from, 'yyyy-MM-dd-HH');
    const toStr = format(dateRange.to, 'yyyy-MM-dd-HH');
    const contextPart = cacheContext ? `-ctx-${cacheContext}` : '';
    return `${region.country}-${region.province}-${weatherType}-${dataType}-${fromStr}-${toStr}${contextPart}`;
  }

  /**
   * 生成天气数据
   * @param cacheContext 可选的缓存上下文（如产品ID），用于区分不同产品的扩展数据
   */
  generate(
    region: Region,
    dateRange: DateRange,
    dataType: DataType,
    weatherType: WeatherType,
    cacheContext?: string
  ): RegionWeatherData {
    const cacheKey = this.getCacheKey(region, dateRange, dataType, weatherType, cacheContext);
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const cachedData = this.cache.get(cacheKey)!;
      const districts = getDistrictsInProvince(region);
      
      if (isDataComplete(cachedData, districts, dateRange)) {
        return cachedData;
      }
    }

    // 生成新数据
    const districts = getDistrictsInProvince(region);
    const result: RegionWeatherData = {};

    for (const district of districts) {
      const districtRegion: Region = { ...region, district };
      const regionSeed = generateRegionSeed(districtRegion, weatherType);
      const random = new SeededRandom(regionSeed);

      // 生成小时级数据
      const hourlyData = generateHourlyWeatherData(districtRegion, dateRange, dataType, weatherType, random);
      result[district] = hourlyData;
    }

    // 缓存数据
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * 检查数据是否存在
   * @param cacheContext 可选的缓存上下文（如产品ID），用于区分不同产品的扩展数据
   */
  hasData(
    region: Region,
    dateRange: DateRange,
    dataType: DataType,
    weatherType: WeatherType,
    cacheContext?: string
  ): boolean {
    const cacheKey = this.getCacheKey(region, dateRange, dataType, weatherType, cacheContext);
    
    if (!this.cache.has(cacheKey)) {
      return false;
    }

    const cachedData = this.cache.get(cacheKey)!;
    const districts = getDistrictsInProvince(region);
    
    return isDataComplete(cachedData, districts, dateRange);
  }

  /**
   * 补充缺失的数据
   * @param cacheContext 可选的缓存上下文（如产品ID），用于区分不同产品的扩展数据
   */
  supplement(
    region: Region,
    dateRange: DateRange,
    dataType: DataType,
    weatherType: WeatherType,
    existingData: RegionWeatherData,
    cacheContext?: string
  ): RegionWeatherData {
    const districts = getDistrictsInProvince(region);
    const supplemented: RegionWeatherData = { ...existingData };

    for (const district of districts) {
      if (!supplemented[district] || supplemented[district].length === 0) {
        const districtRegion: Region = { ...region, district };
        const regionSeed = generateRegionSeed(districtRegion, weatherType);
        const random = new SeededRandom(regionSeed);
        const hourlyData = generateHourlyWeatherData(districtRegion, dateRange, dataType, weatherType, random);
        supplemented[district] = hourlyData;
      }
    }

    // 更新缓存
    const cacheKey = this.getCacheKey(region, dateRange, dataType, weatherType, cacheContext);
    this.cache.set(cacheKey, supplemented);

    return supplemented;
  }

  /**
   * 获取日级数据（从小时级数据累计）
   */
  getDailyData(
    hourlyData: WeatherData[],
    dateRange: DateRange,
    weatherType: WeatherType
  ): WeatherData[] {
    return generateDailyWeatherData(hourlyData, dateRange, weatherType);
  }

  /**
   * 清除缓存
   * @param pattern 可选的匹配模式，如果提供则只清除匹配的缓存项（支持产品ID等）
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // 清除匹配模式的缓存项
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// 导出单例实例
export const weatherDataGenerator = new MockWeatherDataGenerator();

