
import { useState, useEffect, useMemo } from "react";
import { cn } from "../../lib/utils";
import { ControlPanel } from "./ControlPanel";
import { MapWorkspace } from "./MapWorkspace";
import { DataDashboard } from "./DataDashboard";
import { ContextualAssistant } from "./ContextualAssistant";
import { ProductSelector } from "./ProductSelector";
import { Region, RainfallType, RiskData, InsuranceProduct, DateRange } from "./types";
import { initialRiskData, rainfallHistory, rainfallPrediction } from "../../lib/mockData";
import { addDays, differenceInDays } from "date-fns";

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
    province: "West Java",
    district: "Jakarta Selatan" // Default as per prompt
  });
  const [rainfallType, setRainfallType] = useState<RainfallType>("historical");
  
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
  // Generate consistent data for all regions so Map and Dashboard match
  const allRegionsData = useMemo(() => {
     if (!dateRange.from || !dateRange.to) return {};
     
     const regions = ["Jakarta Selatan", "Jakarta Timur", "Jakarta Barat"];
     const sourceData = rainfallType === 'predicted' ? rainfallPrediction : rainfallHistory;
     const days = differenceInDays(dateRange.to, dateRange.from) + 1;
     
     const data: Record<string, any[]> = {};

     regions.forEach(regionName => {
         const items = [];
         const regionSeed = regionName.length; 
         
         for (let i = 0; i < days; i++) {
             const currentDate = addDays(dateRange.from, i);
             const sourceItem = sourceData[i % sourceData.length];
             
             // Variance logic (Must match what we want in DataDashboard)
             const variance = 0.8 + (Math.sin(i + regionSeed) * 0.4); 
             
             items.push({
                 date: currentDate.toISOString(),
                 amount: Math.max(0, sourceItem.amount * variance),
                 risk: sourceItem.risk
             });
         }
         data[regionName] = items;
     });
     
     return data;
  }, [dateRange, rainfallType]);

  // --- HANDLERS ---
  const handleRainfallTypeChange = (type: RainfallType) => {
    setRainfallType(type);
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
          rainfallType={rainfallType}
          riskData={riskData}
          selectedProduct={selectedProduct}
          setSelectedRegion={setSelectedRegion}
          activeInputMode={activeInputMode}
          dateRange={dateRange}
          allRegionsData={allRegionsData}
        />

        {/* Overlay: Manual Controls (Top Left) */}
        <div className={`absolute top-4 left-4 z-20 transition-all duration-500 ease-in-out ${activeInputMode === 'manual' ? 'h-[calc(100%-2rem)] opacity-100 translate-x-0' : 'h-auto opacity-100'}`}>
            <ControlPanel 
              isMinimized={activeInputMode !== 'manual'}
              onMaximize={() => handleInputModeChange('manual')}
              onMinimize={() => handleInputModeChange('chat')}
              selectedRegion={selectedRegion}
              setSelectedRegion={setSelectedRegion}
              rainfallType={rainfallType}
              setRainfallType={handleRainfallTypeChange}
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
            rainfallType={rainfallType}
            // Passing setters to allow AI to control state
            setRainfallType={setRainfallType}
            setSelectedRegion={setSelectedRegion}
            setSelectedProduct={setSelectedProduct}
          />
        </div>
        
      </div>

      {/* PART 2: RAINFALL DATA & RISK EVENTS (Flow Content) */}
      <div className="w-full bg-white relative z-10">
        <DataDashboard 
          selectedRegion={selectedRegion}
          rainfallType={rainfallType}
          dateRange={dateRange}
          selectedProduct={selectedProduct}
          onProductSelect={setSelectedProduct}
          dailyData={allRegionsData[selectedRegion.district] || []}
          onNavigateToProduct={onNavigateToProduct}
        />
      </div>

    </div>
  );
}
