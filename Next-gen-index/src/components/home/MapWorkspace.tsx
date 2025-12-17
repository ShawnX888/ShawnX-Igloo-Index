import { Region, DataType, RiskData, InsuranceProduct, DateRange, RegionWeatherData } from "./types";
import { useState, useEffect, useRef, useMemo } from "react";
import { Layers, CloudRain, AlertTriangle, Locate } from "lucide-react";
import { cn } from "../../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { 
  initGoogleMapsLoader, 
  loadGoogleMapsLibraries, 
  createMap, 
  getDefaultMapConfig 
} from "../../lib/googleMaps";
import { useRegionBoundaryLayer } from "../../hooks/useRegionBoundaryLayer";
import { useRainfallHeatmapLayer } from "../../hooks/useRainfallHeatmapLayer";
import { useRiskEventMarkersLayer } from "../../hooks/useRiskEventMarkersLayer";
import { getDistrictsInProvince } from "../../lib/regionData";
import { useWeatherData } from "../../hooks/useWeatherData";

// 区域边界图层渲染组件（用于条件渲染）
function RegionBoundaryLayerRenderer({
  map,
  selectedRegion,
  districts,
  country,
  province,
  onRegionSelect,
  heatmapVisible = false,
}: {
  map: google.maps.Map;
  selectedRegion: Region;
  districts: string[];
  country: string;
  province: string;
  onRegionSelect: (region: Region) => void;
  heatmapVisible?: boolean;
}) {
  useRegionBoundaryLayer({
    map,
    selectedRegion,
    districts,
    country,
    province,
    onRegionSelect,
    heatmapVisible,
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
}: {
  map: google.maps.Map;
  districts: string[];
  country: string;
  province: string;
  rainfallData: RegionWeatherData;
  dataType: DataType;
  visible: boolean;
}) {
  useRainfallHeatmapLayer({
    map,
    districts,
    country,
    province,
    rainfallData,
    dataType,
    visible,
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
  });
  return null;
}

interface MapWorkspaceProps {
  selectedRegion: Region;
  rainfallType: DataType; // 使用DataType替代RainfallType
  riskData: RiskData[];
  selectedProduct: InsuranceProduct | null;
  setSelectedRegion: (region: Region) => void;
  activeInputMode: "manual" | "chat";
  dateRange: DateRange;
  allRegionsWeatherData?: RegionWeatherData;
}

export function MapWorkspace({ selectedRegion, rainfallType, riskData, selectedProduct, setSelectedRegion, activeInputMode, dateRange, allRegionsWeatherData }: MapWorkspaceProps) {
  // Google Maps 相关 refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  // Layer visibility state
  const [layers, setLayers] = useState({
    heatmap: true, // Layer 1 & 2
    events: true,  // Layer 3 & 4
  });

  // 获取当前区域所属省/州下的所有市/区列表
  const districts = useMemo(() => {
    return getDistrictsInProvince(selectedRegion);
  }, [selectedRegion]);

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
        const defaultConfig = getDefaultMapConfig();
        const mapConfig: google.maps.MapOptions = {
          ...defaultConfig,
          center: {
            lat: -6.2088, // 雅加达纬度
            lng: 106.8456, // 雅加达经度
          },
          zoom: 11,
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
      {mapsLoaded && mapInstanceRef.current && allRegionsWeatherData && (
        <RainfallHeatmapLayerRenderer
          map={mapInstanceRef.current}
          districts={districts}
          country={selectedRegion.country}
          province={selectedRegion.province}
          rainfallData={allRegionsWeatherData}
          dataType={rainfallType}
          visible={layers.heatmap}
        />
      )}

      {/* 风险事件标记图层 - 边界图层下方 */}
      {mapsLoaded && mapInstanceRef.current && (
        <RiskEventMarkersLayerRenderer
          map={mapInstanceRef.current}
          districts={districts}
          country={selectedRegion.country}
          province={selectedRegion.province}
          riskData={riskData}
          selectedRegion={selectedRegion}
          dataType={rainfallType}
          selectedProduct={selectedProduct}
          visible={layers.events}
        />
      )}

      {/* 区域边界图层 - 最上层（用于点击交互） */}
      {mapsLoaded && mapInstanceRef.current && (
        <RegionBoundaryLayerRenderer
          map={mapInstanceRef.current}
          selectedRegion={selectedRegion}
          districts={districts}
          country={selectedRegion.country}
          province={selectedRegion.province}
          onRegionSelect={setSelectedRegion}
          heatmapVisible={layers.heatmap && !!allRegionsWeatherData}
        />
      )}

      {/* Layer Controls (Position depends on mode) - 显示在Google Maps之上 */}
      <div className={cn(
         "absolute bottom-6 z-10 bg-white shadow-md rounded-lg p-1 border border-gray-200 flex flex-col gap-1 transition-all duration-500 ease-in-out",
         activeInputMode === 'manual' ? "right-6" : "left-6"
      )}>
        <button 
           onClick={() => setSelectedRegion({...selectedRegion, district: 'JakartaSelatan'})}
           className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
           title="My Location"
        >
          <Locate className="w-5 h-5" />
        </button>
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
                   onClick={() => rainfallType === 'historical' && setLayers(p => ({...p, heatmap: !p.heatmap}))}
                   className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none",
                      rainfallType === 'historical' 
                         ? (layers.heatmap ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-white border-gray-100 hover:border-blue-200")
                         : "bg-gray-50 border-transparent opacity-50 cursor-not-allowed"
                   )}
                >
                   <div className={cn("p-1.5 rounded-md", rainfallType === 'historical' && layers.heatmap ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400")}>
                      <CloudRain className="w-4 h-4" />
                   </div>
                   <div className="flex-1">
                      <div className={cn("text-xs font-semibold", rainfallType === 'historical' ? "text-gray-900" : "text-gray-400")}>Historical Rainfall</div>
                      {rainfallType === 'historical' && <div className="text-[10px] text-gray-500">Heatmap Layer</div>}
                   </div>
                   {rainfallType === 'historical' && layers.heatmap && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>

                {/* Predicted Rainfall */}
                <div 
                   onClick={() => rainfallType === 'predicted' && setLayers(p => ({...p, heatmap: !p.heatmap}))}
                   className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none",
                      rainfallType === 'predicted' 
                         ? (layers.heatmap ? "bg-purple-50 border-purple-200 shadow-sm" : "bg-white border-gray-100 hover:border-purple-200")
                         : "bg-gray-50 border-transparent opacity-50 cursor-not-allowed"
                   )}
                >
                   <div className={cn("p-1.5 rounded-md", rainfallType === 'predicted' && layers.heatmap ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400")}>
                      <CloudRain className="w-4 h-4" />
                   </div>
                   <div className="flex-1">
                      <div className={cn("text-xs font-semibold", rainfallType === 'predicted' ? "text-gray-900" : "text-gray-400")}>Predicted Rainfall</div>
                      {rainfallType === 'predicted' && <div className="text-[10px] text-gray-500">Forecast Layer</div>}
                   </div>
                   {rainfallType === 'predicted' && layers.heatmap && <div className="w-2 h-2 rounded-full bg-purple-500" />}
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