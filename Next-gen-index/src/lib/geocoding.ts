/**
 * Google Geocoding API 工具
 * 提供反向地理编码功能，将GPS坐标转换为行政区域信息
 */

import { Region, AdministrativeRegion } from '../types';
import { findClosestRegion, getAdministrativeRegion } from './regionData';

/**
 * Geocoding API 响应类型
 */
interface GeocodingResult {
  results: Array<{
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
  status: string;
}

/**
 * 从地址组件中提取行政区域信息
 */
function extractAdministrativeInfo(addressComponents: GeocodingResult['results'][0]['address_components']): {
  country?: string;
  province?: string;
  district?: string;
} {
  let country: string | undefined;
  let province: string | undefined;
  let district: string | undefined;

  for (const component of addressComponents) {
    const types = component.types;

    // 提取国家
    if (types.includes('country')) {
      country = component.long_name;
    }

    // 提取省/州（administrative_area_level_1）
    if (types.includes('administrative_area_level_1')) {
      province = component.long_name;
    }

    // 提取市/区（优先使用 administrative_area_level_2，否则使用 locality）
    if (types.includes('administrative_area_level_2')) {
      district = component.long_name;
    } else if (!district && types.includes('locality')) {
      district = component.long_name;
    } else if (!district && types.includes('sublocality')) {
      district = component.long_name;
    }
  }

  return { country, province, district };
}

/**
 * 反向地理编码：将GPS坐标转换为行政区域信息
 * 
 * @param lat 纬度
 * @param lng 经度
 * @param apiKey Google Maps API Key
 * @returns 行政区域信息，如果转换失败返回null
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<AdministrativeRegion | null> {
  try {
    // 构建Geocoding API请求URL
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('result_type', 'administrative_area_level_1|administrative_area_level_2|locality|country');

    // 发送请求
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Geocoding API request failed: ${response.statusText}`);
    }

    const data: GeocodingResult = await response.json();

    // 检查API响应状态
    if (data.status === 'ZERO_RESULTS') {
      console.warn('No results found for the given coordinates');
      return null;
    }

    if (data.status !== 'OK') {
      throw new Error(`Geocoding API error: ${data.status}`);
    }

    // 提取第一个结果（通常是最精确的）
    const result = data.results[0];
    if (!result) {
      return null;
    }

    // 提取行政区域信息
    const { country, province, district } = extractAdministrativeInfo(result.address_components);

    // 如果缺少必要信息，返回null
    if (!country) {
      console.warn('Could not extract country from geocoding result');
      return null;
    }

    // 查找最接近的区域（匹配到我们的区域层级数据）
    const matchedRegion = findClosestRegion(country, province, district);
    if (!matchedRegion) {
      console.warn(`Could not match region: ${country}, ${province}, ${district}`);
      // 如果无法匹配，返回一个基于Geocoding结果的区域（使用坐标作为中心点）
      return {
        country: country || 'Unknown',
        province: province || 'Unknown',
        district: district || 'Unknown',
        center: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        },
        boundary: [] // 边界数据需要后续补充
      };
    }

    // 获取完整的行政区域信息（包含边界数据）
    return getAdministrativeRegion(matchedRegion);
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}

/**
 * 获取GPS位置（使用浏览器Geolocation API）
 * 
 * @returns Promise，解析为GPS坐标
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10秒超时
      maximumAge: 0 // 不使用缓存
    };

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timeout';
            break;
        }
        reject(new Error(errorMessage));
      },
      options
    );
  });
}

/**
 * GPS定位并转换为行政区域
 * 
 * @param apiKey Google Maps API Key
 * @returns Promise，解析为行政区域信息
 */
export async function getLocationAndConvertToRegion(
  apiKey: string
): Promise<AdministrativeRegion> {
  // 1. 获取GPS位置
  const position = await getCurrentPosition();
  const { latitude, longitude } = position.coords;

  // 2. 反向地理编码
  const region = await reverseGeocode(latitude, longitude, apiKey);
  if (!region) {
    throw new Error('Failed to convert location to region');
  }

  return region;
}

