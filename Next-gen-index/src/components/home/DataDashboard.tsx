
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, ComposedChart, Cell } from 'recharts';
import { Region, DataType, InsuranceProduct, DateRange, WeatherData, RiskEvent, RiskStatistics } from "./types";
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from '../../lib/utils';
import { AlertTriangle, CloudRain, ShieldCheck, BarChart3, ChevronDown, Clock, Activity, Waves, Info, Zap } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { PRODUCTS } from './ControlPanel';
import { format } from "date-fns";
import { productLibrary } from "../../lib/productLibrary";

interface DataDashboardProps {
  selectedRegion: Region;
  weatherDataType: DataType;
  dateRange: DateRange;
  selectedProduct: InsuranceProduct | null;
  onProductSelect: (product: InsuranceProduct | null) => void;
  dailyData: WeatherData[]; 
  hourlyData: WeatherData[];
  riskEvents: RiskEvent[];
  statistics: RiskStatistics;
  onNavigateToProduct: (section?: string) => void;
}

interface AnalysisItem extends WeatherData {
  amount: number;
  rollingSum?: number;
  cumulative?: number;
  isTriggered?: boolean;
  threshold?: number;
  totalRain?: number;
}

export function DataDashboard({ 
  selectedRegion, 
  weatherDataType, 
  dateRange, 
  selectedProduct, 
  onProductSelect, 
  dailyData, 
  hourlyData,
  riskEvents,
  statistics,
  onNavigateToProduct 
}: DataDashboardProps) {
  const [viewMode, setViewMode] = useState<"daily" | "hourly">("daily");

  // Automatically switch view mode based on product selection
  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.id === 'daily') {
        setViewMode('hourly');
      } else if (selectedProduct.id === 'weekly' || selectedProduct.id === 'drought') {
        setViewMode('daily');
      }
    }
  }, [selectedProduct]);

  // --- DATA FORMATTING FOR TREND CHART ---
  const trendData = useMemo(() => {
    const sourceData = viewMode === 'daily' ? dailyData : hourlyData;
    return sourceData.map(item => ({
      ...item,
      amount: item.value || 0
    }));
  }, [viewMode, dailyData, hourlyData]);

  // --- ANALYSIS CHART LOGIC (REFACTORED TO USE PRODUCT LIBRARY) ---
  const analysisData = useMemo<AnalysisItem[]>(() => {
    if (!selectedProduct) return [];

    const fullProduct = productLibrary.getProduct(selectedProduct.id);
    if (!fullProduct || !fullProduct.riskRules) return [];

    const { riskRules } = fullProduct;
    const { timeWindow, calculation, thresholds } = riskRules;
    const operator = calculation.operator;
    
    // Get the highest threshold for "Trigger" line on chart
    const triggerThreshold = thresholds.find(t => t.level === 'tier1')?.value || 0;

    if (fullProduct.type === 'daily') {
      const windowSize = timeWindow.size;
      return hourlyData.map((item, index) => {
        let sum = 0;
        for (let i = 0; i < windowSize; i++) {
          const prev = hourlyData[index - i];
          sum += prev ? prev.value : 0;
        }
        
        const isTriggered = operator === '>' ? sum > triggerThreshold : 
                          operator === '>=' ? sum >= triggerThreshold :
                          operator === '<' ? sum < triggerThreshold :
                          operator === '<=' ? sum <= triggerThreshold : sum === triggerThreshold;

        return {
          ...item,
          amount: item.value,
          rollingSum: sum,
          isTriggered,
          threshold: triggerThreshold
        };
      });
    }

    if (fullProduct.type === 'weekly') {
      const windowSize = timeWindow.size;
      return dailyData.map((item, index) => {
        let sum = 0;
        for (let i = 0; i < windowSize; i++) {
          const prev = dailyData[index - i];
          sum += prev ? prev.value : 0;
        }
        
        const isTriggered = operator === '>' ? sum > triggerThreshold : 
                          operator === '>=' ? sum >= triggerThreshold :
                          operator === '<' ? sum < triggerThreshold :
                          operator === '<=' ? sum <= triggerThreshold : sum === triggerThreshold;

        return {
          ...item,
          amount: item.value,
          rollingSum: sum,
          isTriggered,
          threshold: triggerThreshold
        };
      });
    }

    if (fullProduct.type === 'monthly') {
      let runningSum = 0;
      const totalRain = dailyData.reduce((acc, curr) => acc + curr.value, 0);
      
      return dailyData.map(item => {
        runningSum += item.value;
        const isTriggered = operator === '<' ? totalRain < triggerThreshold : 
                           operator === '<=' ? totalRain <= triggerThreshold : false;

        return {
          ...item,
          amount: item.value,
          cumulative: runningSum,
          totalRain,
          isTriggered,
          threshold: triggerThreshold
        };
      });
    }

    return [];
  }, [selectedProduct, dailyData, hourlyData]);

  // --- SUMMARY METRICS ---
  const summaryMetrics = useMemo(() => {
    const totalRain = trendData.reduce((acc, curr) => acc + curr.amount, 0);
    const avgRain = trendData.length > 0 ? totalRain / trendData.length : 0;
    
    // Severity Label Mapping
    const severityMap: Record<string, string> = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'none': '-',
      '-': '-'
    };

    return {
       timeWindow: viewMode === 'daily' ? `${trendData.length} Days` : `${trendData.length} Hours`,
       totalRain: totalRain.toFixed(1),
       avgRain: avgRain.toFixed(1),
       riskCount: statistics.total,
       severity: severityMap[statistics.severity] || statistics.severity,
       avgLabel: viewMode === 'daily' ? 'Avg. Daily Rainfall' : 'Avg. Hourly Rainfall'
    };
  }, [trendData, viewMode, statistics]);

  // Format Date Helper
  const formatDateAxis = (val: string | number | Date) => {
    try {
      if (!val) return "";
      const date = new Date(val);
      if (isNaN(date.getTime())) return String(val);

      if (viewMode === 'daily') {
        return format(date, "dd MMM"); 
      }
      return format(date, "dd/MM HH:mm");
    } catch (e) {
      return String(val);
    }
  };

  return (
    <div className="w-full flex flex-col p-8 max-w-[1440px] mx-auto">
      {/* 1. Header & Summary Stats */}
      <div className="mb-8">
         <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
            {selectedRegion.country} <span className="text-gray-300">•</span> {selectedRegion.province}
         </div>
         
         <div className="flex items-center gap-4">
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">{selectedRegion.district}</h2>
            
            <Badge className={cn(
               "h-7 px-3 text-[11px] font-bold uppercase tracking-wider rounded-lg border-0 shadow-none pointer-events-none",
               weatherDataType === 'historical' 
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-100" 
                  : "bg-purple-100 text-purple-700 hover:bg-purple-100"
            )}>
               {weatherDataType}
            </Badge>

            {selectedProduct && (
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Badge className="h-7 px-3 text-[11px] font-bold uppercase tracking-wider rounded-lg border-0 shadow-none bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer flex items-center gap-1.5 transition-colors">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {selectedProduct.name}
                        <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
                     </Badge>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px]">
                     {PRODUCTS.map((product) => (
                        <DropdownMenuItem 
                           key={product.id}
                           className="text-xs font-medium cursor-pointer"
                           onClick={() => onProductSelect(product)}
                        >
                           <span className="mr-2">{product.icon}</span>
                           {product.name}
                        </DropdownMenuItem>
                     ))}
                  </DropdownMenuContent>
               </DropdownMenu>
            )}
         </div>

         {dateRange.from && dateRange.to && (
             <div className="flex items-center gap-2 mt-3 text-gray-500 font-medium animate-in fade-in slide-in-from-left-2 duration-500 delay-100 pl-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold tracking-tight">
                   {format(dateRange.from, "MMM dd, yyyy")} {String(dateRange.startHour).padStart(2, '0')}:00
                   {' — '}
                   {format(dateRange.to, "MMM dd, yyyy")} {String(dateRange.endHour).padStart(2, '0')}:00
                </span>
             </div>
         )}

         <div className="mt-4 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2.5 text-xs text-blue-700 font-medium animate-in fade-in slide-in-from-left-2 duration-500 delay-200">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Tip: You can change the Region, Data Type, and Time Range using <strong>Map Settings</strong> or the <strong>AI Assistant</strong>.</span>
         </div>
      </div>

      {/* 1.5 Analysis Summary Section */}
      <div className="grid grid-cols-5 gap-4 mb-8">
         <Card className="bg-white border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-3 flex items-center gap-3">
               <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-blue-600" />
               </div>
               <div className="min-w-0">
                  <div className="text-xs text-gray-500 font-medium truncate" title="Time Window">Time Window</div>
                  <div className="text-lg font-bold text-gray-900 truncate">{summaryMetrics.timeWindow}</div>
               </div>
            </CardContent>
         </Card>

         <Card className="bg-white border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-3 flex items-center gap-3">
               <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-indigo-600" />
               </div>
               <div className="min-w-0">
                  <div className="text-xs text-gray-500 font-medium truncate w-full" title={summaryMetrics.avgLabel}>
                      {summaryMetrics.avgLabel}
                  </div>
                  <div className="text-lg font-bold text-gray-900 truncate">{summaryMetrics.avgRain} <span className="text-xs text-gray-400 font-normal">mm</span></div>
               </div>
            </CardContent>
         </Card>

         <Card className="bg-white border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-3 flex items-center gap-3">
               <div className="w-9 h-9 rounded-full bg-cyan-50 flex items-center justify-center shrink-0">
                  <Waves className="w-4 h-4 text-cyan-600" />
               </div>
               <div className="min-w-0">
                  <div className="text-xs text-gray-500 font-medium truncate" title="Total Rainfall">Total Rainfall</div>
                  <div className="text-lg font-bold text-gray-900 truncate">{summaryMetrics.totalRain} <span className="text-xs text-gray-400 font-normal">mm</span></div>
               </div>
            </CardContent>
         </Card>

         <Card className="bg-white border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-3 flex items-center gap-3">
               <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  summaryMetrics.riskCount > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
               )}>
                  {summaryMetrics.riskCount > 0 ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
               </div>
               <div className="min-w-0">
                  <div className="text-xs text-gray-500 font-medium truncate" title="Risk Events">Risk Events</div>
                  <div className={cn("text-lg font-bold truncate", summaryMetrics.riskCount > 0 ? "text-red-600" : "text-green-600")}>
                       {selectedProduct ? summaryMetrics.riskCount : "-"}
                  </div>
               </div>
            </CardContent>
         </Card>

         <Card className="bg-white border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-3 flex items-center gap-3">
               <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  summaryMetrics.severity === "High" ? "bg-red-50 text-red-600" :
                  summaryMetrics.severity === "Medium" ? "bg-orange-50 text-orange-600" :
                  "bg-green-50 text-green-600"
               )}>
                  <Zap className="w-4 h-4" />
               </div>
               <div className="min-w-0">
                  <div className="text-xs text-gray-500 font-medium truncate" title="Risk Severity">Risk Severity</div>
                  <div className={cn(
                      "text-lg font-bold truncate", 
                      summaryMetrics.severity === "High" ? "text-red-600" :
                      summaryMetrics.severity === "Medium" ? "text-orange-600" :
                      summaryMetrics.severity === "Low" ? "text-green-600" :
                      "text-gray-400"
                  )}>
                      {selectedProduct ? summaryMetrics.severity : "-"}
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>

      {/* 2. Main Chart Area */}
      <div className="space-y-8">
         <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm h-[350px] flex flex-col">
                 <div className="flex items-center justify-between mb-2 shrink-0">
                    <div className="flex items-center gap-2">
                       <CloudRain className="w-5 h-5 text-blue-600" />
                       <h3 className="font-bold text-gray-900">Rainfall Trends</h3>
                    </div>
                    
                    <Tabs value={viewMode} onValueChange={(v: string) => setViewMode(v as "daily" | "hourly")}>
                      <TabsList className="bg-gray-100 h-9 p-1">
                        <TabsTrigger value="daily" className="px-3 py-1 text-xs">Daily</TabsTrigger>
                        <TabsTrigger value="hourly" className="px-3 py-1 text-xs">Hourly</TabsTrigger>
                      </TabsList>
                    </Tabs>
                 </div>

                 <div className="flex-1 relative min-h-0 w-full">
                    <h4 className="absolute top-1/2 -left-6 transform -translate-y-1/2 -rotate-90 text-xs text-gray-400 font-medium origin-center whitespace-nowrap">
                      Rainfall (mm)
                    </h4>

                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <defs>
                          <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 12}}
                          tickFormatter={formatDateAxis} 
                          interval="preserveStartEnd"
                          minTickGap={50}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 12}}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        
                        <Bar 
                          dataKey="amount" 
                          fill="url(#colorBar)" 
                          radius={[6, 6, 0, 0]} 
                          barSize={viewMode === 'daily' ? 48 : 20}
                        />

                      </ComposedChart>
                    </ResponsiveContainer>
                 </div>
             </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2">
                {selectedProduct && analysisData.length > 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-2 mb-6">
                           <ShieldCheck className="w-5 h-5 text-green-600" />
                           <h3 className="font-bold text-gray-900">
                              Analysis: {selectedProduct.name}
                           </h3>
                           <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                              Threshold: {analysisData[0]?.threshold}mm
                           </Badge>
                        </div>

                        <div className="h-[280px] w-full relative">
                           <h4 className="absolute top-1/2 -left-6 transform -translate-y-1/2 -rotate-90 text-xs text-gray-400 font-medium origin-center whitespace-nowrap">
                              {selectedProduct.id === 'drought' ? 'Cumulative (mm)' : 'Rolling (mm)'}
                           </h4>

                           <ResponsiveContainer width="100%" height="100%">
                              {selectedProduct.id === 'drought' ? (
                                 <AreaChart data={analysisData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                    <defs>
                                      <linearGradient id="colorAreaRed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                                      </linearGradient>
                                      <linearGradient id="colorAreaBlue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                      dataKey="date" 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{fill: '#64748b', fontSize: 12}}
                                      tickFormatter={formatDateAxis}
                                      dy={10}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '12px' }} />
                                    
                                    {analysisData[0] && (
                                       <ReferenceLine y={analysisData[0].threshold} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Trigger', fill: '#ef4444', fontSize: 10 }} />
                                    )}

                                    <Area 
                                      type="monotone" 
                                      dataKey="cumulative" 
                                      stroke={analysisData[0]?.isTriggered ? "#ef4444" : "#3b82f6"} 
                                      fill={analysisData[0]?.isTriggered ? "url(#colorAreaRed)" : "url(#colorAreaBlue)"} 
                                    />
                                 </AreaChart>
                              ) : (
                                 <BarChart data={analysisData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                      dataKey="date" 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{fill: '#64748b', fontSize: 12}} 
                                      tickFormatter={formatDateAxis}
                                      interval="preserveStartEnd"
                                      minTickGap={50}
                                      dy={10}
                                    />
                                    <YAxis 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{fill: '#64748b', fontSize: 12}} 
                                      domain={[0, (dataMax: number) => Math.max(dataMax, (analysisData[0]?.threshold || 0) * 1.1)]}
                                    />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '12px' }} />
                                    
                                    {analysisData[0] && (
                                       <ReferenceLine y={analysisData[0].threshold} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Trigger', fill: '#ef4444', fontSize: 10 }} />
                                    )}
                                    
                                    <Bar dataKey="rollingSum" radius={[4, 4, 0, 0]} barSize={selectedProduct.id === 'daily' ? 20 : 40}>
                                      {analysisData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isTriggered ? '#ef4444' : '#e2e8f0'} />
                                      ))}
                                    </Bar>
                                 </BarChart>
                              )}
                           </ResponsiveContainer>
                        </div>
                    </div>
                ) : (
                    <div className="h-full bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6">
                           <BarChart3 className="w-10 h-10 text-gray-300" />
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">Product Analysis Unavailable</h4>
                        <p className="text-sm text-gray-500 max-w-[260px] leading-relaxed">
                           Select an Insurance Product from the map to visualize threshold and trigger conditions.
                        </p>
                    </div>
                )}
             </div>

             <div className="lg:col-span-1 h-[400px]">
               {selectedProduct ? (
                 <div className="h-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                   <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                     <div>
                       <h3 className="font-bold text-gray-900">Risk Analysis</h3>
                       <p className="text-xs text-gray-500 mt-0.5">Detected {riskEvents.length} trigger events</p>
                     </div>
                     <Badge variant="outline" className={cn(
                        "transition-colors",
                        summaryMetrics.severity === 'High' ? "bg-red-50 text-red-600 border-red-100" :
                        summaryMetrics.severity === 'Medium' ? "bg-orange-50 text-orange-600 border-orange-100" :
                        summaryMetrics.severity === 'Low' ? "bg-green-50 text-green-600 border-green-100" :
                        "bg-gray-50 text-gray-600 border-gray-100"
                     )}>
                        {summaryMetrics.severity === '-' ? '-' : `${summaryMetrics.severity} Risk`}
                     </Badge>
                   </div>
                   <div className="flex-1 overflow-y-auto p-5 space-y-5">
                      {riskEvents.map((event, idx) => (
                         <div key={idx} className="relative pl-5 border-l-2 border-red-100 pb-2 last:pb-0">
                            <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm" />
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-bold text-gray-500 uppercase">{format(new Date(event.timestamp), "yyyy-MM-dd")}</span>
                              <span className="text-[10px] text-gray-400 font-medium">{format(new Date(event.timestamp), "HH:mm")}</span>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 hover:border-red-200 transition-colors">
                               <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-gray-900 text-sm">{event.type}</span>
                               </div>
                               <p className="text-xs text-gray-600 leading-relaxed">{event.description}</p>
                            </div>
                         </div>
                      ))}
                   </div>
                 </div>
               ) : (
                  <div className="h-full bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8">
                     <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6">
                       <ShieldCheck className="w-10 h-10 text-gray-300" />
                     </div>
                     <h4 className="font-semibold text-gray-900 mb-2">Risk Analysis Unavailable</h4>
                     <p className="text-sm text-gray-500 max-w-[240px] leading-relaxed">
                       Select an Insurance Product from the map to visualize risk triggers and payout analysis.
                     </p>
                  </div>
               )}
             </div>
         </div>
      </div>

      <div className="mt-16 mb-4 text-center">
         <p className="text-sm text-gray-500">
            Want to understand the insurance product definitions and rules?{' '}
            <button 
               onClick={() => onNavigateToProduct('core-products')}
               className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors outline-none"
            >
               Click here
            </button>
         </p>
      </div>
    </div>
  );
}
