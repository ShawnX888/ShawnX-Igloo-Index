/**
 * Google Maps JavaScript API 加载和初始化工具
 * 
 * 使用动态库加载方式（importLibrary），符合 Google Maps Platform 最佳实践
 */

/**
 * Google Maps API 加载器配置
 */
export interface GoogleMapsLoaderConfig {
  /** API Key */
  apiKey: string;
  /** API 版本 */
  version?: string;
  /** 需要加载的库列表 */
  libraries?: string[];
  /** 内部使用归因ID（用于内部分析） */
  internalUsageAttributionIds?: string;
}

/**
 * 已加载的 Google Maps 库
 */
export interface LoadedLibraries {
  maps: google.maps.MapsLibrary;
  marker?: google.maps.MarkerLibrary;
  data?: google.maps.DataLibrary;
}

/**
 * 初始化 Google Maps JavaScript API 加载器
 * 
 * @param config 加载器配置
 * @returns Promise，解析为加载器函数
 */
export async function initGoogleMapsLoader(
  config: GoogleMapsLoaderConfig
): Promise<typeof google.maps.importLibrary> {
  const {
    apiKey,
    version = 'weekly',
    libraries = [],
    internalUsageAttributionIds = 'gmp_mcp_codeassist_v0.1_github',
  } = config;

  // 如果已经加载，直接返回
  if (window.google?.maps?.importLibrary) {
    return window.google.maps.importLibrary;
  }

  return new Promise((resolve, reject) => {
    // 创建动态加载器脚本
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;

    // 构建加载器 URL 参数
    const params = new URLSearchParams({
      key: apiKey,
      v: version,
      libraries: libraries.join(','),
      internalUsageAttributionIds,
      callback: '__googleMapsInit__',
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    // 设置全局回调函数
    (window as any).__googleMapsInit__ = () => {
      if (window.google?.maps?.importLibrary) {
        resolve(window.google.maps.importLibrary);
      } else {
        reject(new Error('Google Maps API failed to load'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google Maps JavaScript API'));
    };

    // 添加到文档头部
    document.head.appendChild(script);
  });
}

/**
 * 加载所需的 Google Maps 库
 * 
 * @param importLibrary 导入库函数
 * @param libraries 需要加载的库名称列表
 * @returns Promise，解析为已加载的库对象
 */
export async function loadGoogleMapsLibraries(
  importLibrary: typeof google.maps.importLibrary,
  libraries: string[] = ['maps', 'marker']
): Promise<LoadedLibraries> {
  const loaded: LoadedLibraries = {} as LoadedLibraries;

  try {
    // 加载基础 maps 库（包含 Data Layer 功能）
    loaded.maps = (await importLibrary('maps')) as google.maps.MapsLibrary;

    // 加载其他库
    if (libraries.includes('marker')) {
      loaded.marker = (await importLibrary('marker')) as google.maps.MarkerLibrary;
    }

    // 注意：Data Layer 是 Maps JavaScript API 的一部分，不需要单独加载
    // 可以通过 google.maps.Data 直接使用

    return loaded;
  } catch (error) {
    console.error('Failed to load Google Maps libraries:', error);
    throw error;
  }
}

/**
 * 创建地图实例
 * 
 * @param container HTML 容器元素
 * @param options 地图选项
 * @returns 地图实例
 */
export function createMap(
  container: HTMLElement,
  options: google.maps.MapOptions
): google.maps.Map {
  const { Map } = google.maps;
  return new Map(container, options);
}

/**
 * 获取默认地图配置（印尼雅加达）
 */
export function getDefaultMapConfig(): google.maps.MapOptions {
  return {
    center: {
      lat: -6.2088, // 雅加达纬度
      lng: 106.8456, // 雅加达经度
    },
    zoom: 11,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true,
  };
}

