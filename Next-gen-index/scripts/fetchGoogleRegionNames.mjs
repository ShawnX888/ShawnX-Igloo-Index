/**
 * 获取 Google Maps 官方区域名称脚本
 * 
 * 使用方式：
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key node scripts/fetchGoogleRegionNames.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google Maps API Key
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  console.error('Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set');
  console.error('Usage: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key node scripts/fetchGoogleRegionNames.mjs');
  process.exit(1);
}

const GADM_DIR = path.join(__dirname, '../src/data/gadm');
const OUTPUT_DIR = path.join(__dirname, '../src/data/google');

// GADM 文件前缀映射
const GADM_PREFIXES = {
  'China': 'chn',
  'United States': 'usa',
  'Indonesia': 'idn',
  'Thailand': 'tha',
  'Vietnam': 'vnm',
  'Malaysia': 'mys'
};

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Reverse Geocoding
async function reverseGeocode(lat, lng) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('language', 'en');

  try {
    const response = await fetch(url.toString());
    return await response.json();
  } catch (error) {
    console.error(`  Error:`, error.message);
    return null;
  }
}

// 提取行政区名称
function extractAdminNames(result) {
  if (!result || result.status !== 'OK' || !result.results?.length) {
    return { level1: null, level2: null, locality: null };
  }
  
  const components = result.results[0].address_components;
  
  return {
    level1: components.find(c => c.types.includes('administrative_area_level_1'))?.long_name,
    level2: components.find(c => c.types.includes('administrative_area_level_2'))?.long_name,
    locality: components.find(c => c.types.includes('locality'))?.long_name
  };
}

// 读取 GADM 文件
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 处理单个国家
async function processCountry(country) {
  const prefix = GADM_PREFIXES[country];
  if (!prefix) return null;
  
  console.log(`\n=== Processing ${country} ===`);
  
  const hierarchyPath = path.join(GADM_DIR, `${prefix}_hierarchy.json`);
  const centersPath = path.join(GADM_DIR, `${prefix}_centers.json`);
  
  const hierarchyData = readJsonFile(hierarchyPath);
  const centersData = readJsonFile(centersPath);
  
  if (!hierarchyData || !centersData) {
    console.warn(`  Missing data files for ${country}`);
    return null;
  }
  
  const hierarchy = hierarchyData[country] || hierarchyData[Object.keys(hierarchyData)[0]];
  const centers = centersData[country] || centersData[Object.keys(centersData)[0]];
  
  if (!hierarchy || !centers) {
    console.warn(`  No data found for ${country}`);
    return null;
  }
  
  const gadmToGoogle = {};
  const googleToGadm = {};
  const googleHierarchy = {};
  
  const provinces = Object.keys(hierarchy);
  console.log(`  Found ${provinces.length} provinces`);
  
  for (const province of provinces) {
    const districts = hierarchy[province];
    const provinceCenters = centers[province];
    
    if (!provinceCenters || !districts.length) {
      console.log(`  Skipping ${province} - no center data`);
      googleHierarchy[province] = districts;
      continue;
    }
    
    // 获取省级 Google 名称（使用第一个区的中心点）
    const firstDistrict = districts[0];
    const firstCenter = provinceCenters[firstDistrict];
    
    let googleProvinceName = province;
    let googleDistrictNames = {};
    
    if (firstCenter) {
      await delay(150);
      const result = await reverseGeocode(firstCenter.lat, firstCenter.lng);
      const names = extractAdminNames(result);
      
      if (names.level1 && names.level1 !== province) {
        googleProvinceName = names.level1;
        gadmToGoogle[province] = googleProvinceName;
        googleToGadm[googleProvinceName] = province;
        console.log(`  Province: ${province} -> ${googleProvinceName}`);
      }
      
      // 获取第一个区的名称
      const districtName = names.level2 || names.locality;
      if (districtName && districtName !== firstDistrict) {
        googleDistrictNames[firstDistrict] = districtName;
        gadmToGoogle[firstDistrict] = districtName;
        googleToGadm[districtName] = firstDistrict;
      }
    }
    
    // 抽样获取其他区的名称（每5个取1个）
    for (let i = 1; i < districts.length; i += 5) {
      const district = districts[i];
      const center = provinceCenters[district];
      
      if (center) {
        await delay(150);
        const result = await reverseGeocode(center.lat, center.lng);
        const names = extractAdminNames(result);
        
        const districtName = names.level2 || names.locality;
        if (districtName && districtName !== district) {
          googleDistrictNames[district] = districtName;
          gadmToGoogle[district] = districtName;
          googleToGadm[districtName] = district;
          console.log(`    District: ${district} -> ${districtName}`);
        }
      }
    }
    
    // 构建 Google 名称的 hierarchy
    const googleDistrictList = districts.map(d => googleDistrictNames[d] || d);
    googleHierarchy[googleProvinceName] = googleDistrictList;
  }
  
  return {
    country,
    gadmToGoogle,
    googleToGadm,
    googleHierarchy
  };
}

// 主函数
async function main() {
  console.log('=== Google Region Names Fetcher ===');
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const allMappings = { gadmToGoogle: {}, googleToGadm: {} };
  const allHierarchies = {};
  
  for (const country of Object.keys(GADM_PREFIXES)) {
    const result = await processCountry(country);
    
    if (result) {
      const prefix = GADM_PREFIXES[country];
      
      // 保存单个国家的映射
      const mappingPath = path.join(OUTPUT_DIR, `${prefix}_mapping.json`);
      fs.writeFileSync(mappingPath, JSON.stringify({
        gadmToGoogle: result.gadmToGoogle,
        googleToGadm: result.googleToGadm
      }, null, 2));
      console.log(`  Saved: ${mappingPath}`);
      
      // 保存单个国家的 Google hierarchy
      const hierarchyPath = path.join(OUTPUT_DIR, `${prefix}_google_hierarchy.json`);
      fs.writeFileSync(hierarchyPath, JSON.stringify({
        [country]: result.googleHierarchy
      }, null, 2));
      console.log(`  Saved: ${hierarchyPath}`);
      
      // 合并到总数据
      Object.assign(allMappings.gadmToGoogle, result.gadmToGoogle);
      Object.assign(allMappings.googleToGadm, result.googleToGadm);
      allHierarchies[country] = result.googleHierarchy;
    }
  }
  
  // 保存合并数据
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'merged_mapping.json'),
    JSON.stringify(allMappings, null, 2)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'merged_google_hierarchy.json'),
    JSON.stringify(allHierarchies, null, 2)
  );
  
  console.log('\n=== Done ===');
}

main().catch(console.error);

