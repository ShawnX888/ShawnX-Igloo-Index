/**
 * 行政区域数据管理模块
 * 
 * 数据来源：
 * - UI 展示和 API 调用：使用 Google 官方名称
 * - 边界和中心点：使用 GADM 数据
 * - 名称转换：通过映射表实现
 */

import { Region, AdministrativeRegion, LatLngLiteral, RegionSearchOptions } from '../types';
import { 
  REGION_HIERARCHY, 
  REGION_CENTERS,
  GADM_TO_GOOGLE,
  GOOGLE_TO_GADM,
  gadmToGoogleName,
  googleToGadmName
} from '../data/regions';
import * as gadmLoader from './gadmDataLoader';

// 重新导出，保持向后兼容
export { REGION_HIERARCHY, GADM_TO_GOOGLE, GOOGLE_TO_GADM, gadmToGoogleName, googleToGadmName };

/**
 * 获取区域中心点坐标
 * 使用 GADM 数据
 */
export async function getRegionCenter(region: Region): Promise<LatLngLiteral | null> {
  // 优先从 gadmLoader 获取
  const gadmCenter = await gadmLoader.getRegionCenter(region);
  if (gadmCenter) {
    return gadmCenter;
  }
  
  // 回退到静态 GADM 数据
  return getRegionCenterSync(region);
}

/**
 * 同步获取区域中心点
 * 支持 Google 名称或 GADM 名称
 */
export function getRegionCenterSync(region: Region): LatLngLiteral | null {
  // 先尝试直接查找
  let center = REGION_CENTERS[region.country]?.[region.province]?.[region.district];
  if (center) return center;
  
  // 尝试将 Google 名称转换为 GADM 名称
  const gadmProvince = googleToGadmName(region.province);
  const gadmDistrict = googleToGadmName(region.district);
  
  center = REGION_CENTERS[region.country]?.[gadmProvince]?.[gadmDistrict];
  if (center) return center;
  
  // 尝试只转换省份
  center = REGION_CENTERS[region.country]?.[gadmProvince]?.[region.district];
  if (center) return center;
  
  // 尝试只转换区
  center = REGION_CENTERS[region.country]?.[region.province]?.[gadmDistrict];
  return center || null;
}

/**
 * 生成简化的区域边界（矩形边界）
 */
function generateSimplifiedBoundary(center: LatLngLiteral, size: number = 0.1): LatLngLiteral[] {
  const { lat, lng } = center;
  const halfSize = size / 2;
  
  return [
    { lat: lat - halfSize, lng: lng - halfSize },
    { lat: lat - halfSize, lng: lng + halfSize },
    { lat: lat + halfSize, lng: lng + halfSize },
    { lat: lat + halfSize, lng: lng - halfSize },
    { lat: lat - halfSize, lng: lng - halfSize }
  ];
}

/**
 * 获取区域边界
 * 优先使用 GADM 真实边界数据
 */
export async function getRegionBoundary(region: Region): Promise<LatLngLiteral[]> {
  // 优先从 GADM loader 获取
  const gadmBoundary = await gadmLoader.getRegionBoundary(region);
  if (gadmBoundary && gadmBoundary.length > 0) {
    return gadmBoundary;
  }
  
  // 回退到简化边界
  return getRegionBoundarySync(region);
}

/**
 * 同步获取区域边界
 */
export function getRegionBoundarySync(region: Region): LatLngLiteral[] {
  const center = getRegionCenterSync(region);
  if (center) {
    return generateSimplifiedBoundary(center);
  }
  
  // 默认边界（雅加达）
  return generateSimplifiedBoundary({ lat: -6.2088, lng: 106.8456 });
}

/**
 * 获取完整的行政区域信息
 */
export async function getAdministrativeRegion(region: Region): Promise<AdministrativeRegion> {
  const gadmRegion = await gadmLoader.getAdministrativeRegion(region);
  if (gadmRegion) {
    return gadmRegion;
  }
  
  return getAdministrativeRegionSync(region);
}

/**
 * 同步获取行政区域信息
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
 */
export async function getAllCountries(): Promise<string[]> {
  const gadmCountries = await gadmLoader.getAllCountries();
  if (gadmCountries.length > 0) {
    return gadmCountries;
  }
  return Object.keys(REGION_HIERARCHY);
}

/**
 * 同步获取所有国家列表
 */
export function getAllCountriesSync(): string[] {
  return Object.keys(REGION_HIERARCHY);
}

/**
 * 获取指定国家下的所有省/州
 */
export async function getProvincesInCountry(country: string): Promise<string[]> {
  const gadmProvinces = await gadmLoader.getProvincesInCountry(country);
  if (gadmProvinces.length > 0) {
    return gadmProvinces;
  }
  return Object.keys(REGION_HIERARCHY[country] || {});
}

/**
 * 同步获取指定国家下的所有省/州
 */
export function getProvincesInCountrySync(country: string): string[] {
  return Object.keys(REGION_HIERARCHY[country] || {});
}

/**
 * 获取指定省/州下的所有市/区
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
 * 同步获取指定省/州下的所有市/区
 */
export function getDistrictsInProvinceByCountrySync(country: string, province: string): string[] {
  return REGION_HIERARCHY[country]?.[province] || [];
}

/**
 * 计算匹配分数（用于排序）
 */
function getMatchScore(region: AdministrativeRegion, query: string): number {
  let score = 0;
  const lowerQuery = query.toLowerCase();

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
 * 模糊搜索区域
 */
export async function searchRegions(
  query: string,
  options?: RegionSearchOptions
): Promise<AdministrativeRegion[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // 优先使用 GADM 数据搜索
  const gadmResults = await gadmLoader.searchRegions(query, options);
  if (gadmResults.length > 0) {
    return gadmResults;
  }

  return searchRegionsSync(query, options);
}

/**
 * 同步搜索区域
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

  for (const [country, provinces] of Object.entries(REGION_HIERARCHY)) {
    if (options?.country && country !== options.country) {
      continue;
    }

    const countryMatch = country.toLowerCase().includes(searchQuery);

    for (const [province, districts] of Object.entries(provinces)) {
      if (options?.province && province !== options.province) {
        continue;
      }

      const provinceMatch = province.toLowerCase().includes(searchQuery);

      for (const district of districts) {
        const districtMatch = district.toLowerCase().includes(searchQuery);

        if (countryMatch || provinceMatch || districtMatch) {
          const region: Region = { country, province, district };
          results.push(getAdministrativeRegionSync(region));
        }
      }
    }
  }

  return results.sort((a, b) => {
    const aScore = getMatchScore(a, searchQuery);
    const bScore = getMatchScore(b, searchQuery);
    return bScore - aScore;
  });
}

/**
 * 验证区域是否存在
 */
export async function isValidRegion(region: Region): Promise<boolean> {
  const gadmValid = await gadmLoader.isValidRegion(region);
  if (gadmValid) {
    return true;
  }
  
  return isValidRegionSync(region);
}

/**
 * 同步验证区域是否存在
 */
export function isValidRegionSync(region: Region): boolean {
  const districts = REGION_HIERARCHY[region.country]?.[region.province] || [];
  return districts.includes(region.district);
}

/**
 * 查找最接近的区域（用于 GPS 定位后的区域匹配）
 */
export function findClosestRegion(
  country: string,
  province?: string,
  district?: string
): Region | null {
  if (country && province && district) {
    const districts = REGION_HIERARCHY[country]?.[province] || [];
    if (districts.includes(district)) {
      return { country, province, district };
    }
  }

  if (country && province) {
    const districts = REGION_HIERARCHY[country]?.[province] || [];
    if (districts.length > 0) {
      return { country, province, district: districts[0] };
    }
  }

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
