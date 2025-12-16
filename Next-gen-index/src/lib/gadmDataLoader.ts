/**
 * GADM 数据加载器
 * 负责加载和缓存转换后的 GADM 行政区域数据
 */

import { Region, AdministrativeRegion, LatLngLiteral } from '../types';

// 类型定义
interface ConvertedRegion {
  country: string;
  province: string;
  district: string;
  center: LatLngLiteral;
  boundary: LatLngLiteral[];
  localNames?: {
    province?: string;
    district?: string;
  };
}

interface RegionIndex {
  [country: string]: {
    [province: string]: {
      [district: string]: ConvertedRegion;
    };
  };
}

interface RegionHierarchy {
  [country: string]: {
    [province: string]: string[];
  };
}

interface RegionCenters {
  [country: string]: {
    [province: string]: {
      [district: string]: LatLngLiteral;
    };
  };
}

// 数据缓存
let cachedIndex: RegionIndex | null = null;
let cachedHierarchy: RegionHierarchy | null = null;
let cachedCenters: RegionCenters | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * 加载合并后的 GADM 数据
 */
async function loadGADMData(): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // 动态导入 JSON 数据
      const [indexData, hierarchyData, centersData] = await Promise.all([
        import('../data/gadm/merged_index.json'),
        import('../data/gadm/merged_hierarchy.json'),
        import('../data/gadm/merged_centers.json'),
      ]);

      cachedIndex = indexData.default as RegionIndex;
      cachedHierarchy = hierarchyData.default as RegionHierarchy;
      cachedCenters = centersData.default as RegionCenters;
    } catch (error) {
      console.error('Failed to load GADM data:', error);
      // 如果加载失败，使用空数据
      cachedIndex = {};
      cachedHierarchy = {};
      cachedCenters = {};
    }
  })();

  return loadPromise;
}

/**
 * 确保数据已加载
 */
async function ensureDataLoaded(): Promise<void> {
  if (!cachedIndex || !cachedHierarchy || !cachedCenters) {
    await loadGADMData();
  }
}

/**
 * 获取区域边界数据
 */
export async function getRegionBoundary(region: Region): Promise<LatLngLiteral[]> {
  await ensureDataLoaded();
  
  if (!cachedIndex) {
    return [];
  }

  const converted = cachedIndex[region.country]?.[region.province]?.[region.district];
  return converted?.boundary || [];
}

/**
 * 获取区域中心点
 */
export async function getRegionCenter(region: Region): Promise<LatLngLiteral | null> {
  await ensureDataLoaded();
  
  if (!cachedCenters) {
    return null;
  }

  return cachedCenters[region.country]?.[region.province]?.[region.district] || null;
}

/**
 * 获取完整的行政区域信息
 */
export async function getAdministrativeRegion(region: Region): Promise<AdministrativeRegion | null> {
  await ensureDataLoaded();
  
  if (!cachedIndex) {
    return null;
  }

  const converted = cachedIndex[region.country]?.[region.province]?.[region.district];
  if (!converted) {
    return null;
  }

  return {
    country: converted.country,
    province: converted.province,
    district: converted.district,
    center: converted.center,
    boundary: converted.boundary,
  };
}

/**
 * 获取区域层级关系
 */
export async function getRegionHierarchy(): Promise<RegionHierarchy> {
  await ensureDataLoaded();
  return cachedHierarchy || {};
}

/**
 * 获取所有国家列表
 */
export async function getAllCountries(): Promise<string[]> {
  await ensureDataLoaded();
  return Object.keys(cachedHierarchy || {});
}

/**
 * 获取指定国家下的所有省/州
 */
export async function getProvincesInCountry(country: string): Promise<string[]> {
  await ensureDataLoaded();
  return Object.keys(cachedHierarchy?.[country] || {});
}

/**
 * 获取指定省/州下的所有市/区
 */
export async function getDistrictsInProvince(
  country: string,
  province: string
): Promise<string[]> {
  await ensureDataLoaded();
  return cachedHierarchy?.[country]?.[province] || [];
}

/**
 * 验证区域是否存在
 */
export async function isValidRegion(region: Region): Promise<boolean> {
  await ensureDataLoaded();
  const districts = cachedHierarchy?.[region.country]?.[region.province] || [];
  return districts.includes(region.district);
}

/**
 * 搜索区域（支持模糊匹配）
 */
export async function searchRegions(
  query: string,
  options?: { country?: string; province?: string }
): Promise<AdministrativeRegion[]> {
  await ensureDataLoaded();
  
  if (!query || query.trim().length === 0 || !cachedIndex) {
    return [];
  }

  const searchQuery = query.toLowerCase().trim();
  const results: AdministrativeRegion[] = [];

  for (const [country, provinces] of Object.entries(cachedIndex)) {
    // 国家过滤
    if (options?.country && country !== options.country) {
      continue;
    }

    const countryMatch = country.toLowerCase().includes(searchQuery);

    for (const [province, districts] of Object.entries(provinces)) {
      // 省/州过滤
      if (options?.province && province !== options.province) {
        continue;
      }

      const provinceMatch = province.toLowerCase().includes(searchQuery);

      for (const [district, regionData] of Object.entries(districts)) {
        const districtMatch = district.toLowerCase().includes(searchQuery);
        
        // 检查本地语言名称
        const localProvinceMatch = regionData.localNames?.province
          ?.toLowerCase()
          .includes(searchQuery);
        const localDistrictMatch = regionData.localNames?.district
          ?.toLowerCase()
          .includes(searchQuery);

        if (countryMatch || provinceMatch || districtMatch || localProvinceMatch || localDistrictMatch) {
          results.push({
            country: regionData.country,
            province: regionData.province,
            district: regionData.district,
            center: regionData.center,
            boundary: regionData.boundary,
          });
        }
      }
    }
  }

  // 按匹配度排序
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
 * 预加载数据（可选，用于提前加载）
 */
export function preloadGADMData(): Promise<void> {
  return loadGADMData();
}

