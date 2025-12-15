import { motion, AnimatePresence } from "motion/react";
import { Region, RainfallType, RiskData, InsuranceProduct, DateRange } from "./types";
import { useState, useMemo } from "react";
import { Layers, CloudRain, AlertTriangle, Locate } from "lucide-react";
import { cn } from "../../lib/utils";
import { differenceInDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { rainfallHourly } from "../../lib/mockData";

interface MapWorkspaceProps {
  selectedRegion: Region;
  rainfallType: RainfallType;
  riskData: RiskData[];
  selectedProduct: InsuranceProduct | null;
  setSelectedRegion: (region: Region) => void;
  activeInputMode: "manual" | "chat";
  dateRange: DateRange;
  allRegionsData?: Record<string, any[]>;
}

export function MapWorkspace({ selectedRegion, rainfallType, riskData, selectedProduct, setSelectedRegion, activeInputMode, dateRange, allRegionsData }: MapWorkspaceProps) {
  // Layer visibility state
  const [layers, setLayers] = useState({
    heatmap: true, // Layer 1 & 2
    events: true,  // Layer 3 & 4
  });

  // Dynamic Map Data Generation based on Time Range & Type
  const mapRegionData = useMemo(() => {
     const districts = [
        { id: 'Jakarta Selatan', cx: 375, cy: 280, baseRisk: 0.8 },
        { id: 'Jakarta Timur', cx: 525, cy: 220, baseRisk: 0.5 },
        { id: 'Jakarta Barat', cx: 210, cy: 260, baseRisk: 0.3 }
     ];

     return districts.map(d => {
        if (!allRegionsData || !allRegionsData[d.id]) {
            return { ...d, count: 0 };
        }

        const regionData = allRegionsData[d.id];
        let count = 0;

        if (selectedProduct) {
             if (selectedProduct.id === 'daily') {
                 // Generate hourly (simulated to match dashboard)
                 const multiplier = rainfallType === 'predicted' ? 0.8 : 1.0;
                 const hourlyData: any[] = [];
                 regionData.forEach((day: any, dayIndex: number) => {
                     rainfallHourly.forEach((h: any, hIndex: number) => {
                         const amount = h.amount * multiplier * (0.8 + Math.sin(dayIndex * 24 + hIndex) * 0.4);
                         hourlyData.push({ amount });
                     });
                 });
                 
                 // Calc triggers (> 100mm / 4h)
                 const threshold = 100;
                 for (let i = 0; i < hourlyData.length; i++) {
                     let sum = hourlyData[i].amount;
                     for (let j = 1; j < 4; j++) {
                         if (i - j >= 0) sum += hourlyData[i - j].amount;
                     }
                     if (sum > threshold) count++;
                 }

             } else if (selectedProduct.id === 'weekly') {
                 // Calc triggers (> 300mm / 7d)
                 const threshold = 300;
                 for (let i = 0; i < regionData.length; i++) {
                     let sum = regionData[i].amount;
                     for (let j = 1; j < 7; j++) {
                         if (i - j >= 0) sum += regionData[i - j].amount;
                     }
                     if (sum > threshold) count++;
                 }

             } else if (selectedProduct.id === 'drought') {
                 // Calc triggers (< 60mm / month)
                 const threshold = 60;
                 const total = regionData.reduce((acc: number, curr: any) => acc + curr.amount, 0);
                 if (total < threshold) count = 1; 
             }
        } else {
             // Fallback generic logic (> 60mm daily)
             count = regionData.filter((day: any) => day.amount > 60).length;
        }
        
        return {
           ...d,
           count
        };
     });
  }, [allRegionsData, selectedProduct, rainfallType]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#eef2f6]">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{ 
           backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', 
           backgroundSize: '40px 40px' 
        }} 
      />

      {/* Map Container */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* We simulate a Google Maps view using SVG */}
        <div className="relative w-full h-full max-w-[1200px]">
           <svg viewBox="0 0 800 500" className="w-full h-full drop-shadow-sm" preserveAspectRatio="xMidYMid slice">
             <defs>
               <filter id="heatmap-blur" x="-50%" y="-50%" width="200%" height="200%">
                 <feGaussianBlur stdDeviation="15" />
               </filter>
               <radialGradient id="grad-selected" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                  <stop offset="100%" stopColor="#F0F7FF" stopOpacity="1" />
               </radialGradient>
             </defs>

             {/* Base Map: Provinces/Districts */}
             {/* District A (Jakarta Selatan - Selected) */}
             <path 
                d="M 300,200 L 450,180 L 500,280 L 400,380 L 250,350 Z" 
                fill={selectedRegion.district === 'Jakarta Selatan' ? 'url(#grad-selected)' : '#f1f3f4'}
                stroke={selectedRegion.district === 'Jakarta Selatan' ? '#4285F4' : 'transparent'}
                strokeWidth={selectedRegion.district === 'Jakarta Selatan' ? 3 : 0}
                className="transition-all duration-300 cursor-pointer hover:brightness-95"
                onClick={() => setSelectedRegion({...selectedRegion, district: 'Jakarta Selatan'})}
             />
             
             {/* District B (Jakarta Timur) */}
             <path 
                d="M 450,180 L 600,160 L 650,260 L 500,280 Z" 
                fill={selectedRegion.district === 'Jakarta Timur' ? 'url(#grad-selected)' : '#e5e7eb'}
                stroke={selectedRegion.district === 'Jakarta Timur' ? '#4285F4' : 'transparent'}
                strokeWidth={selectedRegion.district === 'Jakarta Timur' ? 3 : 0}
                className="transition-all duration-300 cursor-pointer hover:brightness-95 hover:fill-gray-200"
                onClick={() => setSelectedRegion({...selectedRegion, district: 'Jakarta Timur'})}
             />

             {/* District C (Jakarta Barat) */}
             <path 
                d="M 150,180 L 300,200 L 250,350 L 120,300 Z" 
                fill={selectedRegion.district === 'Jakarta Barat' ? 'url(#grad-selected)' : '#e5e7eb'}
                stroke={selectedRegion.district === 'Jakarta Barat' ? '#4285F4' : 'transparent'}
                strokeWidth={selectedRegion.district === 'Jakarta Barat' ? 3 : 0}
                className="transition-all duration-300 cursor-pointer hover:brightness-95 hover:fill-gray-200"
                onClick={() => setSelectedRegion({...selectedRegion, district: 'Jakarta Barat'})}
             />

             {/* --- LAYERS --- */}

             {/* Layer 1 & 2: Rainfall Heatmap */}
             {layers.heatmap && (
               <g className="pointer-events-none opacity-60 mix-blend-multiply">
                 {/* Heatmap depends on RainfallType */}
                 {rainfallType === 'historical' ? (
                    // Historical: Blueish
                    <>
                      <circle cx="380" cy="280" r="80" fill="#4285F4" filter="url(#heatmap-blur)" opacity="0.6" />
                      <circle cx="300" cy="250" r="60" fill="#8AB4F8" filter="url(#heatmap-blur)" opacity="0.4" />
                    </>
                 ) : (
                    // Predicted: Purple/Darker
                    <>
                       <circle cx="450" cy="220" r="90" fill="#9333ea" filter="url(#heatmap-blur)" opacity="0.5" />
                       <circle cx="380" cy="280" r="50" fill="#a855f7" filter="url(#heatmap-blur)" opacity="0.3" />
                    </>
                 )}
               </g>
             )}

             {/* Layer 3 & 4: Risk Events Bubbles */}
             {layers.events && selectedProduct && (
               <g className="pointer-events-none">
                  {mapRegionData.map((region) => {
                    const count = region.count;
                    
                    if (count === 0) return null;
                    
                    const isSelected = selectedRegion.district === region.id;
                    
                    // Unified base color for all regions per layer logic
                    // Layer 3 (Historical) -> Red (#ef4444)
                    // Layer 4 (Predicted) -> Orange (#f97316)
                    const baseColor = rainfallType === 'historical' ? '#ef4444' : '#f97316';

                    // Logic for size and opacity based on count
                    // More count -> Larger size, Darker (higher opacity)
                    const maxCount = 20; // Reference max
                    const sizeScale = 15 + (count / maxCount) * 25; // Radius between 15 and 40
                    const opacityScale = 0.3 + (count / maxCount) * 0.5; // Opacity between 0.3 and 0.8

                    return (
                      <g key={region.id}>
                        {/* Animated Risk Circle */}
                        <motion.circle
                          cx={region.cx}
                          cy={region.cy}
                          r={sizeScale}
                          fill={baseColor}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ 
                            scale: [0, 1.1, 1],
                            opacity: [0, opacityScale, opacityScale * 0.8] 
                          }}
                          transition={{ 
                            duration: 2.5, 
                            ease: "easeOut",
                            repeat: Infinity,
                            repeatDelay: 0.5
                          }}
                          style={{ originX: "50%", originY: "50%" }} // Ensure transform origin is center
                        />
                        
                        {/* Event Count Text (Only if selected) */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.text
                              x={region.cx}
                              y={region.cy}
                              dy={4} // Center vertically
                              textAnchor="middle"
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0 }}
                              className="fill-white font-bold text-[10px] drop-shadow-md pointer-events-none"
                              style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.3)' }}
                            >
                              {count} Events
                            </motion.text>
                          )}
                        </AnimatePresence>
                      </g>
                    );
                  })}
               </g>
             )}

             {/* Region Labels (Rendered last to be on top) */}
             <g className="pointer-events-none select-none">
                {mapRegionData.map((region) => {
                   const isSelected = selectedRegion.district === region.id;
                   // If selected AND events layer is visible (product selected + layer on), we show "X Events" at dy=4
                   // So move label up to dy=-10. Otherwise center it.
                   const showEvents = isSelected && layers.events && selectedProduct;

                   return (
                     <text
                       key={region.id}
                       x={region.cx}
                       y={region.cy}
                       dy={showEvents ? -10 : 4} 
                       textAnchor="middle"
                       className={cn(
                         "text-[10px] font-semibold tracking-tight transition-all duration-300",
                         isSelected ? "fill-slate-800" : "fill-slate-400 opacity-80"
                       )}
                       style={{ textShadow: '0px 1px 1px rgba(255,255,255,0.8)' }}
                     >
                       {region.id}
                     </text>
                   );
                })}
             </g>
           </svg>
        </div>
        
        {/* Layer Controls (Position depends on mode) */}
        <div className={cn(
           "absolute bottom-6 z-10 bg-white shadow-md rounded-lg p-1 border border-gray-200 flex flex-col gap-1 transition-all duration-500 ease-in-out",
           activeInputMode === 'manual' ? "right-6" : "left-6"
        )}>
          <button 
             onClick={() => setSelectedRegion({...selectedRegion, district: 'Jakarta Selatan'})}
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
    </div>
  );
}