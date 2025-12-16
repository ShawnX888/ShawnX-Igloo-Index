/**
 * 行政区域数据管理模块
 * 提供区域层级数据、边界数据、搜索和GPS转换功能
 * 
 * 优先使用 GADM 真实数据，如果不可用则回退到简化数据
 */

import { Region, AdministrativeRegion, LatLngLiteral, RegionSearchOptions } from '../types';
import { REGION_HIERARCHY, REGION_CENTERS } from '../data/regions';
import * as gadmLoader from './gadmDataLoader';

// 重新导出，保持向后兼容
export { REGION_HIERARCHY };

/**
 * 生成简化的区域边界（矩形边界）
 * 实际应用中应该使用真实的GeoJSON边界数据
 */
function generateSimplifiedBoundary(center: LatLngLiteral, size: number = 0.1): LatLngLiteral[] {
  const { lat, lng } = center;
  const halfSize = size / 2;
  
  return [
    { lat: lat - halfSize, lng: lng - halfSize }, // 左下
    { lat: lat - halfSize, lng: lng + halfSize }, // 右下
    { lat: lat + halfSize, lng: lng + halfSize }, // 右上
    { lat: lat + halfSize, lng: lng - halfSize }, // 左上
    { lat: lat - halfSize, lng: lng - halfSize }  // 闭合
  ];
}

/**
 * 获取区域中心点坐标
 * 优先使用 GADM 数据，如果不可用则使用静态数据
 */
export async function getRegionCenter(region: Region): Promise<LatLngLiteral | null> {
  // 优先尝试从 GADM 数据获取
  const gadmCenter = await gadmLoader.getRegionCenter(region);
  if (gadmCenter) {
    return gadmCenter;
  }
  
  // 回退到静态数据
  return REGION_CENTERS[region.country]?.[region.province]?.[region.district] || null;
}

/**
 * 同步版本（保持向后兼容，使用静态数据）
 */
export function getRegionCenterSync(region: Region): LatLngLiteral | null {
  return REGION_CENTERS[region.country]?.[region.province]?.[region.district] || null;
}

/**
 * 获取区域边界
 * 优先使用 GADM 真实边界数据，如果不可用则使用简化边界
 */
export async function getRegionBoundary(region: Region): Promise<LatLngLiteral[]> {
  // 优先尝试从 GADM 数据获取真实边界
  const gadmBoundary = await gadmLoader.getRegionBoundary(region);
  if (gadmBoundary && gadmBoundary.length > 0) {
    return gadmBoundary;
  }
  
  // 回退到简化边界
  const center = getRegionCenterSync(region);
  if (center) {
    return generateSimplifiedBoundary(center);
  }
  
  // 如果没有中心点数据，返回默认边界（雅加达）
  return generateSimplifiedBoundary({ lat: -6.2088, lng: 106.8456 });
}

/**
 * 同步版本（保持向后兼容，使用简化边界）
 */
export function getRegionBoundarySync(region: Region): LatLngLiteral[] {
  const center = getRegionCenterSync(region);
  if (center) {
    return generateSimplifiedBoundary(center);
  }
  
  return generateSimplifiedBoundary({ lat: -6.2088, lng: 106.8456 });
}

/**
 * 获取完整的行政区域信息
 * 优先使用 GADM 数据，如果不可用则使用简化数据
 */
export async function getAdministrativeRegion(region: Region): Promise<AdministrativeRegion> {
  // 优先尝试从 GADM 数据获取
  const gadmRegion = await gadmLoader.getAdministrativeRegion(region);
  if (gadmRegion) {
    return gadmRegion;
  }
  
  // 回退到简化数据
  const center = getRegionCenterSync(region) || { lat: -6.2088, lng: 106.8456 };
  const boundary = getRegionBoundarySync(region);
  
  return {
    ...region,
    center,
    boundary
  };
}

/**
 * 同步版本（保持向后兼容）
 */
export function getAdministrativeRegionSync(region: Region): AdministrativeRegion {
  const center = getRegionCenterSync(region) || { lat: -6.2088, lng: 106.8456 };
  const boundary = getRegionBoundarySync(region);
  
  return {
    ...region,
    center,
    boundary
  };
}

/**
 * 获取同一省/州下的所有市/区
 */
export function getDistrictsInProvince(region: Region): string[] {
  const districts = REGION_HIERARCHY[region.country]?.[region.province] || [];
  if (districts.length === 0) {
    return [region.district];
  }
  if (!districts.includes(region.district)) {
    districts.push(region.district);
  }
  return districts;
}

/**
 * 获取所有国家列表
 * 优先使用 GADM 数据，如果不可用则使用静态数据
 */
export async function getAllCountries(): Promise<string[]> {
  const gadmCountries = await gadmLoader.getAllCountries();
  if (gadmCountries.length > 0) {
    return gadmCountries;
  }
  return Object.keys(REGION_HIERARCHY);
}

/**
 * 同步版本（保持向后兼容）
 */
export function getAllCountriesSync(): string[] {
  return Object.keys(REGION_HIERARCHY);
}

/**
 * 获取指定国家下的所有省/州
 * 优先使用 GADM 数据，如果不可用则使用静态数据
 */
export async function getProvincesInCountry(country: string): Promise<string[]> {
  const gadmProvinces = await gadmLoader.getProvincesInCountry(country);
  if (gadmProvinces.length > 0) {
    return gadmProvinces;
  }
  return Object.keys(REGION_HIERARCHY[country] || {});
}

/**
 * 同步版本（保持向后兼容）
 */
export function getProvincesInCountrySync(country: string): string[] {
  return Object.keys(REGION_HIERARCHY[country] || {});
}

/**
 * 获取指定省/州下的所有市/区
 * 优先使用 GADM 数据，如果不可用则使用静态数据
 */
export async function getDistrictsInProvinceByCountry(
  country: string,
  province: string
): Promise<string[]> {
  const gadmDistricts = await gadmLoader.getDistrictsInProvince(country, province);
  if (gadmDistricts.length > 0) {
    return gadmDistricts;
  }
  return REGION_HIERARCHY[country]?.[province] || [];
}

/**
 * 同步版本（保持向后兼容）
 */
export function getDistrictsInProvinceByCountrySync(country: string, province: string): string[] {
  return REGION_HIERARCHY[country]?.[province] || [];
}

/**
 * 模糊搜索区域
 * 支持按国家、省/州、市/区名称搜索
 * 优先使用 GADM 数据，如果不可用则使用静态数据
 */
export async function searchRegions(
  query: string,
  options?: RegionSearchOptions
): Promise<AdministrativeRegion[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // 优先尝试使用 GADM 数据搜索
  const gadmResults = await gadmLoader.searchRegions(query, options);
  if (gadmResults.length > 0) {
    return gadmResults;
  }

  // 回退到静态数据搜索
  const searchQuery = query.toLowerCase().trim();
  const results: AdministrativeRegion[] = [];

  // 遍历所有区域
  for (const [country, provinces] of Object.entries(REGION_HIERARCHY)) {
    // 国家过滤
    if (options?.country && country !== options.country) {
      continue;
    }

    // 检查国家名称是否匹配
    const countryMatch = country.toLowerCase().includes(searchQuery);

    for (const [province, districts] of Object.entries(provinces)) {
      // 省/州过滤
      if (options?.province && province !== options.province) {
        continue;
      }

      // 检查省/州名称是否匹配
      const provinceMatch = province.toLowerCase().includes(searchQuery);

      for (const district of districts) {
        // 检查市/区名称是否匹配
        const districtMatch = district.toLowerCase().includes(searchQuery);

        // 如果任何层级匹配，添加到结果
        if (countryMatch || provinceMatch || districtMatch) {
          const region: Region = { country, province, district };
          results.push(getAdministrativeRegionSync(region));
        }
      }
    }
  }

  // 按匹配度排序（精确匹配优先）
  return results.sort((a, b) => {
    const aScore = getMatchScore(a, searchQuery);
    const bScore = getMatchScore(b, searchQuery);
    return bScore - aScore;
  });
}

/**
 * 同步版本（保持向后兼容）
 */
export function searchRegionsSync(
  query: string,
  options?: RegionSearchOptions
): AdministrativeRegion[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchQuery = query.toLowerCase().trim();
  const results: AdministrativeRegion[] = [];

  // 遍历所有区域
  for (const [country, provinces] of Object.entries(REGION_HIERARCHY)) {
    // 国家过滤
    if (options?.country && country !== options.country) {
      continue;
    }

    // 检查国家名称是否匹配
    const countryMatch = country.toLowerCase().includes(searchQuery);

    for (const [province, districts] of Object.entries(provinces)) {
      // 省/州过滤
      if (options?.province && province !== options.province) {
        continue;
      }

      // 检查省/州名称是否匹配
      const provinceMatch = province.toLowerCase().includes(searchQuery);

      for (const district of districts) {
        // 检查市/区名称是否匹配
        const districtMatch = district.toLowerCase().includes(searchQuery);

        // 如果任何层级匹配，添加到结果
        if (countryMatch || provinceMatch || districtMatch) {
          const region: Region = { country, province, district };
          results.push(getAdministrativeRegionSync(region));
        }
      }
    }
  }

  // 按匹配度排序（精确匹配优先）
  return results.sort((a, b) => {
    const aScore = getMatchScore(a, searchQuery);
    const bScore = getMatchScore(b, searchQuery);
    return bScore - aScore;
  });
}

/**
 * 计算匹配分数（用于排序）
 */
function getMatchScore(region: AdministrativeRegion, query: string): number {
  let score = 0;
  const lowerQuery = query.toLowerCase();

  // 精确匹配得分最高
  if (region.district.toLowerCase() === lowerQuery) score += 100;
  else if (region.district.toLowerCase().startsWith(lowerQuery)) score += 50;
  else if (region.district.toLowerCase().includes(lowerQuery)) score += 25;

  if (region.province.toLowerCase() === lowerQuery) score += 30;
  else if (region.province.toLowerCase().includes(lowerQuery)) score += 15;

  if (region.country.toLowerCase() === lowerQuery) score += 20;
  else if (region.country.toLowerCase().includes(lowerQuery)) score += 10;

  return score;
}

/**
 * 验证区域是否存在
 * 优先使用 GADM 数据，如果不可用则使用静态数据
 */
export async function isValidRegion(region: Region): Promise<boolean> {
  const gadmValid = await gadmLoader.isValidRegion(region);
  if (gadmValid) {
    return true;
  }
  
  const districts = REGION_HIERARCHY[region.country]?.[region.province] || [];
  return districts.includes(region.district);
}

/**
 * 同步版本（保持向后兼容）
 */
export function isValidRegionSync(region: Region): boolean {
  const districts = REGION_HIERARCHY[region.country]?.[region.province] || [];
  return districts.includes(region.district);
}

/**
 * 查找最接近的区域（用于GPS定位后的区域匹配）
 */
export function findClosestRegion(
  country: string,
  province?: string,
  district?: string
): Region | null {
  // 如果所有信息都匹配，直接返回
  if (country && province && district) {
    const districts = REGION_HIERARCHY[country]?.[province] || [];
    if (districts.includes(district)) {
      return { country, province, district };
    }
  }

  // 如果只有国家和省/州匹配
  if (country && province) {
    const districts = REGION_HIERARCHY[country]?.[province] || [];
    if (districts.length > 0) {
      return { country, province, district: districts[0] };
    }
  }

  // 如果只有国家匹配
  if (country) {
    const provinces = Object.keys(REGION_HIERARCHY[country] || {});
    if (provinces.length > 0) {
      const districts = REGION_HIERARCHY[country][provinces[0]] || [];
      if (districts.length > 0) {
        return { country, province: provinces[0], district: districts[0] };
      }
    }
  }

  return null;
}

