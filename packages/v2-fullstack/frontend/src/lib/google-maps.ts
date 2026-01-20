/**
 * Google Maps API配置与初始化
 * 
 * Reference:
 * - docs/v2/v2实施细则/17-Google-Maps-API配置与初始化-细则.md
 * - .cursor/rules/google-dev-api-key.mdc
 * 
 * 硬规则:
 * - API Key必须从环境变量读取
 * - 必须添加attribution
 * - 遵守Google Maps合规要求
 */

/**
 * Google Maps配置
 */
export interface GoogleMapsConfig {
  apiKey: string;
  version?: string;
  libraries?: string[];
  language?: string;
  region?: string;
}

/**
 * Google Maps Loader
 */
class GoogleMapsLoader {
  private loading: Promise<typeof google> | null = null;
  private loaded = false;
  
  /**
   * 加载Google Maps API
   */
  async load(config: GoogleMapsConfig): Promise<typeof google> {
    if (this.loaded && window.google?.maps) {
      return window.google;
    }
    
    if (this.loading) {
      return this.loading;
    }
    
    this.loading = new Promise((resolve, reject) => {
      // 创建script标签
      const script = document.createElement('script');
      
      // 构建URL参数
      const params = new URLSearchParams({
        key: config.apiKey,
        v: config.version || 'weekly',
        libraries: config.libraries?.join(',') || '',
        language: config.language || 'zh-CN',
        region: config.region || 'CN',
      });
      
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (window.google?.maps) {
          this.loaded = true;
          resolve(window.google);
        } else {
          reject(new Error('Google Maps API failed to load'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Google Maps script'));
      };
      
      document.head.appendChild(script);
    });
    
    return this.loading;
  }
  
  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this.loaded && !!window.google?.maps;
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
  return {
    apiKey: getGoogleMapsApiKey(),
    version: 'weekly',
    libraries: ['places', 'geometry'],
    language: 'zh-CN',
    region: 'CN',
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
