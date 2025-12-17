/**
 * 获取 Google Maps 官方区域名称脚本
 * 
 * 功能：
 * 1. 读取 GADM hierarchy 数据
 * 2. 使用 Google Geocoding API 获取官方名称
 * 3. 生成 GADM ↔ Google 名称映射表
 * 4. 生成 Google 名称的区域层级文件
 * 
 * 使用方式：
 * npx ts-node scripts/fetchGoogleRegionNames.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Google Maps API Key（从环境变量读取）
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  console.error('Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set in environment');
  process.exit(1);
}

const GADM_DIR = path.join(__dirname, '../src/data/gadm');
const OUTPUT_DIR = path.join(__dirname, '../src/data/google');

// 国家代码映射
const COUNTRY_CODES: Record<string, string> = {
  'China': 'CN',
  'United States': 'US',
  'Indonesia': 'ID',
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Malaysia': 'MY',
  'Singapore': 'SG'
};

// GADM 文件前缀映射
const GADM_PREFIXES: Record<string, string> = {
  'China': 'chn',
  'United States': 'usa',
  'Indonesia': 'idn',
  'Thailand': 'tha',
  'Vietnam': 'vnm',
  'Malaysia': 'mys'
};

interface GeocodingResult {
  results: Array<{
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    formatted_address: string;
  }>;
  status: string;
}

interface RegionMapping {
  gadmName: string;
  googleName: string;
  formattedAddress: string;
}

interface CountryData {
  country: string;
  googleCountryName: string;
  provinces: Record<string, {
    gadmName: string;
    googleName: string;
    districts: Record<string, {
      gadmName: string;
      googleName: string;
    }>;
  }>;
}

// 延迟函数，避免 API 限流
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 调用 Google Geocoding API
async function geocode(address: string, countryCode: string): Promise<GeocodingResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('components', `country:${countryCode}`);
  url.searchParams.set('key', API_KEY!);
  url.searchParams.set('language', 'en');

  try {
    const response = await fetch(url.toString());
    const data = await response.json() as GeocodingResult;
    
    if (data.status === 'OK') {
      return data;
    } else if (data.status === 'ZERO_RESULTS') {
      console.warn(`  No results for: ${address}`);
      return null;
    } else {
      console.error(`  API error for ${address}: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`  Fetch error for ${address}:`, error);
    return null;
  }
}

// 从 Geocoding 结果中提取行政区域名称
function extractAdminName(
  result: GeocodingResult,
  adminLevel: 'administrative_area_level_1' | 'administrative_area_level_2' | 'locality'
): string | null {
  if (!result.results || result.results.length === 0) return null;
  
  const components = result.results[0].address_components;
  const component = components.find(c => c.types.includes(adminLevel));
  
  return component?.long_name || null;
}

// 读取 GADM hierarchy 文件
function readGadmHierarchy(country: string): Record<string, string[]> | null {
  const prefix = GADM_PREFIXES[country];
  if (!prefix) return null;
  
  const filePath = path.join(GADM_DIR, `${prefix}_hierarchy.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`GADM file not found: ${filePath}`);
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // GADM hierarchy 格式: { "Country": { "Province": ["District1", "District2"] } }
  return data[country] || data[Object.keys(data)[0]] || null;
}

// 读取 GADM centers 文件获取坐标
function readGadmCenters(country: string): Record<string, Record<string, { lat: number; lng: number }>> | null {
  const prefix = GADM_PREFIXES[country];
  if (!prefix) return null;
  
  const filePath = path.join(GADM_DIR, `${prefix}_centers.json`);
  if (!fs.existsSync(filePath)) return null;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  return data[country] || data[Object.keys(data)[0]] || null;
}

// 使用 Reverse Geocoding 获取官方名称（更准确）
async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', API_KEY!);
  url.searchParams.set('language', 'en');
  url.searchParams.set('result_type', 'administrative_area_level_2|administrative_area_level_1');

  try {
    const response = await fetch(url.toString());
    const data = await response.json() as GeocodingResult;
    
    if (data.status === 'OK') {
      return data;
    }
    return null;
  } catch (error) {
    console.error(`  Reverse geocode error:`, error);
    return null;
  }
}

// 处理单个国家
async function processCountry(country: string): Promise<CountryData | null> {
  console.log(`\nProcessing ${country}...`);
  
  const countryCode = COUNTRY_CODES[country];
  if (!countryCode) {
    console.warn(`  No country code for: ${country}`);
    return null;
  }
  
  const hierarchy = readGadmHierarchy(country);
  if (!hierarchy) {
    console.warn(`  No GADM data for: ${country}`);
    return null;
  }
  
  const centers = readGadmCenters(country);
  
  const countryData: CountryData = {
    country,
    googleCountryName: country,
    provinces: {}
  };
  
  const provinces = Object.keys(hierarchy);
  console.log(`  Found ${provinces.length} provinces`);
  
  for (const province of provinces) {
    const districts = hierarchy[province];
    console.log(`  Processing province: ${province} (${districts.length} districts)`);
    
    // 获取省份的 Google 名称
    let googleProvinceName = province;
    
    // 尝试使用第一个区的中心点进行反向地理编码
    if (centers && centers[province] && districts.length > 0) {
      const firstDistrict = districts[0];
      const districtCenter = centers[province][firstDistrict];
      
      if (districtCenter) {
        await delay(100); // 避免限流
        const result = await reverseGeocode(districtCenter.lat, districtCenter.lng);
        if (result) {
          const adminName = extractAdminName(result, 'administrative_area_level_1');
          if (adminName) {
            googleProvinceName = adminName;
          }
        }
      }
    }
    
    // 如果反向地理编码失败，尝试正向地理编码
    if (googleProvinceName === province) {
      await delay(100);
      const result = await geocode(`${province}, ${country}`, countryCode);
      if (result) {
        const adminName = extractAdminName(result, 'administrative_area_level_1');
        if (adminName) {
          googleProvinceName = adminName;
        }
      }
    }
    
    countryData.provinces[province] = {
      gadmName: province,
      googleName: googleProvinceName,
      districts: {}
    };
    
    // 处理区/市（限制数量以避免过多 API 调用）
    const maxDistricts = 5; // 每个省只处理前5个区作为样本
    for (let i = 0; i < Math.min(districts.length, maxDistricts); i++) {
      const district = districts[i];
      let googleDistrictName = district;
      
      if (centers && centers[province] && centers[province][district]) {
        const districtCenter = centers[province][district];
        await delay(100);
        const result = await reverseGeocode(districtCenter.lat, districtCenter.lng);
        if (result) {
          const adminName = extractAdminName(result, 'administrative_area_level_2') 
                         || extractAdminName(result, 'locality');
          if (adminName) {
            googleDistrictName = adminName;
          }
        }
      }
      
      countryData.provinces[province].districts[district] = {
        gadmName: district,
        googleName: googleDistrictName
      };
    }
    
    // 对于未处理的区，使用 GADM 名称
    for (let i = maxDistricts; i < districts.length; i++) {
      const district = districts[i];
      countryData.provinces[province].districts[district] = {
        gadmName: district,
        googleName: district // 保持原名，后续可手动补充
      };
    }
  }
  
  return countryData;
}

// 生成映射文件
function generateMappingFile(countryData: CountryData, prefix: string): void {
  const mapping: Record<string, string> = {};
  const reverseMapping: Record<string, string> = {};
  
  for (const [provinceName, province] of Object.entries(countryData.provinces)) {
    if (province.gadmName !== province.googleName) {
      mapping[province.gadmName] = province.googleName;
      reverseMapping[province.googleName] = province.gadmName;
    }
    
    for (const [districtName, district] of Object.entries(province.districts)) {
      if (district.gadmName !== district.googleName) {
        mapping[district.gadmName] = district.googleName;
        reverseMapping[district.googleName] = district.gadmName;
      }
    }
  }
  
  const outputPath = path.join(OUTPUT_DIR, `${prefix}_mapping.json`);
  fs.writeFileSync(outputPath, JSON.stringify({
    gadmToGoogle: mapping,
    googleToGadm: reverseMapping
  }, null, 2));
  
  console.log(`  Generated mapping file: ${outputPath}`);
}

// 生成 Google 名称的 hierarchy 文件
function generateGoogleHierarchy(countryData: CountryData, prefix: string): void {
  const hierarchy: Record<string, Record<string, string[]>> = {};
  
  hierarchy[countryData.googleCountryName] = {};
  
  for (const province of Object.values(countryData.provinces)) {
    const googleDistrictNames = Object.values(province.districts).map(d => d.googleName);
    hierarchy[countryData.googleCountryName][province.googleName] = googleDistrictNames;
  }
  
  const outputPath = path.join(OUTPUT_DIR, `${prefix}_hierarchy.json`);
  fs.writeFileSync(outputPath, JSON.stringify(hierarchy, null, 2));
  
  console.log(`  Generated Google hierarchy file: ${outputPath}`);
}

// 主函数
async function main(): Promise<void> {
  console.log('=== Google Region Names Fetcher ===\n');
  
  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const countries = Object.keys(GADM_PREFIXES);
  const allData: Record<string, CountryData> = {};
  
  for (const country of countries) {
    const countryData = await processCountry(country);
    if (countryData) {
      allData[country] = countryData;
      
      const prefix = GADM_PREFIXES[country];
      generateMappingFile(countryData, prefix);
      generateGoogleHierarchy(countryData, prefix);
    }
  }
  
  // 生成合并的完整数据文件
  const mergedPath = path.join(OUTPUT_DIR, 'all_regions.json');
  fs.writeFileSync(mergedPath, JSON.stringify(allData, null, 2));
  console.log(`\nGenerated merged file: ${mergedPath}`);
  
  console.log('\n=== Done ===');
}

main().catch(console.error);

