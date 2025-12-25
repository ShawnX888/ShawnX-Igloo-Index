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
    // 检查是否已经存在加载中的脚本
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      // 如果脚本已存在，等待它加载完成
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.importLibrary) {
          clearInterval(checkInterval);
          resolve(window.google.maps.importLibrary);
        }
      }, 100);

      // 设置超时
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google?.maps?.importLibrary) {
          reject(new Error('Google Maps API loading timeout'));
        }
      }, 10000);
      return;
    }

    // 使用官方推荐的动态加载器脚本（符合最佳实践）
    // 参考: https://developers.google.com/maps/documentation/javascript/load-maps-js-api#dynamic-library-import
    const loaderScript = document.createElement('script');
    loaderScript.async = true;
    loaderScript.defer = true;

    // 构建加载器 URL - 使用官方推荐的格式
    // 注意：当使用 loading=async 时，不使用 callback，而是等待脚本加载后直接使用 importLibrary
    const params = new URLSearchParams({
      key: apiKey,
      v: version,
      libraries: libraries.join(','),
      'internal-usage-attribution-ids': internalUsageAttributionIds,
      loading: 'async', // 使用异步加载，符合最佳实践
      // 不使用 callback，因为 loading=async 模式下，脚本加载完成后直接可用
    });

    loaderScript.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    // 使用 loading=async 模式：脚本加载完成后，直接检查 importLibrary 是否可用
    let checkCount = 0;
    const maxChecks = 50; // 最多检查 50 次（5秒）
    
    loaderScript.onload = () => {
      // 脚本加载完成后，等待一小段时间确保 API 完全初始化
      const checkImportLibrary = () => {
        checkCount++;
      if (window.google?.maps?.importLibrary) {
          clearTimeout(timeout);
        resolve(window.google.maps.importLibrary);
        } else if (checkCount < maxChecks) {
          // 如果还没准备好，继续检查（最多等待 5 秒）
          setTimeout(checkImportLibrary, 100);
      } else {
          // 超过最大检查次数，超时
          clearTimeout(timeout);
          reject(new Error('Google Maps API importLibrary not available after script loaded'));
      }
    };

      // 立即检查一次，然后每 100ms 检查一次
      checkImportLibrary();
    };

    // 错误处理
    loaderScript.onerror = () => {
      // 清理脚本
      if (loaderScript.parentNode) {
        loaderScript.parentNode.removeChild(loaderScript);
      }
      clearTimeout(timeout);
      
      // 提供详细的错误信息和排查步骤
      const errorMessage = `Failed to load Google Maps JavaScript API.

Troubleshooting steps:
1. Verify API Key: Check if VITE_GOOGLE_MAPS_API_KEY is correctly set in .env file
2. Enable API: Ensure "Maps JavaScript API" is enabled in Google Cloud Console
3. Check Restrictions: Verify API Key restrictions (HTTP referrers, IP addresses) allow your domain
4. Verify Billing: Ensure billing is enabled for your Google Cloud project
5. Network: Check your internet connection and firewall settings

API Key (first 10 chars): ${apiKey.substring(0, 10)}...`;
      
      reject(new Error(errorMessage));
    };

    // 添加超时处理（10秒）
    const timeout = setTimeout(() => {
      if (loaderScript.parentNode) {
        loaderScript.parentNode.removeChild(loaderScript);
      }
      reject(new Error(`Google Maps API loading timeout (10s). 
The API script did not load within 10 seconds. This usually indicates:
- Invalid API Key
- API not enabled
- Network connectivity issues
- API Key restrictions blocking the request`));
    }, 10000);

    // 添加到文档头部
    document.head.appendChild(loaderScript);
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
 * 
 * @param mapMode 地图模式：'2d' 或 '3d'，默认为 '2d'
 * @returns 地图配置选项
 */
export function getDefaultMapConfig(mapMode: '2d' | '3d' = '2d'): google.maps.MapOptions {
  // 从环境变量读取 Map ID，如果未配置则使用 DEMO_MAP_ID（仅用于开发测试）
  const mapId = (import.meta.env as any).VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/9b65e1ca-e15e-461c-9d2b-d9c022103649',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'googleMaps.ts:213',message:'Map ID read from env',data:{mapId,mapMode,envValue:(import.meta.env as any).VITE_GOOGLE_MAPS_MAP_ID},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const baseConfig: google.maps.MapOptions = {
    center: {
      lat: -6.2088, // 雅加达纬度
      lng: 106.8456, // 雅加达经度
    },
    zoom: mapMode === '3d' ? 15 : 11, // 3D 模式需要更高缩放级别
    mapTypeId: 'roadmap',
    // Map ID 用于启用 Advanced Markers 和 3D Buildings
    // 通过环境变量 VITE_GOOGLE_MAPS_MAP_ID 配置
    // 如果未配置，使用 DEMO_MAP_ID（不支持 3D 功能）
    mapId,
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: mapMode === '3d', // 3D 模式下启用旋转控制
    fullscreenControl: true,
  };

  // 3D 模式特定配置
  if (mapMode === '3d') {
    return {
      ...baseConfig,
      tilt: 45,        // 倾斜角度（0-45度，45度是最大倾斜）
      heading: 0,     // 初始旋转角度（0-360度）
    };
  }

  // 2D 模式配置
  return {
    ...baseConfig,
    tilt: 0,          // 2D 模式：无倾斜
    heading: 0,       // 2D 模式：无旋转
  };
}

