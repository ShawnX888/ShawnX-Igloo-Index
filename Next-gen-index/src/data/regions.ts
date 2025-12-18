/**
 * 区域数据配置文件
 * 
 * 数据来源：
 * - 区域名称：Google Maps Geocoding API（用于 UI 和外部 API 调用）
 * - 中心点坐标：GADM 数据（merged_centers.json）
 * - 边界数据：GADM 数据（xxx_index.json）
 * - 名称映射：GADM ↔ Google（merged_mapping.json）
 * 
 * 注意：此文件仅提供数据导入和类型定义
 * 实际数据存储在 src/data/gadm/ 和 src/data/google/ 目录
 */

// 导入合并后的数据
import mergedGoogleHierarchy from './google/merged_google_hierarchy.json';
import mergedMapping from './google/merged_mapping.json';
import mergedCenters from './gadm/merged_centers.json';

import { LatLngLiteral } from '../types';

/**
 * 区域层级数据（使用 Google 官方名称）
 * 结构：国家 -> 省/州 -> 市/区[]
 */
export const REGION_HIERARCHY: Record<string, Record<string, string[]>> = mergedGoogleHierarchy;

/**
 * GADM 名称 -> Google 名称 映射
 */
export const GADM_TO_GOOGLE: Record<string, string> = mergedMapping.gadmToGoogle;

/**
 * Google 名称 -> GADM 名称 映射
 */
export const GOOGLE_TO_GADM: Record<string, string> = mergedMapping.googleToGadm;

/**
 * 区域中心点数据（来自 GADM）
 * 结构：国家 -> 省/州 -> 市/区 -> { lat, lng }
 */
export const REGION_CENTERS: Record<string, Record<string, Record<string, LatLngLiteral>>> = 
  mergedCenters as Record<string, Record<string, Record<string, LatLngLiteral>>>;

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
