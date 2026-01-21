/**
 * Google Maps API配置与初始化
 * 
 * Reference:
 * - docs/v2/v2实施细则/17-Google-Maps-API配置与初始化-细则.md
 * - .cursor/rules/google-dev-api-key.mdc
 * - https://developers.google.com/maps/documentation/javascript/load-maps-js-api?utm_source=gmp-code-assist
 * 
 * 硬规则:
 * - API Key必须从环境变量读取
 * - 必须添加attribution
 * - 遵守Google Maps合规要求
 */

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

/**
 * Google Maps配置
 */
export interface GoogleMapsConfig {
  apiKey: string;
  version?: string;
  libraries?: string[];
  language?: string;
  region?: string;
  mapIds?: string[];
  authReferrerPolicy?: string;
  channel?: string;
  solutionChannel?: string;
}

const DEFAULT_LIBRARIES = ['marker', 'geometry', 'data'];
const DEFAULT_VERSION = 'weekly';

/**
 * Google Maps Loader
 */
class GoogleMapsLoader {
  private loading: Promise<typeof google> | null = null;
  private optionsApplied = false;
  
  /**
   * 加载Google Maps API
   */
  async load(config: GoogleMapsConfig): Promise<typeof google> {
    if (this.loading) {
      return this.loading;
    }

    if (!this.optionsApplied) {
      setOptions({
        key: config.apiKey,
        v: config.version || DEFAULT_VERSION,
        libraries: config.libraries,
        language: config.language,
        region: config.region,
        authReferrerPolicy: config.authReferrerPolicy,
        mapIds: config.mapIds,
        channel: config.channel,
        solutionChannel: config.solutionChannel,
      });
      this.optionsApplied = true;
    }

    this.loading = (async () => {
      // Ensure maps lib is loaded first
      await importLibrary('maps');

      const librariesToLoad = (config.libraries || []).filter(lib => lib !== 'maps');
      await Promise.all(librariesToLoad.map(lib => importLibrary(lib)));

      if (!window.google?.maps) {
        throw new Error('Google Maps API failed to load');
      }

      return window.google;
    })();

    return this.loading;
  }
  
  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return !!window.google?.maps;
  }
}

/**
 * Google Maps Loader实例
 */
export const googleMapsLoader = new GoogleMapsLoader();

/**
 * 获取Google Maps API Key
 * 
 * 硬规则: 从环境变量读取,禁止硬编码
 */
export function getGoogleMapsApiKey(): string {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'VITE_GOOGLE_MAPS_API_KEY not found. ' +
      'Please add it to .env file. ' +
      'See .cursor/rules/google-dev-api-key.mdc for details.'
    );
  }
  
  return apiKey;
}

/**
 * 默认Google Maps配置
 */
export function getDefaultGoogleMapsConfig(): GoogleMapsConfig {
  const mapIds = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID
    ? [import.meta.env.VITE_GOOGLE_MAPS_MAP_ID]
    : undefined;

  return {
    apiKey: getGoogleMapsApiKey(),
    version: DEFAULT_VERSION,
    libraries: DEFAULT_LIBRARIES,
    language: 'zh-CN',
    region: 'CN',
    mapIds,
    authReferrerPolicy: import.meta.env.VITE_GOOGLE_MAPS_AUTH_REFERRER_POLICY,
  };
}

/**
 * 初始化Google Maps
 */
export async function initializeGoogleMaps(
  config?: Partial<GoogleMapsConfig>
): Promise<typeof google> {
  const fullConfig = {
    ...getDefaultGoogleMapsConfig(),
    ...config,
  };
  
  return googleMapsLoader.load(fullConfig);
}
