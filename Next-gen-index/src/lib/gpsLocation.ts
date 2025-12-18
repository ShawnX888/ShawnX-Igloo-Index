/**
 * GPS定位功能模块
 * 提供GPS定位获取和反向地理编码功能
 */

import { Region } from '../types';
import { findNearestRegions } from './regionData';

/**
 * GPS定位状态
 */
export type GPSStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * GPS定位结果
 */
export interface GPSLocationResult {
  latitude: number;
  longitude: number;
  region?: Region;
}

/**
 * GPS定位错误类型
 */
export type GPSErrorType = 
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'GEOLOCATION_NOT_SUPPORTED'
  | 'GEOCODING_FAILED'
  | 'REGION_NOT_FOUND'
  | 'UNKNOWN';

/**
 * GPS定位错误
 */
export interface GPSLocationError {
  type: GPSErrorType;
  message: string;
}

/**
 * 获取当前GPS位置
 */
export async function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        type: 'GEOLOCATION_NOT_SUPPORTED',
        message: 'Geolocation is not supported by this browser'
      } as GPSLocationError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        let errorType: GPSErrorType = 'UNKNOWN';
        let errorMessage = 'Failed to get location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorType = 'PERMISSION_DENIED';
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorType = 'POSITION_UNAVAILABLE';
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorType = 'TIMEOUT';
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }

        reject({ type: errorType, message: errorMessage } as GPSLocationError);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

/**
 * 从Geocoding API响应中提取地址组件
 */
function extractAddressComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string
): string | null {
  const component = components.find(c => c.types.includes(type));
  return component?.long_name || null;
}

/**
 * 模糊名称匹配
 */
function isNameMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  
  const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  return n1.includes(n2) || n2.includes(n1);
}

/**
 * 反向地理编码 - 将坐标转换为行政区域（双重验证逻辑）
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<Region | null> {
  const apiKey = (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  
  if (!apiKey) {
    console.error('Google Maps API Key not found');
    return null;
  }

  // 1. 地理预过滤：获取距离最近的 5 个候选区域
  const candidates = findNearestRegions(lat, lng, 5);
  
  if (candidates.length === 0) {
    console.warn('No nearest regions found for coordinates:', { lat, lng });
    return null;
  }

  try {
    // 2. 调用 Google Geocoding 获取实时名称
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      console.warn('Google Geocoding failed, falling back to nearest region:', data.status);
      return {
        country: candidates[0].country,
        province: candidates[0].province,
        district: candidates[0].district
      };
    }

    // 解析实时地址组件
    const addressComponents = data.results[0].address_components as google.maps.GeocoderAddressComponent[];
    
    // 优先提取市/区名称用于匹配
    let googleDistrict = extractAddressComponent(addressComponents, 'administrative_area_level_2');
    if (!googleDistrict) {
      googleDistrict = extractAddressComponent(addressComponents, 'locality');
    }
    if (!googleDistrict) {
      googleDistrict = extractAddressComponent(addressComponents, 'sublocality_level_1');
    }

    // 3. 语义匹配候选人名称
    if (googleDistrict) {
      const matched = candidates.find((c: any) => 
        isNameMatch(googleDistrict!, c.district) || 
        isNameMatch(googleDistrict!, c.googleDistrict) ||
        isNameMatch(googleDistrict!, c.gadmDistrict)
      );
      
      if (matched) {
        return {
          country: matched.country,
          province: matched.province,
          district: matched.district
        };
      }
    }

    // 4. 兜底：返回距离最近的候选人
    console.log('No semantic match found, using nearest candidate:', candidates[0].district);
    return {
      country: candidates[0].country,
      province: candidates[0].province,
      district: candidates[0].district
    };
  } catch (error) {
    console.error('Reverse geocoding logic error, falling back to nearest candidate:', error);
    return {
      country: candidates[0].country,
      province: candidates[0].province,
      district: candidates[0].district
    };
  }
}

/**
 * 完整的GPS定位流程：获取位置 -> 反向地理编码 -> 返回结果
 */
export async function getGPSLocation(): Promise<GPSLocationResult> {
  // 1. 获取GPS位置
  const position = await getCurrentPosition();
  const { latitude, longitude } = position.coords;

  // 2. 反向地理编码
  const region = await reverseGeocode(latitude, longitude);

  return {
    latitude,
    longitude,
    region: region || undefined
  };
}

