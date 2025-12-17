
import { useState, useEffect, useMemo } from "react";
import { cn } from "../../lib/utils";
import { ControlPanel } from "./ControlPanel";
import { MapWorkspace } from "./MapWorkspace";
import { DataDashboard } from "./DataDashboard";
import { ContextualAssistant } from "./ContextualAssistant";
import { ProductSelector } from "./ProductSelector";
import { Region, DataType, RiskData, InsuranceProduct, DateRange } from "./types";
import { initialRiskData } from "../../lib/mockData";
import { useWeatherData, useDailyWeatherData } from "../../hooks/useWeatherData";
import { convertRegionWeatherDataToRegionData } from "../../lib/dataAdapters";
import { addDays } from "date-fns";

export function Dashboard({ 
  onNavigateToProduct, 
  initialProduct 
}: { 
  onNavigateToProduct: (section?: string) => void;
  initialProduct?: InsuranceProduct | null;
}) {
  // --- STATE ---
  const [selectedRegion, setSelectedRegion] = useState<Region>({
    country: "Indonesia",
    province: "Jakarta",
    district: "JakartaSelatan"
  });
  const [weatherDataType, setWeatherDataType] = useState<DataType>("historical");
  
  // Default: Historical logic (7 days ago same time to Now - 1 hour)
  const today = new Date();
  const oneHourAgo = new Date(today.getTime() - 60 * 60 * 1000);
  const lastWeek = new Date(oneHourAgo);
  lastWeek.setDate(oneHourAgo.getDate() - 7);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: lastWeek,
    to: oneHourAgo,
    startHour: oneHourAgo.getHours(),
    endHour: oneHourAgo.getHours()
  });

  const [selectedProduct, setSelectedProduct] = useState<InsuranceProduct | null>(initialProduct || null);
  
  // Input Mode: "manual" or "chat". Default "chat" as per prompt.
  const [activeInputMode, setActiveInputMode] = useState<"manual" | "chat">("chat");

  // Mock data
  const [riskData] = useState<RiskData[]>(initialRiskData);

  // --- CENTRALIZED DATA GENERATION ---
  // 使用通用天气数据生成器生成所有区域的数据（weatherType: 'rainfall'）
  const allRegionsHourlyWeatherData = useWeatherData(selectedRegion, dateRange, weatherDataType, 'rainfall');
  
  // 生成日级数据（从小时级数据累计）
  const allRegionsDailyWeatherData = useDailyWeatherData(allRegionsHourlyWeatherData, dateRange, 'rainfall');
  
  // 为了兼容现有代码（MapWorkspace等可能仍使用RegionData格式），提供转换后的数据
  const allRegionsData = useMemo(() => {
    // 转换为RegionData格式（向后兼容）
    return convertRegionWeatherDataToRegionData(allRegionsHourlyWeatherData);
  }, [allRegionsHourlyWeatherData]);

  // --- HANDLERS ---
  const handleWeatherDataTypeChange = (type: DataType) => {
    setWeatherDataType(type);
    const now = new Date();
    
    if (type === 'predicted') {
      // Predicted: Today to +10 days
      const future = new Date(now);
      future.setDate(now.getDate() + 10);
      setDateRange({
        from: now,
        to: future,
        startHour: now.getHours(), // Start from current hour
        endHour: now.getHours()    // End hour matches start hour (exact 10 day window)
      });
    } else {
      // Historical: 7 days ago (same time) to Now - 1 hour
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const past = new Date(oneHourAgo);
      past.setDate(oneHourAgo.getDate() - 7);
      
      setDateRange({
        from: past,
        to: oneHourAgo,
        startHour: oneHourAgo.getHours(),
        endHour: oneHourAgo.getHours()
      });
    }
  };

  const handleInputModeChange = (mode: "manual" | "chat") => {
    setActiveInputMode(mode);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-gray-50 font-sans">
      
      {/* PART 1: CUSTOM MAP (Fixed Height) */}
      <div className="relative h-[600px] w-full border-b border-gray-200 overflow-hidden shrink-0 group">
        <MapWorkspace 
          selectedRegion={selectedRegion} 
          weatherDataType={weatherDataType}
          riskData={riskData}
          selectedProduct={selectedProduct}
          setSelectedRegion={setSelectedRegion}
          activeInputMode={activeInputMode}
          dateRange={dateRange}
          allRegionsWeatherData={allRegionsHourlyWeatherData}
        />

        {/* Overlay: Manual Controls (Top Left) */}
        <div className={`absolute top-4 left-4 z-20 transition-all duration-500 ease-in-out ${activeInputMode === 'manual' ? 'h-[calc(100%-2rem)] opacity-100 translate-x-0' : 'h-auto opacity-100'}`}>
            <ControlPanel 
              isMinimized={activeInputMode !== 'manual'}
              onMaximize={() => handleInputModeChange('manual')}
              onMinimize={() => handleInputModeChange('chat')}
              selectedRegion={selectedRegion}
              setSelectedRegion={setSelectedRegion}
              weatherDataType={weatherDataType}
              setWeatherDataType={handleWeatherDataTypeChange}
              dateRange={dateRange}
              setDateRange={setDateRange}
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
              onNavigateToProduct={onNavigateToProduct}
            />
        </div>

        {/* Floating Product Chips - Vertical Layout under minimized button */}
        <div className={cn(
            "absolute z-20 transition-all duration-500 ease-in-out",
            activeInputMode === 'manual' 
              ? "top-20 right-4"  // Under Contextual Assistant Button (Right)
              : "top-20 left-4"   // Under Map Control Button (Left)
        )}>
             <ProductSelector 
                  className={cn(
                    "flex-col overflow-visible h-auto",
                    activeInputMode === 'manual' ? "items-end" : "items-start"
                  )}
                  selectedProduct={selectedProduct}
                  setSelectedProduct={setSelectedProduct}
                  onNavigateToProduct={onNavigateToProduct}
             />
        </div>

        {/* Overlay: Contextual Chat (Right Side) */}
        <div className={`absolute top-4 right-4 h-[calc(100%-2rem)] z-30 transition-all duration-500 ease-in-out flex flex-col items-end ${activeInputMode === 'chat' ? 'w-1/4 min-w-[350px]' : 'w-auto h-auto'}`}>
          <ContextualAssistant 
            isMinimized={activeInputMode !== 'chat'}
            onMaximize={() => handleInputModeChange('chat')}
            onMinimize={() => handleInputModeChange('manual')}
            selectedRegion={selectedRegion}
            weatherDataType={weatherDataType}
            // Passing setters to allow AI to control state
            setWeatherDataType={setWeatherDataType}
            setSelectedRegion={setSelectedRegion}
            setSelectedProduct={setSelectedProduct}
          />
        </div>
        
      </div>

      {/* PART 2: RAINFALL DATA & RISK EVENTS (Flow Content) */}
      <div className="w-full bg-white relative z-10">
        <DataDashboard 
          selectedRegion={selectedRegion}
          weatherDataType={weatherDataType}
          dateRange={dateRange}
          selectedProduct={selectedProduct}
          onProductSelect={setSelectedProduct}
          dailyData={allRegionsDailyWeatherData[selectedRegion.district] || allRegionsHourlyWeatherData[selectedRegion.district] || []}
          onNavigateToProduct={onNavigateToProduct}
        />
      </div>

    </div>
  );
}
