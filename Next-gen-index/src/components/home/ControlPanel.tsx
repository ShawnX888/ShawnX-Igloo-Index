
import { Calendar as CalendarIcon, ChevronDown, ChevronRight, ChevronLeft, MapPin, Droplets, ShieldCheck, Clock, Search, Minimize2, Settings2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";
import { Region, RainfallType, InsuranceProduct, DateRange } from "./types";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Card } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";

interface ControlPanelProps {
  isMinimized: boolean;
  onMaximize?: () => void;
  onMinimize: () => void;
  selectedRegion: Region;
  setSelectedRegion: (region: Region) => void;
  rainfallType: RainfallType;
  setRainfallType: (type: RainfallType) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  selectedProduct: InsuranceProduct | null;
  setSelectedProduct: (product: InsuranceProduct | null) => void;
  onNavigateToProduct: () => void;
}

// Mock Product Data (Shared)
export const PRODUCTS: InsuranceProduct[] = [
  { id: "daily", name: "Daily Heavy Rain", description: ">100mm / 4h", icon: "🌧️" },
  { id: "weekly", name: "Weekly Accumulation", description: ">300mm / week", icon: "📅" },
  { id: "drought", name: "Drought Defense", description: "<10mm / month", icon: "☀️" },
];

export function ControlPanel({
  isMinimized,
  onMaximize,
  onMinimize,
  selectedRegion,
  setSelectedRegion,
  rainfallType,
  setRainfallType,
  dateRange,
  setDateRange,
  selectedProduct,
  setSelectedProduct,
  onNavigateToProduct
}: ControlPanelProps) {
  
  // If minimized, show a horizontal floating button
  if (isMinimized) {
    return (
      <div className="flex items-center justify-start pointer-events-auto">
        <Button 
          onClick={onMaximize}
          className="h-12 px-5 bg-white border border-gray-200 shadow-lg text-gray-700 hover:text-blue-600 hover:bg-gray-50 hover:border-blue-200 rounded-full flex items-center gap-3 transition-all duration-300 group"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
            <Settings2 className="w-4 h-4 text-blue-600 group-hover:text-white" />
          </div>
          <span className="font-semibold text-sm">Map Settings</span>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
        </Button>
      </div>
    );
  }

  // Mock Data for Cascading Location
  const HIERARCHY: Record<string, Record<string, string[]>> = {
    "Indonesia": {
      "Jakarta": ["Jakarta Selatan", "Jakarta Timur", "Jakarta Barat", "Jakarta Pusat"],
      "West Java": ["Bandung", "Bogor", "Bekasi"],
      "Bali": ["Denpasar", "Ubud"]
    },
    "Thailand": {
      "Bangkok": ["Bang Rak", "Pathum Wan", "Chatuchak"],
      "Chiang Mai": ["Mueang", "Mae Rim"]
    },
    "Vietnam": {
       "Ho Chi Minh": ["District 1", "District 3", "Thu Duc"],
       "Hanoi": ["Hoan Kiem", "Tay Ho"]
    }
  };

  // State for the custom cascading popover
  const [locationStep, setLocationStep] = useState<1 | 2 | 3>(1);
  const [tempCountry, setTempCountry] = useState<string>("");
  const [tempProvince, setTempProvince] = useState<string>("");
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  // Reset wizard when opening
  const handleLocationOpenChange = (open: boolean) => {
      setIsLocationOpen(open);
      if (open) {
          setLocationStep(1);
          setTempCountry("");
          setTempProvince("");
      }
  };

  const handleCountrySelect = (c: string) => {
      setTempCountry(c);
      setLocationStep(2);
  };

  const handleProvinceSelect = (p: string) => {
      setTempProvince(p);
      setLocationStep(3);
  };

  const handleDistrictSelect = (d: string) => {
      setSelectedRegion({
          country: tempCountry,
          province: tempProvince,
          district: d
      });
      setIsLocationOpen(false);
  };

  const countries = Object.keys(HIERARCHY);
  const provinces = tempCountry ? Object.keys(HIERARCHY[tempCountry] || {}) : [];
  const districts = tempCountry && tempProvince ? (HIERARCHY[tempCountry][tempProvince] || []) : [];

  return (
    <Card className="w-[360px] h-full flex flex-col bg-white shadow-xl border-0 rounded-xl overflow-hidden animate-in slide-in-from-left fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50 shrink-0">
        <h3 className="font-semibold text-gray-900 text-sm">Map Settings</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-gray-900" onClick={onMinimize}>
          <Minimize2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-3 pb-2">
            {/* 1. Region Selection (Step-by-Step Cascading) */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-gray-900 font-semibold border-b border-gray-100 pb-1.5">
                 <MapPin className="w-3.5 h-3.5 text-red-600" />
                 <h3 className="text-xs">Location</h3>
              </div>
              
              {/* Search Box simulation */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input placeholder="Search areas..." className="pl-8 bg-gray-50 border-gray-200 focus-visible:ring-blue-500 h-9 text-xs" />
              </div>

              {/* Single Cascading Dropdown */}
              <Popover open={isLocationOpen} onOpenChange={handleLocationOpenChange}>
                <PopoverTrigger asChild>
                   <Button variant="outline" className="w-full justify-between bg-white border-gray-200 text-left font-normal h-auto py-2">
                      <div className="flex flex-col items-start gap-0.5">
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Selected Region</span>
                          <span className="text-sm font-medium text-gray-900 truncate w-full">
                            {selectedRegion.country} &gt; {selectedRegion.province} &gt; {selectedRegion.district}
                          </span>
                      </div>
                      <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                   </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                   {/* Step 1: Country */}
                   {locationStep === 1 && (
                       <div className="p-1">
                           <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Select Country</div>
                           {countries.map(c => (
                               <div 
                                 key={c} 
                                 onClick={() => handleCountrySelect(c)}
                                 className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-100 rounded-md cursor-pointer text-sm"
                               >
                                  <span>{c}</span>
                                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                               </div>
                           ))}
                       </div>
                   )}

                   {/* Step 2: Province */}
                   {locationStep === 2 && (
                       <div className="p-1">
                           <div className="flex items-center gap-1 mb-1 px-1">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setLocationStep(1)}>
                                 <ChevronLeft className="w-3 h-3" />
                              </Button>
                              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Select Province in {tempCountry}</span>
                           </div>
                           <div className="max-h-[200px] overflow-y-auto">
                               {provinces.map(p => (
                                   <div 
                                     key={p} 
                                     onClick={() => handleProvinceSelect(p)}
                                     className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-100 rounded-md cursor-pointer text-sm"
                                   >
                                      <span>{p}</span>
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}

                   {/* Step 3: District */}
                   {locationStep === 3 && (
                       <div className="p-1">
                           <div className="flex items-center gap-1 mb-1 px-1">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setLocationStep(2)}>
                                 <ChevronLeft className="w-3 h-3" />
                              </Button>
                              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Select District in {tempProvince}</span>
                           </div>
                           <div className="max-h-[200px] overflow-y-auto">
                               {districts.map(d => (
                                   <div 
                                     key={d} 
                                     onClick={() => handleDistrictSelect(d)}
                                     className="flex items-center justify-between px-2 py-1.5 hover:bg-blue-50 text-gray-900 hover:text-blue-700 rounded-md cursor-pointer text-sm"
                                   >
                                      <span>{d}</span>
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}
                </PopoverContent>
              </Popover>
            </div>

          {/* 2. Data Type */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-900 font-semibold border-b border-gray-100 pb-1.5">
               <Droplets className="w-3.5 h-3.5 text-blue-600" />
               <h3 className="text-xs">Data Source</h3>
            </div>
            
            <div className="flex bg-gray-100 p-0.5 rounded-lg">
              <button 
                onClick={() => setRainfallType('historical')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                  rainfallType === 'historical' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
                )}
              >
                Historical
              </button>
              <button 
                onClick={() => setRainfallType('predicted')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                  rainfallType === 'predicted' ? "bg-white shadow-sm text-purple-600" : "text-gray-500 hover:text-gray-700"
                )}
              >
                Predicted
              </button>
            </div>

            {/* Date Time Picker (Always visible, read-only for Predicted) */}
             <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase">
                     <Clock className="w-3 h-3" /> {rainfallType === 'predicted' ? 'Forecast Window' : 'Time Window'}
                  </div>
                  {rainfallType === 'predicted' && (
                    <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-medium">
                      Next 10 Days
                    </span>
                  )}
                </div>
                
                <div className="space-y-2">
                  {/* Start Time */}
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-gray-400 font-medium ml-1">START TIME</label>
                    <div className="flex gap-1.5">
                       <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={rainfallType === 'predicted'}
                            className={cn(
                              "flex-1 justify-start text-left font-normal bg-white border-gray-200 h-8 text-xs disabled:opacity-80 disabled:bg-gray-100",
                              rainfallType === 'predicted' && "text-gray-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3 text-gray-400" />
                            {format(dateRange.from, "MMM dd, yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.from} onSelect={(d) => d && setDateRange({...dateRange, from: d})} /></PopoverContent>
                       </Popover>
                       <Input 
                         type="number" min={0} max={23} 
                         value={dateRange.startHour} 
                         disabled={rainfallType === 'predicted'}
                         onChange={(e) => setDateRange({...dateRange, startHour: parseInt(e.target.value)})}
                         className="w-12 bg-white border-gray-200 text-center h-8 text-xs p-0 disabled:opacity-80 disabled:bg-gray-100"
                         placeholder="00"
                       />
                       <div className="flex items-center text-[10px] text-gray-400 font-medium">H</div>
                    </div>
                  </div>

                  {/* End Time */}
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-gray-400 font-medium ml-1">END TIME</label>
                    <div className="flex gap-1.5">
                       <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={rainfallType === 'predicted'}
                            className={cn(
                              "flex-1 justify-start text-left font-normal bg-white border-gray-200 h-8 text-xs disabled:opacity-80 disabled:bg-gray-100",
                              rainfallType === 'predicted' && "text-gray-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3 text-gray-400" />
                            {format(dateRange.to, "MMM dd, yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.to} onSelect={(d) => d && setDateRange({...dateRange, to: d})} /></PopoverContent>
                       </Popover>
                       <Input 
                         type="number" min={0} max={23} 
                         value={dateRange.endHour} 
                         disabled={rainfallType === 'predicted'}
                         onChange={(e) => setDateRange({...dateRange, endHour: parseInt(e.target.value)})}
                         className="w-12 bg-white border-gray-200 text-center h-8 text-xs p-0 disabled:opacity-80 disabled:bg-gray-100"
                         placeholder="23"
                       />
                       <div className="flex items-center text-[10px] text-gray-400 font-medium">H</div>
                    </div>
                  </div>
                </div>
             </div>
          </div>

          {/* 3. Insurance Products (Moved to Dashboard Overlay) */}
          {/* Removed from here as per request */}
        </div>
      </div>
    </Card>
  );
}
