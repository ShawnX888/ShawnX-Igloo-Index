/**
 * 动画数据流工具
 * 
 * 提供通用的数据准备、验证和加载流程，支持所有动画场景：
 * - 页面初始化动画
 * - 远距离地址切换（Fly-To）
 * - 2D/3D 模式切换
 * 
 * 遵循执行流程规范：
 * 1. 数据准备（可在动画期间并行）
 * 2. 数据验证（动画完成后）
 * 3. 数据加载（验证通过后）
 */

import { Region, DateRange, DataType, WeatherType, RegionWeatherData } from '../types';
import { weatherDataGenerator } from './weatherDataGenerator';
import { ensureDataLoaded, getAdministrativeRegion } from './gadmDataLoader';
import { getDistrictsInProvince } from './regionData';

/**
 * 准备的数据结构
 */
export interface PreparedData {
  region: Region;
  regionCenter: { lat: number; lng: number } | null;
  administrativeRegion: Awaited<ReturnType<typeof getAdministrativeRegion>>;
  weatherData: RegionWeatherData;
  districts: string[];
  // 风险数据由父组件通过 props 传入，不在此处准备
}

/**
 * 数据准备选项
 */
export interface DataPreparationOptions {
  region: Region;
  dateRange: DateRange;
  dataType: DataType;
  weatherType: WeatherType;
  cacheContext?: string;
}

/**
 * 等待数据准备完成的选项
 */
export interface WaitForDataReadyOptions {
  timeout?: number; // 超时时间（毫秒），默认 5000ms
}

/**
 * 准备区域数据（包括边界、中心点等）
 */
async function prepareRegionData(region: Region): Promise<{
  regionCenter: { lat: number; lng: number } | null;
  administrativeRegion: Awaited<ReturnType<typeof getAdministrativeRegion>>;
  districts: string[];
}> {
  // 确保 GADM 数据已加载
  await ensureDataLoaded();

  // 并行获取区域数据
  const [regionCenter, administrativeRegion] = await Promise.all([
    import('./regionData').then(m => m.getRegionCenter(region)),
    getAdministrativeRegion(region),
  ]);

  // 获取区域下的所有市/区列表
  const districts = getDistrictsInProvince(region);

  return {
    regionCenter,
    administrativeRegion,
    districts,
  };
}

/**
 * 准备天气数据
 */
function prepareWeatherData(
  region: Region,
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType,
  cacheContext?: string
): RegionWeatherData {
  // 使用天气数据生成器生成数据（同步操作，使用缓存）
  return weatherDataGenerator.generate(
    region,
    dateRange,
    dataType,
    weatherType,
    cacheContext
  );
}

/**
 * 准备所有数据（并行执行）
 * 
 * 步骤4：数据准备（可在动画期间并行执行）
 */
export async function prepareData(
  options: DataPreparationOptions
): Promise<PreparedData> {
  const { region, dateRange, dataType, weatherType, cacheContext } = options;

  // 并行准备区域数据和天气数据
  const [regionData, weatherData] = await Promise.all([
    prepareRegionData(region),
    // 天气数据生成是同步的，但为了统一接口，使用 Promise.resolve
    Promise.resolve(
      prepareWeatherData(region, dateRange, dataType, weatherType, cacheContext)
    ),
  ]);

  return {
    region,
    regionCenter: regionData.regionCenter,
    administrativeRegion: regionData.administrativeRegion,
    weatherData,
    districts: regionData.districts,
  };
}

/**
 * 等待数据准备完成（带超时）
 * 
 * 步骤5：验证数据完备性 - 等待数据准备完成
 */
export async function waitForDataReady(
  dataPromise: Promise<PreparedData | null>,
  options: WaitForDataReadyOptions = {}
): Promise<PreparedData | null> {
  const { timeout = 5000 } = options;

  try {
    const result = await Promise.race([
      dataPromise,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Data preparation timeout')), timeout)
      ),
    ]);

    return result;
  } catch (error) {
    if (error instanceof Error && error.message === 'Data preparation timeout') {
      console.warn('Data preparation timeout:', timeout, 'ms');
      return null;
    }
    throw error;
  }
}

/**
 * 验证数据完备性
 * 
 * 步骤5：验证数据完备性 - 检查数据完整性
 */
export function validateDataCompleteness(
  data: PreparedData | null
): boolean {
  if (!data) {
    return false;
  }

  // 验证区域数据
  if (!data.region || !data.region.country || !data.region.province) {
    console.warn('Region data incomplete:', data.region);
    return false;
  }

  // 验证区域中心点（可选，某些区域可能没有中心点）
  // if (!data.regionCenter) {
  //   console.warn('Region center not available');
  //   return false;
  // }

  // 验证行政区域数据（边界数据）
  if (!data.administrativeRegion) {
    console.warn('Administrative region data not available');
    // 边界数据缺失不是致命错误，可以降级处理
    // return false;
  }

  // 验证天气数据
  if (!data.weatherData || Object.keys(data.weatherData).length === 0) {
    console.warn('Weather data not available');
    // 天气数据缺失不是致命错误，可以显示空数据
    // return false;
  }

  // 验证市/区列表
  if (!data.districts || data.districts.length === 0) {
    console.warn('Districts list is empty');
    // 市/区列表为空可能是正常情况（某些区域没有下级行政区）
    // return false;
  }

  // 所有关键数据都存在
  return true;
}

/**
 * 验证数据完备性（严格模式）
 * 
 * 要求所有数据都必须存在
 */
export function validateDataCompletenessStrict(
  data: PreparedData | null
): boolean {
  if (!data) {
    return false;
  }

  // 严格验证所有数据
  return (
    !!data.region &&
    !!data.region.country &&
    !!data.region.province &&
    !!data.regionCenter &&
    !!data.administrativeRegion &&
    !!data.weatherData &&
    Object.keys(data.weatherData).length > 0 &&
    !!data.districts &&
    data.districts.length > 0
  );
}

/**
 * 准备初始化数据
 * 
 * 专门用于页面初始化场景的数据准备
 */
export async function prepareInitialData(
  region: Region,
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType = 'rainfall',
  cacheContext?: string
): Promise<PreparedData> {
  return prepareData({
    region,
    dateRange,
    dataType,
    weatherType,
    cacheContext,
  });
}

