/**
 * GADM GeoJSON 数据转换脚本
 * 将 GADM 格式的 GeoJSON 数据转换为应用所需的格式
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 类型定义
interface GADMFeature {
  type: "Feature";
  properties: {
    GID_0: string;      // 国家代码
    GID_1: string;      // 省/州代码
    GID_2: string;      // 市/区代码
    COUNTRY: string;    // 国家名称（英文）
    NAME_1?: string;    // 省/州名称（英文）
    NAME_2?: string;    // 市/区名称（英文）
    NL_NAME_1?: string; // 省/州名称（本地语言）
    NL_NAME_2?: string; // 市/区名称（本地语言）
    TYPE_2?: string;    // 市/区类型
    ENGTYPE_2?: string; // 市/区类型（英文）
  };
  geometry: {
    type: "MultiPolygon";
    coordinates: number[][][][]; // [lng, lat] 格式
  };
}

interface GADMFeatureCollection {
  type: "FeatureCollection";
  name: string;
  features: GADMFeature[];
}

interface LatLngLiteral {
  lat: number;
  lng: number;
}

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

/**
 * 转换坐标格式：[lng, lat] -> { lat, lng }
 */
function convertCoordinates(coords: number[][]): LatLngLiteral[] {
  return coords.map(([lng, lat]) => ({ lat, lng }));
}

/**
 * 计算多边形面积（用于选择最大多边形）
 */
function calculatePolygonArea(coordinates: LatLngLiteral[]): number {
  if (coordinates.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    area += coordinates[i].lng * coordinates[j].lat;
    area -= coordinates[j].lng * coordinates[i].lat;
  }
  return Math.abs(area / 2);
}

/**
 * 计算多边形中心点（质心）
 */
function calculateCentroid(coordinates: LatLngLiteral[]): LatLngLiteral {
  if (coordinates.length === 0) {
    return { lat: 0, lng: 0 };
  }
  
  // 简单平均（对于复杂多边形，应该使用加权质心）
  let sumLat = 0;
  let sumLng = 0;
  const count = coordinates.length;
  
  coordinates.forEach(({ lat, lng }) => {
    sumLat += lat;
    sumLng += lng;
  });
  
  return {
    lat: sumLat / count,
    lng: sumLng / count
  };
}

/**
 * 处理 MultiPolygon，选择最大多边形或合并所有多边形
 */
function processMultiPolygon(coordinates: number[][][][]): LatLngLiteral[] {
  if (coordinates.length === 0) {
    return [];
  }
  
  // 转换所有多边形并计算面积
  const polygons: { coords: LatLngLiteral[]; area: number }[] = [];
  
  for (const polygon of coordinates) {
    if (polygon.length === 0) continue;
    
    // 取第一个环（外环）
    const outerRing = polygon[0];
    const converted = convertCoordinates(outerRing);
    const area = calculatePolygonArea(converted);
    
    polygons.push({ coords: converted, area });
  }
  
  if (polygons.length === 0) {
    return [];
  }
  
  // 选择面积最大的多边形
  const largest = polygons.reduce((max, poly) => 
    poly.area > max.area ? poly : max
  );
  
  return largest.coords;
}

/**
 * 标准化国家名称
 */
function normalizeCountryName(country: string): string {
  const mapping: Record<string, string> = {
    'China': 'China',
    'UnitedStates': 'United States',
    'Indonesia': 'Indonesia',
    'Thailand': 'Thailand',
    'VietNam': 'Vietnam',
    'Vietnam': 'Vietnam',
    'Malaysia': 'Malaysia',
  };
  
  return mapping[country] || country;
}

/**
 * 提取本地语言名称（处理可能的多个名称，用 | 分隔）
 */
function extractLocalName(nlName?: string): string | undefined {
  if (!nlName || nlName === 'NA') return undefined;
  // 如果有多个名称，取第一个
  return nlName.split('|')[0].trim();
}

/**
 * 转换单个 GADM Feature
 */
function convertFeature(feature: GADMFeature): ConvertedRegion | null {
  const { properties, geometry } = feature;
  
  // 验证必需字段
  if (!properties.GID_0 || !properties.GID_1 || !properties.GID_2) {
    console.warn(`Skipping feature with missing GID: ${JSON.stringify(properties)}`);
    return null;
  }
  
  const country = normalizeCountryName(properties.COUNTRY);
  const province = properties.NAME_1 || 'Unknown';
  const district = properties.NAME_2 || 'Unknown';
  
  // 处理边界坐标
  const boundary = processMultiPolygon(geometry.coordinates);
  if (boundary.length === 0) {
    console.warn(`Skipping feature with empty boundary: ${country}/${province}/${district}`);
    return null;
  }
  
  // 计算中心点
  const center = calculateCentroid(boundary);
  
  // 提取本地语言名称
  const localProvince = extractLocalName(properties.NL_NAME_1);
  const localDistrict = extractLocalName(properties.NL_NAME_2);
  
  return {
    country,
    province,
    district,
    center,
    boundary,
    localNames: (localProvince || localDistrict) ? {
      province: localProvince,
      district: localDistrict,
    } : undefined,
  };
}

/**
 * 转换 GADM FeatureCollection
 */
function convertGADMData(featureCollection: GADMFeatureCollection): {
  regions: ConvertedRegion[];
  index: RegionIndex;
  hierarchy: RegionHierarchy;
  centers: RegionCenters;
} {
  const regions: ConvertedRegion[] = [];
  const index: RegionIndex = {};
  const hierarchy: RegionHierarchy = {};
  const centers: RegionCenters = {};
  
  let processedCount = 0;
  let skippedCount = 0;
  
  for (const feature of featureCollection.features) {
    const converted = convertFeature(feature);
    
    if (!converted) {
      skippedCount++;
      continue;
    }
    
    regions.push(converted);
    processedCount++;
    
    // 构建索引
    if (!index[converted.country]) {
      index[converted.country] = {};
    }
    if (!index[converted.country][converted.province]) {
      index[converted.country][converted.province] = {};
    }
    index[converted.country][converted.province][converted.district] = converted;
    
    // 构建层级关系
    if (!hierarchy[converted.country]) {
      hierarchy[converted.country] = {};
    }
    if (!hierarchy[converted.country][converted.province]) {
      hierarchy[converted.country][converted.province] = [];
    }
    if (!hierarchy[converted.country][converted.province].includes(converted.district)) {
      hierarchy[converted.country][converted.province].push(converted.district);
    }
    
    // 构建中心点索引
    if (!centers[converted.country]) {
      centers[converted.country] = {};
    }
    if (!centers[converted.country][converted.province]) {
      centers[converted.country][converted.province] = {};
    }
    centers[converted.country][converted.province][converted.district] = converted.center;
  }
  
  console.log(`Processed: ${processedCount}, Skipped: ${skippedCount}`);
  
  return { regions, index, hierarchy, centers };
}

/**
 * 处理单个国家文件
 */
function processCountryFile(countryCode: string, inputDir: string, outputDir: string): void {
  const inputFile = join(inputDir, `${countryCode}.json`);
  const outputBase = join(outputDir, countryCode.toLowerCase());
  
  console.log(`\nProcessing ${countryCode}...`);
  console.log(`Reading from: ${inputFile}`);
  
  try {
    const rawData = readFileSync(inputFile, 'utf-8');
    const featureCollection: GADMFeatureCollection = JSON.parse(rawData);
    
    console.log(`Found ${featureCollection.features.length} features`);
    
    const { regions, index, hierarchy, centers } = convertGADMData(featureCollection);
    
    // 确保输出目录存在
    mkdirSync(outputDir, { recursive: true });
    
    // 保存转换后的数据
    const regionsFile = `${outputBase}_regions.json`;
    const indexFile = `${outputBase}_index.json`;
    const hierarchyFile = `${outputBase}_hierarchy.json`;
    const centersFile = `${outputBase}_centers.json`;
    
    writeFileSync(regionsFile, JSON.stringify(regions, null, 2));
    writeFileSync(indexFile, JSON.stringify(index, null, 2));
    writeFileSync(hierarchyFile, JSON.stringify(hierarchy, null, 2));
    writeFileSync(centersFile, JSON.stringify(centers, null, 2));
    
    console.log(`✓ Saved to:`);
    console.log(`  - ${regionsFile} (${regions.length} regions)`);
    console.log(`  - ${indexFile}`);
    console.log(`  - ${hierarchyFile}`);
    console.log(`  - ${centersFile}`);
    
  } catch (error) {
    console.error(`Error processing ${countryCode}:`, error);
    throw error;
  }
}

/**
 * 合并所有国家的数据
 */
function mergeAllCountries(outputDir: string, countryCodes: string[]): void {
  console.log(`\nMerging all countries...`);
  
  const mergedIndex: RegionIndex = {};
  const mergedHierarchy: RegionHierarchy = {};
  const mergedCenters: RegionCenters = {};
  
  for (const code of countryCodes) {
    const base = code.toLowerCase();
    const indexFile = join(outputDir, `${base}_index.json`);
    const hierarchyFile = join(outputDir, `${base}_hierarchy.json`);
    const centersFile = join(outputDir, `${base}_centers.json`);
    
    try {
      const index: RegionIndex = JSON.parse(readFileSync(indexFile, 'utf-8'));
      const hierarchy: RegionHierarchy = JSON.parse(readFileSync(hierarchyFile, 'utf-8'));
      const centers: RegionCenters = JSON.parse(readFileSync(centersFile, 'utf-8'));
      
      // 合并数据
      Object.assign(mergedIndex, index);
      Object.assign(mergedHierarchy, hierarchy);
      Object.assign(mergedCenters, centers);
      
    } catch (error) {
      console.warn(`Warning: Could not merge ${code}:`, error);
    }
  }
  
  // 保存合并后的数据
  const mergedIndexFile = join(outputDir, 'merged_index.json');
  const mergedHierarchyFile = join(outputDir, 'merged_hierarchy.json');
  const mergedCentersFile = join(outputDir, 'merged_centers.json');
  
  writeFileSync(mergedIndexFile, JSON.stringify(mergedIndex, null, 2));
  writeFileSync(mergedHierarchyFile, JSON.stringify(mergedHierarchy, null, 2));
  writeFileSync(mergedCentersFile, JSON.stringify(mergedCenters, null, 2));
  
  console.log(`✓ Merged data saved to:`);
  console.log(`  - ${mergedIndexFile}`);
  console.log(`  - ${mergedHierarchyFile}`);
  console.log(`  - ${mergedCentersFile}`);
}

/**
 * 主函数
 */
function main() {
  const projectRoot = join(__dirname, '..');
  const inputDir = join(projectRoot, 'gadm_geojson_data');
  const outputDir = join(projectRoot, 'Next-gen-index', 'src', 'data', 'gadm');
  
  // 要处理的国家代码
  const countryCodes = ['CHN', 'USA', 'IDN', 'THA', 'VNM', 'MYS'];
  
  console.log('GADM Data Converter');
  console.log('===================');
  console.log(`Input directory: ${inputDir}`);
  console.log(`Output directory: ${outputDir}`);
  
  // 处理每个国家
  for (const code of countryCodes) {
    processCountryFile(code, inputDir, outputDir);
  }
  
  // 合并所有国家数据
  mergeAllCountries(outputDir, countryCodes);
  
  console.log('\n✓ Conversion completed!');
}

// 运行主函数
main();

