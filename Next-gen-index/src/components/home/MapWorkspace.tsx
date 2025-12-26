import { Region, DataType, RiskData, InsuranceProduct, DateRange, RegionWeatherData } from "./types";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Layers, CloudRain, AlertTriangle, Locate, Loader2, Check, X, Box, Square } from "lucide-react";
import { cn } from "../../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { 
  initGoogleMapsLoader, 
  loadGoogleMapsLibraries, 
  createMap, 
  getDefaultMapConfig 
} from "../../lib/googleMaps";
import { getMapModeStyles } from "../../config/mapModeStyles";
import { useRegionBoundaryLayer } from "../../hooks/useRegionBoundaryLayer";
import { useRainfallHeatmapLayer } from "../../hooks/useRainfallHeatmapLayer";
import { useRiskEventMarkersLayer } from "../../hooks/useRiskEventMarkersLayer";
import { getDistrictsInProvince, getRegionCenter } from "../../lib/regionData";
import { useWeatherData } from "../../hooks/useWeatherData";
import { getGPSLocation, GPSStatus, GPSLocationError } from "../../lib/gpsLocation";
import { useMapAnimation } from "../../hooks/useMapAnimation";
import {
  prepareInitialData,
  waitForDataReady,
  validateDataCompleteness,
  type PreparedData,
} from "../../lib/animationDataFlow";

// 区域边界图层渲染组件（用于条件渲染）
function RegionBoundaryLayerRenderer({
  map,
  selectedRegion,
  districts,
  country,
  province,
  onRegionSelect,
  heatmapVisible = false,
  mapMode = '2d',
}: {
  map: google.maps.Map;
  selectedRegion: Region;
  districts: string[];
  country: string;
  province: string;
  onRegionSelect: (region: Region) => void;
  heatmapVisible?: boolean;
  mapMode?: '2d' | '3d';
}) {
  useRegionBoundaryLayer({
    map,
    selectedRegion,
    districts,
    country,
    province,
    onRegionSelect,
    heatmapVisible,
    mapMode,
  });
  return null;
}

// 降雨量热力图图层渲染组件（用于条件渲染）
function RainfallHeatmapLayerRenderer({
  map,
  districts,
  country,
  province,
  rainfallData,
  dataType,
  visible,
  mapMode = '2d',
}: {
  map: google.maps.Map;
  districts: string[];
  country: string;
  province: string;
  rainfallData: RegionWeatherData;
  dataType: DataType;
  visible: boolean;
  mapMode?: '2d' | '3d';
}) {
  useRainfallHeatmapLayer({
    map,
    districts,
    country,
    province,
    rainfallData,
    dataType,
    visible,
    mapMode,
  });
  return null;
}

// 风险事件标记图层渲染组件（用于条件渲染）
function RiskEventMarkersLayerRenderer({
  map,
  districts,
  country,
  province,
  riskData,
  selectedRegion,
  dataType,
  selectedProduct,
  visible,
  mapMode = '2d',
}: {
  map: google.maps.Map;
  districts: string[];
  country: string;
  province: string;
  riskData: RiskData[];
  selectedRegion: Region;
  dataType: DataType;
  selectedProduct: InsuranceProduct | null;
  visible: boolean;
  mapMode?: '2d' | '3d';
}) {
  useRiskEventMarkersLayer({
    map,
    districts,
    country,
    province,
    riskData,
    selectedRegion,
    dataType,
    selectedProduct,
    visible,
    mapMode,
  });
  return null;
}

interface MapWorkspaceProps {
  selectedRegion: Region;
  weatherDataType: DataType;
  riskData: RiskData[];
  selectedProduct: InsuranceProduct | null;
  setSelectedRegion: (region: Region) => void;
  activeInputMode: "manual" | "chat";
  dateRange: DateRange;
  allRegionsWeatherData?: RegionWeatherData;
}

export function MapWorkspace({ selectedRegion, weatherDataType, riskData, selectedProduct, setSelectedRegion, activeInputMode, dateRange, allRegionsWeatherData }: MapWorkspaceProps) {
  // Google Maps 相关 refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  // 控制是否应该显示图层（动画完成后才显示）
  const [shouldShowLayers, setShouldShowLayers] = useState(false);
  // 标记是否已经执行过初始化动画
  const hasInitializedRef = useRef(false);

  // Layer visibility state
  const [layers, setLayers] = useState({
    heatmap: true, // Layer 1 & 2
    events: true,  // Layer 3 & 4
  });

  // 地图动画 Hook
  const { initialize, flyTo, isAnimating } = useMapAnimation({
    map: mapInstanceRef.current,
    defaultDuration: 2500,
  });

  // 记录上一次的区域，用于检测区域变化
  const previousRegionRef = useRef<Region | null>(null);

  // 获取当前区域所属省/州下的所有市/区列表
  const districts = useMemo(() => {
    return getDistrictsInProvince(selectedRegion);
  }, [selectedRegion]);

  // GPS定位状态
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>('idle');
  const [gpsError, setGpsError] = useState<string>('');

  // 地图模式：2D 或 3D
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('2d');
  // 切换过渡状态
  const [isTransitioning, setIsTransitioning] = useState(false);

  // GPS定位处理函数（使用 Fly-To 动画）
  const handleGPSClick = useCallback(async () => {
    if (gpsStatus === 'loading' || !mapInstanceRef.current || !flyTo) return;

    setGpsStatus('loading');
    setGpsError('');

    try {
      const result = await getGPSLocation();
      
      if (result.region && mapInstanceRef.current) {
        const targetRegion = result.region;

        // 执行 GPS 定位特殊动画序列
        await flyTo({
          target: {
            center: {
              lat: result.latitude,
              lng: result.longitude,
            },
            province: {
              country: targetRegion.country,
              province: targetRegion.province,
            },
          },
          strategy: 'parabolic',
          source: 'gps-location', // 触发GPS特殊动画序列
          onComplete: async () => {
            // 动画完成后，设置选中区域（触发数据加载）
            setSelectedRegion(targetRegion);
            setGpsStatus('success');
            
            // 3秒后重置状态
            setTimeout(() => setGpsStatus('idle'), 3000);
          },
        });
      } else {
        throw { type: 'REGION_NOT_FOUND', message: 'Could not determine your location region' };
      }
    } catch (error) {
      setGpsStatus('error');
      const gpsError = error as GPSLocationError;
      setGpsError(gpsError.message || 'Failed to get location');
      
      // 5秒后重置错误状态
      setTimeout(() => {
        setGpsStatus('idle');
        setGpsError('');
      }, 5000);
    }
  }, [gpsStatus, flyTo, setSelectedRegion]);

  // 初始化 Google Maps
  useEffect(() => {
    const initMap = async () => {
      // 检查 API Key
      const apiKey = (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY as string | undefined;
      if (!apiKey) {
        console.warn('Google Maps API Key not found. Please set VITE_GOOGLE_MAPS_API_KEY in .env file');
        setMapsError('API Key not configured');
        return;
      }

      // 检查容器是否存在
      if (!mapContainerRef.current) {
        return;
      }

      try {
        // 验证 API Key 格式（基本检查）
        if (!apiKey || apiKey.length < 20) {
          throw new Error('Invalid API Key format. API Key should be at least 20 characters long.');
        }

        // 初始化加载器
        const importLibrary = await initGoogleMapsLoader({
          apiKey,
          version: 'weekly',
          libraries: ['maps', 'marker'],
          internalUsageAttributionIds: 'gmp_mcp_codeassist_v0.1_github',
        });

        // 加载所需的库（Data Layer 是 Maps API 的一部分，不需要单独加载）
        await loadGoogleMapsLibraries(importLibrary, ['maps', 'marker']);

        // 验证 Google Maps API 是否完全加载
        if (!window.google?.maps?.Map) {
          throw new Error('Google Maps Map class not available after loading libraries');
        }

        // 创建地图配置（使用步骤02中定义的类型）
        // 注意：初始化时使用当前 mapMode，后续切换通过 useEffect 处理
        const defaultConfig = getDefaultMapConfig(mapMode);
        const mapConfig: google.maps.MapOptions = {
          ...defaultConfig,
          center: {
            lat: -6.2088, // 雅加达纬度
            lng: 106.8456, // 雅加达经度
          },
          // zoom 已在 getDefaultMapConfig 中根据 mapMode 设置
        };

        // 创建地图实例
        const map = createMap(mapContainerRef.current, mapConfig);
        mapInstanceRef.current = map;

        setMapsLoaded(true);
        setMapsError(null);
      } catch (error) {
        console.error('Failed to initialize Google Maps:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load Google Maps';
        setMapsError(errorMessage);
        
        // 提供更详细的错误信息
        if (errorMessage.includes('API Key') || errorMessage.includes('timeout')) {
          console.error('Troubleshooting tips:');
          console.error('1. Check if VITE_GOOGLE_MAPS_API_KEY is set in .env file');
          console.error('2. Verify the API Key is valid in Google Cloud Console');
          console.error('3. Ensure "Maps JavaScript API" is enabled');
          console.error('4. Check API Key restrictions (HTTP referrers, IP addresses)');
        }
      }
    };

    initMap();

    // 清理函数
    return () => {
      // 地图实例会在组件卸载时自动清理
      mapInstanceRef.current = null;
    };
  }, []);

  // 执行初始化动画（在地图加载完成后）
  // 遵循执行流程规范：步骤1-6
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current || hasInitializedRef.current) {
      return;
    }

    // 如果没有 selectedRegion，直接显示图层
    if (!selectedRegion) {
      setShouldShowLayers(true);
      return;
    }

    // 执行初始化动画
    const runInitializeAnimation = async () => {
      hasInitializedRef.current = true;

      try {
        // 步骤1：获取初始化区域信息
        const regionCenter = await getRegionCenter(selectedRegion);

        if (!regionCenter || !mapInstanceRef.current) {
          // 如果无法获取中心点，直接显示图层（降级处理）
          console.warn('Failed to get region center, skipping animation');
          setShouldShowLayers(true);
          return;
        }

        // 步骤4：并行数据准备（在动画期间并行执行）
        const dataPreparationPromise = prepareInitialData(
          selectedRegion,
          dateRange,
          weatherDataType,
          'rainfall', // 默认使用降雨量数据
          selectedProduct?.id // 使用产品ID作为缓存上下文
        ).catch((error) => {
          console.error('Data preparation error:', error);
          return null; // 返回null表示准备失败
        });

        // 步骤3：执行动画效果
        const animationPromise = initialize({
          target: {
            center: regionCenter,
            province: {
              country: selectedRegion.country,
              province: selectedRegion.province,
            },
          },
          duration: 2500,
          onComplete: async () => {
            try {
              // 步骤5：验证数据完备性
              const preparedData = await waitForDataReady(
                dataPreparationPromise,
                { timeout: 5000 } // 5秒超时
              );

              if (!preparedData) {
                console.error('Data preparation timeout or failed');
                // 显示错误提示（可选，根据UI需求）
                // showErrorToast('数据加载超时，请刷新页面重试');
                // 即使数据准备失败，也显示图层（降级处理）
                setShouldShowLayers(true);
                return;
              }

              // 验证数据完备性
              if (!validateDataCompleteness(preparedData)) {
                console.error('Data preparation incomplete');
                // 显示错误提示（可选，根据UI需求）
                // showErrorToast('数据加载不完整，请刷新页面重试');
                // 即使数据验证失败，也显示图层（降级处理）
                setShouldShowLayers(true);
                return;
              }

              // 步骤6：加载地图图层
              // 通过设置 shouldShowLayers = true 触发现有 Hook 的响应式更新
              // 数据已经准备好，Hook 会从缓存中读取数据
              setShouldShowLayers(true);
              
              // 初始化完成后，设置 previousRegionRef，避免触发区域切换动画
              previousRegionRef.current = selectedRegion;
            } catch (error) {
              console.error('Error in animation onComplete:', error);
              // 即使出错，也显示图层（降级处理）
              setShouldShowLayers(true);
              // 即使出错，也设置 previousRegionRef
              previousRegionRef.current = selectedRegion;
            }
          },
        });

        // 等待动画完成（数据准备可能已经完成）
        await animationPromise;
      } catch (error) {
        console.error('Initialize animation failed:', error);
        // 即使动画失败，也允许显示图层（降级处理）
        setShouldShowLayers(true);
        // 即使动画失败，也设置 previousRegionRef
        previousRegionRef.current = selectedRegion;
      }
    };

    runInitializeAnimation();
  }, [mapsLoaded, selectedRegion, initialize, dateRange, weatherDataType, selectedProduct]);

  // 监听区域变化，执行 Fly-To 动画（仅适用于用户手动切换区域）
  // 明确排除初始化场景：只有在初始化完成后，且区域确实发生变化时才执行
  useEffect(() => {
    // 如果地图未加载、没有地图实例、正在动画中，则跳过
    if (!mapsLoaded || !mapInstanceRef.current || isAnimating) {
      return;
    }

    // 如果还未初始化完成，跳过（初始化场景由初始化动画处理）
    if (!hasInitializedRef.current) {
      return;
    }

    // 如果没有 selectedRegion，跳过
    if (!selectedRegion) {
      return;
    }

    // 如果 previousRegionRef 为 null，说明是初始化场景，跳过
    // 初始化场景应该在初始化动画中处理，这里只处理用户手动切换
    const prevRegion = previousRegionRef.current;
    if (!prevRegion) {
      // 初始化场景，不应该执行 Fly-To 动画
      return;
    }

    // 如果区域没有变化，跳过
    if (
      prevRegion.country === selectedRegion.country &&
      prevRegion.province === selectedRegion.province &&
      prevRegion.district === selectedRegion.district
    ) {
      return;
    }

    // 更新上一次的区域（在动画开始前更新，避免重复触发）
    previousRegionRef.current = selectedRegion;

    // 执行 Fly-To 动画
    const runFlyToAnimation = async () => {
      try {
        // 步骤1：获取目标区域中心点
        const regionCenter = await getRegionCenter(selectedRegion);

        if (!regionCenter || !mapInstanceRef.current || !flyTo) {
          console.warn('Failed to get region center or flyTo not available, skipping animation');
          return;
        }

        // 步骤4：并行数据准备（在动画期间并行执行）
        const dataPreparationPromise = prepareInitialData(
          selectedRegion,
          dateRange,
          weatherDataType,
          'rainfall',
          selectedProduct?.id
        ).catch((error) => {
          console.error('Data preparation error:', error);
          return null;
        });

        // 步骤3：执行动画效果
        await flyTo({
          target: {
            center: regionCenter,
            province: {
              country: selectedRegion.country,
              province: selectedRegion.province,
            },
          },
          strategy: 'parabolic',
          source: 'region-search',
          onComplete: async () => {
            try {
              // 步骤5：验证数据完备性
              const preparedData = await waitForDataReady(
                dataPreparationPromise,
                { timeout: 5000 }
              );

              if (!preparedData) {
                console.error('Data preparation timeout or failed');
                return;
              }

              // 验证数据完备性
              if (!validateDataCompleteness(preparedData)) {
                console.error('Data preparation incomplete');
                return;
              }

              // 步骤6：数据已经准备好，图层会通过响应式更新自动加载
              // 不需要额外操作，因为数据已经在缓存中
              
              // 确保 previousRegionRef 已更新（防止重复触发）
              previousRegionRef.current = selectedRegion;
            } catch (error) {
              console.error('Error in flyTo onComplete:', error);
              // 即使出错，也更新 previousRegionRef，避免重复触发
              previousRegionRef.current = selectedRegion;
            }
          },
        });
      } catch (error) {
        console.error('Fly-to animation failed:', error);
        // 即使出错，也更新 previousRegionRef，避免重复触发
        previousRegionRef.current = selectedRegion;
      }
    };

    runFlyToAnimation();
  }, [selectedRegion, mapsLoaded, isAnimating, flyTo, dateRange, weatherDataType, selectedProduct]);

  // 触摸板手势识别：区分滑动和缩放
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current || !mapsLoaded || isTransitioning) return;

    const mapContainer = mapContainerRef.current;
    const map = mapInstanceRef.current;

    // 禁用 Google Maps 的默认 scrollwheel 行为，以便我们手动处理
    map.setOptions({ scrollwheel: false });

    // 手势状态跟踪
    let lastWheelTime = 0;
    let wheelEventCount = 0;
    let accumulatedDeltaY = 0;
    const WHEEL_THRESHOLD_MS = 100; // 100ms 内的连续 wheel 事件视为同一手势

    /**
     * 检测是否为缩放手势
     * 在 macOS 上，两指缩放通常伴随 metaKey (cmd键)
     * 在 Windows/Linux 上，两指缩放通常伴随 ctrlKey
     */
    const isZoomGesture = (e: WheelEvent): boolean => {
      // 检查修饰键（最可靠的方法）
      // macOS: metaKey (cmd键)
      // Windows/Linux: ctrlKey
      if (e.ctrlKey || e.metaKey) {
        return true;
      }

      // 如果没有修饰键，通过 deltaY 的特征判断
      // 缩放操作：deltaY 通常较小（绝对值 < 5）且连续
      // 滑动操作：deltaY 通常较大（绝对值 >= 10）
      const absDeltaY = Math.abs(e.deltaY);
      
      // 如果 deltaY 很小，可能是缩放
      if (absDeltaY < 5) {
        const timeSinceLastWheel = Date.now() - lastWheelTime;
        // 如果是连续的小 deltaY 事件，可能是缩放
        if (timeSinceLastWheel < WHEEL_THRESHOLD_MS && wheelEventCount > 2) {
          return true;
        }
      }

      return false;
    };

    /**
     * 处理 wheel 事件
     */
    const handleWheel = (e: WheelEvent) => {
      // 检查鼠标是否在地图容器内
      const rect = mapContainer.getBoundingClientRect();
      const isInsideMap = (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );

      if (!isInsideMap) {
        return; // 不在地图区域内，不处理
      }

      const currentTime = Date.now();
      const timeSinceLastWheel = currentTime - lastWheelTime;

      // 判断是否为同一手势的连续事件
      if (timeSinceLastWheel < WHEEL_THRESHOLD_MS) {
        wheelEventCount++;
        accumulatedDeltaY += e.deltaY;
      } else {
        // 新的手势开始
        wheelEventCount = 1;
        accumulatedDeltaY = e.deltaY;
      }

      lastWheelTime = currentTime;

      // 检测是否为缩放手势
      const isZoom = isZoomGesture(e);

      if (isZoom) {
        // 缩放操作：阻止默认行为，手动处理地图缩放
        e.preventDefault();
        e.stopPropagation();
        
        // 计算缩放增量
        // deltaY < 0 表示放大，deltaY > 0 表示缩小
        const zoomDelta = -e.deltaY * 0.01; // 调整缩放灵敏度
        const currentZoom = map.getZoom() || 11;
        const newZoom = Math.max(1, Math.min(20, currentZoom + zoomDelta));
        
        // 使用 setZoom 方法，它会自动保持地图中心点
        map.setZoom(newZoom);
      } else {
        // 滑动操作：阻止地图的默认行为，改为页面滚动
        e.preventDefault();
        e.stopPropagation();
        
        // 手动触发页面滚动
        // 使用累积的 deltaY 以获得更平滑的滚动体验
        const scrollAmount = accumulatedDeltaY;
        window.scrollBy({
          top: scrollAmount,
          behavior: 'auto'
        });
        
        // 重置累积值，准备下一次滚动
        accumulatedDeltaY = 0;
      }
    };

    // 添加事件监听器（使用 passive: false 以便可以阻止默认行为）
    mapContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      mapContainer.removeEventListener('wheel', handleWheel);
      // 恢复 Google Maps 的默认 scrollwheel 行为
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setOptions({ scrollwheel: true });
      }
    };
  }, [mapsLoaded, isTransitioning]);

  // 模式切换逻辑：监听 mapMode 变化，实现平滑切换动画
  useEffect(() => {
    if (!mapInstanceRef.current || !mapsLoaded) return;
    
    const map = mapInstanceRef.current;
    const targetMode = mapMode;
    const styles = getMapModeStyles(targetMode);
    const mapConfig = styles.map;

    // 保存当前地图的中心点和缩放级别，确保切换时位置不变
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom() || 11;

    // 设置过渡状态，禁用交互
    setIsTransitioning(true);
    
    // 在过渡期间禁用地图交互（拖拽、缩放等）
    map.setOptions({
      draggable: false,
      zoomControl: false,
      scrollwheel: false,
      disableDoubleClickZoom: true,
    });

    // 平滑过渡地图参数
    // Google Maps 的 setTilt、setHeading、setZoom 方法支持平滑过渡
    if (targetMode === '2d' || targetMode === '3d') {
      // 确保中心点保持不变（在调整其他参数前先设置中心点）
      if (currentCenter) {
        map.setCenter(currentCenter);
      }

      // 确保 3D 模式下 zoom >= 17，但只在必要时调整
      const targetZoom = mapConfig.zoom;
      
      if (targetMode === '3d') {
        // 3D 模式：如果当前 zoom < 17，需要调整到至少 17
        // 但为了保持位置，我们使用平滑过渡，并确保中心点不变
        if (currentZoom < 17) {
          // 先确保中心点，然后调整 zoom（Google Maps 会自动保持中心点）
          // 使用 setZoom 会平滑过渡，并自动保持当前中心点
          map.setZoom(Math.max(17, targetZoom));
        }
        // 如果当前 zoom >= 17，保持当前 zoom，不强制调整到 18
        // 这样可以避免不必要的缩放，保持用户当前的视角
      } else {
        // 2D 模式：不强制调整 zoom，保持用户当前的缩放级别
        // 这样可以保持用户当前的视角
      }
      
      // 平滑更新 tilt 和 heading（这些操作不会改变地图中心点）
      map.setTilt(mapConfig.tilt);
      map.setHeading(mapConfig.heading);
      
      // 更新旋转控制
      map.setOptions({ rotateControl: mapConfig.rotateControl });
    }

    // 等待过渡完成（Google Maps 自动处理平滑过渡）
    // 过渡时长建议 500-800ms
    const transitionTimeout = setTimeout(() => {
      // 再次确保中心点保持不变（防止在过渡过程中偏移）
      if (currentCenter) {
        map.setCenter(currentCenter);
      }
      
      // 恢复地图交互
      // 注意：scrollwheel 由手势识别代码控制，这里不恢复
      map.setOptions({
        draggable: true,
        zoomControl: true,
        scrollwheel: false, // 由手势识别代码控制
        disableDoubleClickZoom: false,
      });
      setIsTransitioning(false);
    }, 800);

    return () => {
      clearTimeout(transitionTimeout);
    };
  }, [mapMode, mapsLoaded]);


  return (
    <div className="w-full h-full relative overflow-hidden bg-[#eef2f6]">
      {/* Google Maps Container */}
      <div 
        ref={mapContainerRef}
        id="google-map-container"
        className="w-full h-full"
      />

      {/* Loading State */}
      {!mapsLoaded && !mapsError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm">Loading Google Maps...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {mapsError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center p-4">
            <p className="text-red-600 text-sm mb-2">Failed to load Google Maps</p>
            <p className="text-gray-500 text-xs">{mapsError}</p>
            <p className="text-gray-400 text-xs mt-2">
              Please check your API Key configuration in .env file
            </p>
          </div>
        </div>
      )}

      {/* 降雨量热力图图层 - 底层 */}
      {mapsLoaded && mapInstanceRef.current && shouldShowLayers && allRegionsWeatherData && (
        <RainfallHeatmapLayerRenderer
          map={mapInstanceRef.current}
          districts={districts}
          country={selectedRegion.country}
          province={selectedRegion.province}
          rainfallData={allRegionsWeatherData}
          dataType={weatherDataType}
          visible={layers.heatmap}
          mapMode={mapMode}
        />
      )}

      {/* 风险事件标记图层 - 边界图层下方 */}
      {mapsLoaded && mapInstanceRef.current && shouldShowLayers && (
        <RiskEventMarkersLayerRenderer
          map={mapInstanceRef.current}
          districts={districts}
          country={selectedRegion.country}
          province={selectedRegion.province}
          riskData={riskData}
          selectedRegion={selectedRegion}
          dataType={weatherDataType}
          selectedProduct={selectedProduct}
          visible={layers.events}
          mapMode={mapMode}
        />
      )}

      {/* 区域边界图层 - 最上层（用于点击交互） */}
      {mapsLoaded && mapInstanceRef.current && shouldShowLayers && (
        <RegionBoundaryLayerRenderer
          map={mapInstanceRef.current}
          selectedRegion={selectedRegion}
          districts={districts}
          country={selectedRegion.country}
          province={selectedRegion.province}
          onRegionSelect={setSelectedRegion}
          heatmapVisible={layers.heatmap && !!allRegionsWeatherData}
          mapMode={mapMode}
        />
      )}

      {/* Layer Controls (Position depends on mode) - 显示在Google Maps之上 */}
      <div className={cn(
         "absolute bottom-6 z-10 bg-white shadow-md rounded-lg p-1 border border-gray-200 flex flex-col gap-1 transition-all duration-500 ease-in-out",
         activeInputMode === 'manual' ? "right-6" : "left-6"
      )}>
        {/* 2D/3D 切换按钮 */}
        <button 
           onClick={() => {
             if (isTransitioning) return; // 过渡期间禁用切换
             setMapMode(prev => prev === '2d' ? '3d' : '2d');
           }}
           disabled={isTransitioning}
           className={cn(
             "p-2 rounded transition-all relative",
             mapMode === '2d' 
               ? "hover:bg-gray-100 text-gray-500 hover:text-blue-600" 
               : "bg-blue-50 text-blue-600 hover:bg-blue-100",
             isTransitioning && "opacity-50 cursor-wait"
           )}
           title={isTransitioning 
             ? "Switching..." 
             : mapMode === '2d' 
               ? "Switch to 3D View" 
               : "Switch to 2D View"}
        >
          {isTransitioning ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : mapMode === '2d' ? (
            <Box className="w-5 h-5" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </button>
        
        <div className="h-px bg-gray-100 mx-1" />
        
        {/* 定位按钮 */}
        <button 
           onClick={handleGPSClick}
           disabled={gpsStatus === 'loading'}
           className={cn(
             "p-2 rounded transition-all relative",
             gpsStatus === 'idle' && "hover:bg-gray-100 text-gray-500 hover:text-blue-600",
             gpsStatus === 'loading' && "bg-blue-50 text-blue-600 cursor-wait",
             gpsStatus === 'success' && "bg-green-50 text-green-600",
             gpsStatus === 'error' && "bg-red-50 text-red-600"
           )}
           title={gpsError || "My Location"}
        >
          {gpsStatus === 'loading' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : gpsStatus === 'success' ? (
            <Check className="w-5 h-5" />
          ) : gpsStatus === 'error' ? (
            <X className="w-5 h-5" />
          ) : (
            <Locate className="w-5 h-5" />
          )}
        </button>
        
        {/* GPS Error Tooltip */}
        {gpsStatus === 'error' && gpsError && (
          <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-red-600 text-white text-xs rounded-lg shadow-lg whitespace-nowrap max-w-[200px]">
            {gpsError}
            <div className="absolute top-full left-4 border-4 border-transparent border-t-red-600" />
          </div>
        )}
        <div className="h-px bg-gray-100 mx-1" />
        <Popover>
          <PopoverTrigger asChild>
             <button 
               className={cn("p-2 rounded hover:bg-gray-100 transition-colors", (layers.heatmap || layers.events) ? "text-blue-600 bg-blue-50" : "text-gray-500")}
               title="Map Layers"
             >
               <Layers className="w-5 h-5" />
             </button>
          </PopoverTrigger>
          <PopoverContent 
             side={activeInputMode === 'manual' ? "left" : "right"} 
             align="end" 
             className="w-64 p-4 rounded-xl shadow-xl border-0 bg-white/95 backdrop-blur-sm"
             sideOffset={10}
          >
             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Map Layers</h4>
             <div className="space-y-2">
                {/* Historical Rainfall */}
                <div 
                   onClick={() => weatherDataType === 'historical' && setLayers(p => ({...p, heatmap: !p.heatmap}))}
                   className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none",
                      weatherDataType === 'historical' 
                         ? (layers.heatmap ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-white border-gray-100 hover:border-blue-200")
                         : "bg-gray-50 border-transparent opacity-50 cursor-not-allowed"
                   )}
                >
                   <div className={cn("p-1.5 rounded-md", weatherDataType === 'historical' && layers.heatmap ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400")}>
                      <CloudRain className="w-4 h-4" />
                   </div>
                   <div className="flex-1">
                      <div className={cn("text-xs font-semibold", weatherDataType === 'historical' ? "text-gray-900" : "text-gray-400")}>Historical Rainfall</div>
                      {weatherDataType === 'historical' && <div className="text-[10px] text-gray-500">Heatmap Layer</div>}
                   </div>
                   {weatherDataType === 'historical' && layers.heatmap && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>

                {/* Predicted Rainfall */}
                <div 
                   onClick={() => weatherDataType === 'predicted' && setLayers(p => ({...p, heatmap: !p.heatmap}))}
                   className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none",
                      weatherDataType === 'predicted' 
                         ? (layers.heatmap ? "bg-purple-50 border-purple-200 shadow-sm" : "bg-white border-gray-100 hover:border-purple-200")
                         : "bg-gray-50 border-transparent opacity-50 cursor-not-allowed"
                   )}
                >
                   <div className={cn("p-1.5 rounded-md", weatherDataType === 'predicted' && layers.heatmap ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400")}>
                      <CloudRain className="w-4 h-4" />
                   </div>
                   <div className="flex-1">
                      <div className={cn("text-xs font-semibold", weatherDataType === 'predicted' ? "text-gray-900" : "text-gray-400")}>Predicted Rainfall</div>
                      {weatherDataType === 'predicted' && <div className="text-[10px] text-gray-500">Forecast Layer</div>}
                   </div>
                   {weatherDataType === 'predicted' && layers.heatmap && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </div>
                
                <div className="h-px bg-gray-100 my-2" />

                {/* Risk Events */}
                <div 
                   onClick={() => selectedProduct && setLayers(p => ({...p, events: !p.events}))}
                   className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none",
                      !selectedProduct 
                         ? "bg-gray-50 border-transparent opacity-50 cursor-not-allowed" 
                         : (layers.events ? "bg-red-50 border-red-200 shadow-sm" : "bg-white border-gray-100 hover:border-red-200")
                   )}
                >
                   <div className={cn("p-1.5 rounded-md", !selectedProduct ? "bg-gray-100 text-gray-400" : (layers.events ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"))}>
                      <AlertTriangle className="w-4 h-4" />
                   </div>
                   <div className="flex-1">
                      <div className={cn("text-xs font-semibold", !selectedProduct ? "text-gray-400" : "text-gray-900")}>Risk Events</div>
                      <div className="text-[10px] text-gray-500">Triggers & Alerts</div>
                   </div>
                   {selectedProduct && layers.events && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
             </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}