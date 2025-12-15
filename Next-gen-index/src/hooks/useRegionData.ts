/**
 * 区域数据管理Hook
 * 提供区域搜索、层级选择和GPS转换功能
 */

import { useMemo, useCallback } from 'react';
import { Region, AdministrativeRegion, RegionSearchOptions } from '../types';
import {
  searchRegions,
  getAllCountries,
  getProvincesInCountry,
  getDistrictsInProvinceByCountry,
  getAdministrativeRegion,
  isValidRegion
} from '../lib/regionData';
import {
  reverseGeocode,
  getCurrentPosition,
  getLocationAndConvertToRegion
} from '../lib/geocoding';

/**
 * 区域数据管理Hook
 */
export function useRegionData() {
  /**
   * 搜索区域
   */
  const search = useCallback((query: string, options?: RegionSearchOptions): AdministrativeRegion[] => {
    return searchRegions(query, options);
  }, []);

  /**
   * 获取所有国家列表
   */
  const getCountries = useCallback((): string[] => {
    return getAllCountries();
  }, []);

  /**
   * 获取指定国家下的所有省/州
   */
  const getProvinces = useCallback((country: string): string[] => {
    return getProvincesInCountry(country);
  }, []);

  /**
   * 获取指定省/州下的所有市/区
   */
  const getDistricts = useCallback((country: string, province: string): string[] => {
    return getDistrictsInProvinceByCountry(country, province);
  }, []);

  /**
   * 获取完整的行政区域信息
   */
  const getRegion = useCallback((region: Region): AdministrativeRegion => {
    return getAdministrativeRegion(region);
  }, []);

  /**
   * 验证区域是否存在
   */
  const validateRegion = useCallback((region: Region): boolean => {
    return isValidRegion(region);
  }, []);

  /**
   * GPS定位并转换为行政区域
   * 
   * @param apiKey Google Maps API Key
   * @returns Promise，解析为行政区域信息
   */
  const convertGPSToRegion = useCallback(async (apiKey: string): Promise<AdministrativeRegion> => {
    return getLocationAndConvertToRegion(apiKey);
  }, []);

  /**
   * 反向地理编码（从坐标转换为区域）
   * 
   * @param lat 纬度
   * @param lng 经度
   * @param apiKey Google Maps API Key
   * @returns Promise，解析为行政区域信息
   */
  const reverseGeocodeFromCoordinates = useCallback(async (
    lat: number,
    lng: number,
    apiKey: string
  ): Promise<AdministrativeRegion | null> => {
    return reverseGeocode(lat, lng, apiKey);
  }, []);

  /**
   * 获取GPS位置
   * 
   * @returns Promise，解析为GPS坐标
   */
  const getGPSPosition = useCallback((): Promise<GeolocationPosition> => {
    return getCurrentPosition();
  }, []);

  return {
    search,
    getCountries,
    getProvinces,
    getDistricts,
    getRegion,
    validateRegion,
    convertGPSToRegion,
    reverseGeocodeFromCoordinates,
    getGPSPosition
  };
}

