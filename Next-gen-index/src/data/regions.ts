/**
 * 区域数据配置文件
 * 
 * 数据来源：
 * - 区域名称：Google Maps Geocoding API（用于 UI 和外部 API 调用）
 * - 中心点坐标：GADM 数据（xxx_centers.json）
 * - 边界数据：GADM 数据（xxx_index.json）
 * - 名称映射：GADM ↔ Google（xxx_mapping.json）
 * 
 * 注意：此文件仅提供数据导入和类型定义
 * 实际数据存储在 src/data/gadm/ 和 src/data/google/ 目录
 */

// 导入 Google 名称的区域层级数据
import chnGoogleHierarchy from './google/chn_google_hierarchy.json';
import usaGoogleHierarchy from './google/usa_google_hierarchy.json';
import idnGoogleHierarchy from './google/idn_google_hierarchy.json';
import thaGoogleHierarchy from './google/tha_google_hierarchy.json';
import vnmGoogleHierarchy from './google/vnm_google_hierarchy.json';
import mysGoogleHierarchy from './google/mys_google_hierarchy.json';

// 导入名称映射
import chnMapping from './google/chn_mapping.json';
import usaMapping from './google/usa_mapping.json';
import idnMapping from './google/idn_mapping.json';
import thaMapping from './google/tha_mapping.json';
import vnmMapping from './google/vnm_mapping.json';
import mysMapping from './google/mys_mapping.json';

// 导入 GADM 中心点数据
import chnCenters from './gadm/chn_centers.json';
import usaCenters from './gadm/usa_centers.json';
import idnCenters from './gadm/idn_centers.json';
import thaCenters from './gadm/tha_centers.json';
import vnmCenters from './gadm/vnm_centers.json';
import mysCenters from './gadm/mys_centers.json';

import { LatLngLiteral } from '../types';

/**
 * 区域层级数据（使用 Google 官方名称）
 * 结构：国家 -> 省/州 -> 市/区[]
 */
export const REGION_HIERARCHY: Record<string, Record<string, string[]>> = {
  ...chnGoogleHierarchy,
  ...usaGoogleHierarchy,
  ...idnGoogleHierarchy,
  ...thaGoogleHierarchy,
  ...vnmGoogleHierarchy,
  ...mysGoogleHierarchy
};

/**
 * GADM 名称 -> Google 名称 映射
 */
export const GADM_TO_GOOGLE: Record<string, string> = {
  ...chnMapping.gadmToGoogle,
  ...usaMapping.gadmToGoogle,
  ...idnMapping.gadmToGoogle,
  ...thaMapping.gadmToGoogle,
  ...vnmMapping.gadmToGoogle,
  ...mysMapping.gadmToGoogle
};

/**
 * Google 名称 -> GADM 名称 映射
 */
export const GOOGLE_TO_GADM: Record<string, string> = {
  ...chnMapping.googleToGadm,
  ...usaMapping.googleToGadm,
  ...idnMapping.googleToGadm,
  ...thaMapping.googleToGadm,
  ...vnmMapping.googleToGadm,
  ...mysMapping.googleToGadm
};

/**
 * 区域中心点数据（来自 GADM）
 * 结构：国家 -> 省/州 -> 市/区 -> { lat, lng }
 */
export const REGION_CENTERS: Record<string, Record<string, Record<string, LatLngLiteral>>> = {
  ...chnCenters as Record<string, Record<string, Record<string, LatLngLiteral>>>,
  ...usaCenters as Record<string, Record<string, Record<string, LatLngLiteral>>>,
  ...idnCenters as Record<string, Record<string, Record<string, LatLngLiteral>>>,
  ...thaCenters as Record<string, Record<string, Record<string, LatLngLiteral>>>,
  ...vnmCenters as Record<string, Record<string, Record<string, LatLngLiteral>>>,
  ...mysCenters as Record<string, Record<string, Record<string, LatLngLiteral>>>
};

/**
 * 将 GADM 名称转换为 Google 名称
 */
export function gadmToGoogleName(gadmName: string): string {
  return GADM_TO_GOOGLE[gadmName] || gadmName;
}

/**
 * 将 Google 名称转换为 GADM 名称
 */
export function googleToGadmName(googleName: string): string {
  return GOOGLE_TO_GADM[googleName] || googleName;
}

/**
 * 获取区域中心点（使用 GADM 名称查询）
 */
export function getRegionCenterByGadm(
  country: string,
  province: string,
  district: string
): LatLngLiteral | null {
  return REGION_CENTERS[country]?.[province]?.[district] || null;
}

/**
 * 获取区域中心点（使用 Google 名称查询，自动转换为 GADM 名称）
 */
export function getRegionCenterByGoogle(
  country: string,
  googleProvince: string,
  googleDistrict: string
): LatLngLiteral | null {
  const gadmProvince = googleToGadmName(googleProvince);
  const gadmDistrict = googleToGadmName(googleDistrict);
  return REGION_CENTERS[country]?.[gadmProvince]?.[gadmDistrict] || null;
}
