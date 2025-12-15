/**
 * 行政区域数据管理模块
 * 提供区域层级数据、边界数据、搜索和GPS转换功能
 */

import { Region, AdministrativeRegion, LatLngLiteral, RegionSearchOptions } from '../types';
import { REGION_HIERARCHY, REGION_CENTERS } from '../data/regions';

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
 */
export function getRegionCenter(region: Region): LatLngLiteral | null {
  return REGION_CENTERS[region.country]?.[region.province]?.[region.district] || null;
}

/**
 * 获取区域边界（简化边界）
 */
export function getRegionBoundary(region: Region): LatLngLiteral[] {
  const center = getRegionCenter(region);
  if (center) {
    return generateSimplifiedBoundary(center);
  }
  
  // 如果没有中心点数据，返回默认边界（雅加达）
  return generateSimplifiedBoundary({ lat: -6.2088, lng: 106.8456 });
}

/**
 * 获取完整的行政区域信息
 */
export function getAdministrativeRegion(region: Region): AdministrativeRegion {
  const center = getRegionCenter(region) || { lat: -6.2088, lng: 106.8456 };
  const boundary = getRegionBoundary(region);
  
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
export function getAllCountries(): string[] {
  return Object.keys(REGION_HIERARCHY);
}

/**
 * 获取指定国家下的所有省/州
 */
export function getProvincesInCountry(country: string): string[] {
  return Object.keys(REGION_HIERARCHY[country] || {});
}

/**
 * 获取指定省/州下的所有市/区
 */
export function getDistrictsInProvinceByCountry(country: string, province: string): string[] {
  return REGION_HIERARCHY[country]?.[province] || [];
}

/**
 * 模糊搜索区域
 * 支持按国家、省/州、市/区名称搜索
 */
export function searchRegions(
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
          results.push(getAdministrativeRegion(region));
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
 */
export function isValidRegion(region: Region): boolean {
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

