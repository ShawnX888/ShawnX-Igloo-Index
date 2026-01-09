
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, ComposedChart, Cell } from 'recharts';
import { Region, DataType, InsuranceProduct, DateRange, WeatherData, RiskEvent, RiskStatistics, WeatherStatistics } from "./types";
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from '../../lib/utils';
import { AlertTriangle, CloudRain, ShieldCheck, BarChart3, ChevronDown, Clock, Activity, Waves, Info, Zap } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { PRODUCTS } from './ControlPanel';
import { format, startOfMonth } from "date-fns";
import { productLibrary } from "../../lib/productLibrary";
import { useExtendedWeatherData } from "../../hooks/useExtendedWeatherData";
import { utcToLocal, formatUTCDate } from '../../lib/timeUtils';

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
  weatherStatistics: WeatherStatistics;
  onNavigateToProduct: (section?: string) => void;
}

interface AnalysisItem extends WeatherData {
  amount: number;
  rollingSum?: number;
  cumulative?: number;
  isTriggered?: boolean;
  riskLevel?: 'tier1' | 'tier2' | 'tier3' | null;
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
  weatherStatistics,
  onNavigateToProduct 
}: DataDashboardProps) {
  // Initialize viewMode based on selectedProduct
  // This avoids incorrect initial display when an hourly product is selected
  const getInitialViewMode = (): "daily" | "hourly" => {
    if (selectedProduct) {
      const fullProduct = productLibrary.getProduct(selectedProduct.id);
      if (fullProduct?.riskRules?.timeWindow) {
        const timeWindowType = fullProduct.riskRules.timeWindow.type;
        if (timeWindowType === 'hourly') {
          return 'hourly';
        } else if (timeWindowType === 'daily' || timeWindowType === 'weekly' || timeWindowType === 'monthly') {
          return 'daily';
        }
      }
    }
    return 'daily'; // Default to daily
  };

  const [viewMode, setViewMode] = useState<"daily" | "hourly">(getInitialViewMode());

  // Automatically switch view mode based on product riskRules.timeWindow.type
  useEffect(() => {
    if (selectedProduct) {
      const fullProduct = productLibrary.getProduct(selectedProduct.id);
      if (fullProduct?.riskRules?.timeWindow) {
        const timeWindowType = fullProduct.riskRules.timeWindow.type;
        if (timeWindowType === 'hourly') {
          setViewMode('hourly');
        } else if (timeWindowType === 'daily' || timeWindowType === 'weekly' || timeWindowType === 'monthly') {
          setViewMode('daily');
        }
      }
    } else {
      // Reset to daily when no product is selected
      setViewMode('daily');
    }
  }, [selectedProduct]);

  // Get extended weather data (for overlay chart and risk event calculation)
  // This ensures accurate calculation at the start position of the time window
  const {
    extendedHourlyData,
    extendedDailyData,
  } = useExtendedWeatherData(
    selectedRegion,
    dateRange,
    weatherDataType,
    'rainfall',
    selectedProduct
  );


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
    if (!selectedProduct) {
      return [];
    }

    const fullProduct = productLibrary.getProduct(selectedProduct.id);
    if (!fullProduct || !fullProduct.riskRules) {
      return [];
    }

    const { riskRules } = fullProduct;
    const { timeWindow, calculation, thresholds } = riskRules;
    const operator = calculation.operator;
    const aggregation = calculation.aggregation;
    const windowSize = timeWindow.size;

    // Use extended data for calculation, but filter to display only user-selected time window
    // For daily/weekly products, we need extended daily data to calculate rolling window correctly
    // For monthly products, we need extended daily data to calculate cumulative from month start
    const sourceData = timeWindow.type === 'hourly' 
      ? (extendedHourlyData.length > 0 ? extendedHourlyData : hourlyData)
      : (extendedDailyData.length > 0 ? extendedDailyData : dailyData);
    
    const displayData = timeWindow.type === 'hourly' ? hourlyData : dailyData;
    
    // Early return if displayData is empty
    if (displayData.length === 0) {
      console.warn('[DataDashboard] Display data is empty', {
        productId: selectedProduct?.id,
        timeWindowType: timeWindow.type,
        hourlyDataLength: hourlyData.length,
        dailyDataLength: dailyData.length,
        extendedHourlyDataLength: extendedHourlyData.length,
        extendedDailyDataLength: extendedDailyData.length
      });
      return [];
    }
    
    // Enhanced error handling: Warn if extended data is empty and we're falling back to original data
    // This is important because original data may not contain the lookback data needed for accurate calculation
    if (timeWindow.type === 'hourly' && extendedHourlyData.length === 0) {
      console.warn('[DataDashboard] ⚠️ Extended hourly data is empty, falling back to original data. Calculation accuracy may be affected at the start position.', {
        productId: selectedProduct?.id,
        timeWindowType: timeWindow.type,
        windowSize,
        extendedHourlyDataLength: extendedHourlyData.length,
        hourlyDataLength: hourlyData.length,
        extendedDateRange: extendedHourlyData.length === 0 ? 'not available' : 'available',
        impact: 'The first data point may not have accurate lookback data for rolling window calculation'
      });
    } else if ((timeWindow.type === 'daily' || timeWindow.type === 'weekly' || timeWindow.type === 'monthly') && extendedDailyData.length === 0) {
      console.warn('[DataDashboard] ⚠️ Extended daily data is empty, falling back to original data. Calculation accuracy may be affected at the start position.', {
        productId: selectedProduct?.id,
        timeWindowType: timeWindow.type,
        windowSize,
        extendedDailyDataLength: extendedDailyData.length,
        dailyDataLength: dailyData.length,
        extendedDateRange: extendedDailyData.length === 0 ? 'not available' : 'available',
        impact: 'The first data point may not have accurate lookback data for rolling window or cumulative calculation'
      });
    }
    
    // Helper function to calculate aggregated value
    const calculateAggregatedValue = (windowData: WeatherData[]): number => {
      if (windowData.length === 0) return 0;
      
      if (aggregation === 'sum') {
        return windowData.reduce((sum, d) => sum + d.value, 0);
      } else if (aggregation === 'average') {
        return windowData.reduce((sum, d) => sum + d.value, 0) / windowData.length;
      } else if (aggregation === 'max') {
        return Math.max(...windowData.map(d => d.value));
      } else if (aggregation === 'min') {
        return Math.min(...windowData.map(d => d.value));
      }
      return 0;
    };

    // Helper function to check if value triggers threshold
    const checkThreshold = (value: number, thresholdValue: number): boolean => {
      if (operator === '>') return value > thresholdValue;
      if (operator === '>=') return value >= thresholdValue;
      if (operator === '<') return value < thresholdValue;
      if (operator === '<=') return value <= thresholdValue;
      if (operator === '==') return value === thresholdValue;
      return false;
    };

    // Helper function to find matching risk event
    const findMatchingRiskEvent = (itemDate: string): RiskEvent | undefined => {
      const itemTime = new Date(itemDate).getTime();
      return riskEvents.find(event => {
        const eventTime = new Date(event.timestamp).getTime();
        // Match within 1 hour for hourly data, or same day for daily data
        const tolerance = timeWindow.type === 'hourly' ? 3600000 : 86400000;
        return Math.abs(eventTime - itemTime) < tolerance;
      });
    };

    // Process based on timeWindow.type
    if (timeWindow.type === 'hourly') {
      // For hourly data, calculate rolling window
      return displayData.map((displayItem) => {
        // Find the index of this item in the extended data
        const displayItemTime = new Date(displayItem.date).getTime();
        const displayIndex = sourceData.findIndex((item) => {
          const itemTime = new Date(item.date).getTime();
          return Math.abs(itemTime - displayItemTime) < 3600000; // 1 hour tolerance
        });

        if (displayIndex === -1) {
          return {
            ...displayItem,
            amount: displayItem.value,
            rollingSum: 0,
            isTriggered: false,
            riskLevel: null,
            threshold: thresholds[0]?.value || 0
          };
        }

        // Get window data: [displayIndex - windowSize, ..., displayIndex]
        const windowData: WeatherData[] = [];
        for (let i = 0; i <= windowSize; i++) {
          const idx = displayIndex - i;
          if (idx >= 0 && idx < sourceData.length) {
            windowData.unshift(sourceData[idx]); // Add to beginning to maintain chronological order
          }
        }

        const calculatedValue = calculateAggregatedValue(windowData);
        const matchingEvent = findMatchingRiskEvent(displayItem.date);
        const riskLevel = matchingEvent?.level || null;

        // IMPORTANT: isTriggered should be based on matchingEvent, not just threshold check
        // This ensures that only events within the user-selected time window are marked as triggered
        // The matchingEvent is already filtered to the user's dateRange in riskEvents
        const isTriggered = !!matchingEvent;

        return {
          ...displayItem,
          amount: displayItem.value,
          rollingSum: calculatedValue,
          isTriggered,
          riskLevel,
          threshold: thresholds[0]?.value || 0
        };
      });
    } else if (timeWindow.type === 'daily' || timeWindow.type === 'weekly') {
      // For daily/weekly data, calculate rolling window
      return displayData.map((displayItem) => {
        // Find the index in sourceData (extended data) by matching date
        // Use a more robust date comparison to handle potential timezone issues
        const displayItemTime = new Date(displayItem.date).getTime();
        const displayIndex = sourceData.findIndex((item) => {
          const itemTime = new Date(item.date).getTime();
          // Match within 12 hours to handle potential timezone differences
          return Math.abs(itemTime - displayItemTime) < 12 * 60 * 60 * 1000;
        });

        if (displayIndex === -1) {
          // If not found in extended data, this should not happen if extended data is correctly generated
          // Fallback: try to calculate with available data, but this may be inaccurate
          return {
            ...displayItem,
            amount: displayItem.value,
            rollingSum: 0,
            isTriggered: false,
            riskLevel: null,
            threshold: thresholds[0]?.value || 0
          };
        }

        // Get window data: [displayIndex - windowSize, ..., displayIndex]
        // This should include windowSize + 1 data points (windowSize previous + current)
        const windowData: WeatherData[] = [];
        for (let i = 0; i <= windowSize; i++) {
          const idx = displayIndex - i;
          if (idx >= 0 && idx < sourceData.length) {
            windowData.unshift(sourceData[idx]);
          }
        }

        const calculatedValue = calculateAggregatedValue(windowData);
        const matchingEvent = findMatchingRiskEvent(displayItem.date);
        const riskLevel = matchingEvent?.level || null;

        // IMPORTANT: isTriggered should be based on matchingEvent, not just threshold check
        // This ensures that only events within the user-selected time window are marked as triggered
        // The matchingEvent is already filtered to the user's dateRange in riskEvents
        const isTriggered = !!matchingEvent;

        return {
          ...displayItem,
          amount: displayItem.value,
          rollingSum: calculatedValue,
          isTriggered,
          riskLevel,
          threshold: thresholds[0]?.value || 0
        };
      });
    } else if (timeWindow.type === 'monthly') {
      // For monthly data, calculate cumulative from month start
      // Use UTC timezone to ensure alignment with extended data and risk calculation
      // Get month start (1st day, 00:00:00 UTC)
      const monthStart = new Date(Date.UTC(
        dateRange.from.getUTCFullYear(),
        dateRange.from.getUTCMonth(),
        1, // 1st day
        0, 0, 0, 0
      ));

      // Early return if sourceData is empty
      if (sourceData.length === 0) {
        console.warn('[DataDashboard] Source data is empty for monthly product', {
          productId: selectedProduct?.id,
          extendedDailyDataLength: extendedDailyData.length,
          dailyDataLength: dailyData.length,
          dateRange: {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString()
          }
        });
        return [];
      }

      // Calculate total for the month from extended data
      // Extended data should include data from month start to dateRange.to
      // All dates use UTC timezone for consistency with data generation and risk calculation
      const monthData = sourceData.filter(item => {
        const itemDate = new Date(item.date);
        // Compare dates using UTC timezone
        return itemDate.getTime() >= monthStart.getTime() && itemDate.getTime() <= dateRange.to.getTime();
      });
      const totalRain = calculateAggregatedValue(monthData);

      // Calculate cumulative sum from month start for each display data point
      // IMPORTANT: Use extended data (sourceData) to calculate cumulative from month start,
      // not just displayData, so the first data point includes all data from month start
      return displayData.map(displayItem => {
        // Find the index of this display item in the extended data (sourceData)
        const displayItemTime = new Date(displayItem.date).getTime();
        const displayIndex = sourceData.findIndex((item) => {
          const itemTime = new Date(item.date).getTime();
          // Match within 12 hours to handle potential timezone differences
          return Math.abs(itemTime - displayItemTime) < 12 * 60 * 60 * 1000;
        });

        // Calculate cumulative from month start to this display item
        // Filter data from month start up to and including this display item, then sum
        let cumulative = 0;
        if (displayIndex >= 0) {
          // Get all data from month start to displayIndex (inclusive)
          // IMPORTANT: Only include data up to the display item's date, not beyond
          const cumulativeData = sourceData.slice(0, displayIndex + 1).filter(item => {
            const itemDate = new Date(item.date);
            const itemYear = itemDate.getUTCFullYear();
            const itemMonth = itemDate.getUTCMonth();
            const itemDay = itemDate.getUTCDate();
            const monthStartYear = monthStart.getUTCFullYear();
            const monthStartMonth = monthStart.getUTCMonth();
            const monthStartDay = monthStart.getUTCDate();
            const displayItemDate = new Date(displayItem.date);
            
            // Check if this item is >= month start date and <= display item date
            const isAfterMonthStart = itemYear > monthStartYear || 
              (itemYear === monthStartYear && itemMonth > monthStartMonth) ||
              (itemYear === monthStartYear && itemMonth === monthStartMonth && itemDay >= monthStartDay);
            const isBeforeOrEqualDisplayItem = itemDate <= displayItemDate;
            
            return isAfterMonthStart && isBeforeOrEqualDisplayItem;
          });
          cumulative = calculateAggregatedValue(cumulativeData);
        } else {
          // Fallback: if not found in extended data, use displayItem value
          // This should not happen if extended data is correctly generated
          console.warn('[DataDashboard] Display item not found in extended data for monthly product', {
            displayItemDate: displayItem.date,
            sourceDataLength: sourceData.length,
            productId: selectedProduct?.id
          });
          cumulative = displayItem.value;
        }

        const matchingEvent = findMatchingRiskEvent(displayItem.date);
        const riskLevel = matchingEvent?.level || null;

        // IMPORTANT: isTriggered should be based on matchingEvent, not just threshold check
        // This ensures that only events within the user-selected time window are marked as triggered
        // The matchingEvent is already filtered to the user's dateRange in riskEvents
        const isTriggered = !!matchingEvent;

        return {
          ...displayItem,
          amount: displayItem.value,
          cumulative,
          totalRain,
          isTriggered,
          riskLevel,
          threshold: thresholds[0]?.value || 0
        };
      });
    }

    return [];
  }, [
    selectedProduct, 
    // Use fine-grained dependencies to ensure updates when data changes
    dailyData.length, 
    dailyData[0]?.date, 
    dailyData[dailyData.length - 1]?.date,
    hourlyData.length, 
    hourlyData[0]?.date, 
    hourlyData[hourlyData.length - 1]?.date,
    extendedHourlyData.length, 
    extendedHourlyData[0]?.date, 
    extendedHourlyData[extendedHourlyData.length - 1]?.date,
    extendedDailyData.length, 
    extendedDailyData[0]?.date, 
    extendedDailyData[extendedDailyData.length - 1]?.date,
    dateRange.from?.getTime(), 
    dateRange.to?.getTime(),
    riskEvents.length,
    // Also include the actual data arrays as fallback (in case length/date don't change but values do)
    dailyData, 
    hourlyData, 
    extendedHourlyData, 
    extendedDailyData, 
    riskEvents
  ]);


  // --- SUMMARY METRICS ---
  const summaryMetrics = useMemo(() => {
    // Severity Label Mapping
    const severityMap: Record<string, string> = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'none': '-',
      '-': '-'
    };

    const { timeWindow, metrics } = weatherStatistics;
    const timeWindowStr = `${timeWindow.days} Days ${timeWindow.hours} Hours`;
    
    const avgValue = selectedProduct?.id === 'daily' ? metrics.avgHourly : metrics.avgDaily;

    return {
       timeWindow: timeWindowStr,
       totalRain: metrics.total.toFixed(1),
       avgRain: avgValue.toFixed(1),
       riskCount: statistics.total,
       severity: severityMap[statistics.severity] || statistics.severity,
       avgLabel: selectedProduct?.id === 'daily' ? 'Avg. Hourly Rainfall' : 'Avg. Daily Rainfall'
    };
  }, [weatherStatistics, statistics, selectedProduct]);

  // Format Date Helper (UTC to Local)
  const formatDateAxis = (val: string | number | Date) => {
    try {
      if (!val) return "";
      const dateUTC = new Date(val); // ISO 字符串解析为 UTC
      if (isNaN(dateUTC.getTime())) return String(val);

      // 转换为本地时间显示
      if (viewMode === 'daily') {
        return formatUTCDate(dateUTC, "dd MMM"); 
      }
      return formatUTCDate(dateUTC, "dd/MM HH:mm");
    } catch (e) {
      return String(val);
    }
  };

  // Helper function to get threshold color
  const getThresholdColor = (level: 'tier1' | 'tier2' | 'tier3'): string => {
    const colorMap = {
      tier1: '#f59e0b', // amber
      tier2: '#f97316', // orange
      tier3: '#ef4444', // red
    };
    return colorMap[level] || '#64748b';
  };

  // Helper function to get risk level color
  const getRiskLevelColor = (riskLevel: 'tier1' | 'tier2' | 'tier3' | null | undefined): string => {
    if (!riskLevel) return '#e2e8f0'; // gray for no risk
    const colorMap = {
      tier1: '#fbbf24', // amber-400
      tier2: '#fb923c', // orange-400
      tier3: '#f87171', // red-400
    };
    return colorMap[riskLevel] || '#e2e8f0';
  };

  // Get product thresholds for display
  const productThresholds = useMemo(() => {
    if (!selectedProduct) return [];
    const fullProduct = productLibrary.getProduct(selectedProduct.id);
    return fullProduct?.riskRules?.thresholds || [];
  }, [selectedProduct]);

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
                   {(() => {
                     const displayFrom = utcToLocal(dateRange.from);
                     const displayTo = utcToLocal(dateRange.to);
                     return `${format(displayFrom, "MMM dd, yyyy")} ${String(displayFrom.getHours()).padStart(2, '0')}:00 — ${format(displayTo, "MMM dd, yyyy")} ${String(displayTo.getHours()).padStart(2, '0')}:00`;
                   })()}
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
                      {selectedProduct?.id === 'daily' ? 'Avg. Hourly Rainfall' : 'Avg. Daily Rainfall'}
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
                          formatter={(value: number) => [`${value.toFixed(1)} mm`, 'Rainfall']}
                          labelFormatter={(label) => formatDateAxis(label)}
                        />
                        
                        {/* Mean reference line (optional) */}
                        {weatherStatistics && (
                          <ReferenceLine 
                            y={viewMode === 'hourly' 
                              ? weatherStatistics.metrics.avgHourly 
                              : weatherStatistics.metrics.avgDaily} 
                            stroke="#94a3b8" 
                            strokeDasharray="2 2"
                            label={{ 
                              position: 'right', 
                              value: `Avg: ${(viewMode === 'hourly' 
                                ? weatherStatistics.metrics.avgHourly 
                                : weatherStatistics.metrics.avgDaily).toFixed(1)}mm`,
                              fill: '#94a3b8',
                              fontSize: 10 
                            }} 
                          />
                        )}
                        
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
                           <div className="flex items-center gap-2 ml-2">
                              {productThresholds.map((threshold) => (
                                <Badge 
                                  key={threshold.level}
                                  variant="outline" 
                                  className="bg-white text-gray-700 border-gray-200 text-xs"
                                  style={{ borderColor: getThresholdColor(threshold.level) }}
                                >
                                  {threshold.label || `${threshold.value}mm`} ({threshold.level})
                                </Badge>
                              ))}
                           </div>
                        </div>

                        <div className="h-[280px] w-full relative">
                           <h4 className="absolute top-1/2 -left-6 transform -translate-y-1/2 -rotate-90 text-xs text-gray-400 font-medium origin-center whitespace-nowrap">
                              {(() => {
                                const fullProduct = productLibrary.getProduct(selectedProduct.id);
                                const timeWindowType = fullProduct?.riskRules?.timeWindow?.type;
                                return timeWindowType === 'monthly' ? 'Cumulative (mm)' : 'Rolling (mm)';
                              })()}
                           </h4>

                           <ResponsiveContainer width="100%" height="100%">
                              {(() => {
                                const fullProduct = productLibrary.getProduct(selectedProduct.id);
                                const timeWindowType = fullProduct?.riskRules?.timeWindow?.type;
                                return timeWindowType === 'monthly';
                              })() ? (
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
                                      <linearGradient id="colorAreaAmber" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
                                      </linearGradient>
                                      <linearGradient id="colorAreaOrange" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.1}/>
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
                                    <YAxis 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{fill: '#64748b', fontSize: 12}}
                                      domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 100)]}
                                    />
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                                      formatter={(value: number, _name: string, props: any) => {
                                        const item = props.payload;
                                        return [
                                          `${value.toFixed(1)} mm`,
                                          item.riskLevel ? `Risk Level: ${item.riskLevel.toUpperCase()}` : 'Cumulative'
                                        ];
                                      }}
                                      labelFormatter={(label) => formatDateAxis(label)}
                                    />
                                    
                                    {/* 3-tier threshold reference lines */}
                                    {productThresholds.map((threshold) => (
                                      <ReferenceLine 
                                        key={threshold.level}
                                        y={threshold.value} 
                                        stroke={getThresholdColor(threshold.level)}
                                        strokeDasharray="3 3"
                                        label={{ 
                                          position: 'right', 
                                          value: `${threshold.label || threshold.value}mm (${threshold.level})`,
                                          fill: getThresholdColor(threshold.level),
                                          fontSize: 10 
                                        }} 
                                      />
                                    ))}

                                    <Area 
                                      type="monotone" 
                                      dataKey="cumulative" 
                                      stroke="#3b82f6"
                                      fill="url(#colorAreaBlue)"
                                      strokeWidth={2}
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
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                                      formatter={(value: number, _name: string, props: any) => {
                                        const item = props.payload;
                                        return [
                                          `${value.toFixed(1)} mm`,
                                          item.riskLevel ? `Risk Level: ${item.riskLevel.toUpperCase()}` : 'Rolling Sum'
                                        ];
                                      }}
                                      labelFormatter={(label) => formatDateAxis(label)}
                                    />
                                    
                                    {/* 3-tier threshold reference lines */}
                                    {productThresholds.map((threshold) => (
                                      <ReferenceLine 
                                        key={threshold.level}
                                        y={threshold.value} 
                                        stroke={getThresholdColor(threshold.level)}
                                        strokeDasharray="3 3"
                                        label={{ 
                                          position: 'right', 
                                          value: `${threshold.label || threshold.value}mm (${threshold.level})`,
                                          fill: getThresholdColor(threshold.level),
                                          fontSize: 10 
                                        }} 
                                      />
                                    ))}
                                    
                                    <Bar dataKey="rollingSum" radius={[4, 4, 0, 0]} barSize={(() => {
                                      const fullProduct = productLibrary.getProduct(selectedProduct.id);
                                      const timeWindowType = fullProduct?.riskRules?.timeWindow?.type;
                                      return timeWindowType === 'hourly' ? 20 : 40;
                                    })()}>
                                      {analysisData.map((entry, index) => (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={entry.riskLevel 
                                            ? getRiskLevelColor(entry.riskLevel) 
                                            : (entry.isTriggered ? '#ef4444' : '#e2e8f0')} 
                                        />
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
                              <span className="text-xs font-bold text-gray-500 uppercase">{formatUTCDate(event.timestamp, "yyyy-MM-dd")}</span>
                              <span className="text-[10px] text-gray-400 font-medium">{formatUTCDate(event.timestamp, "HH:mm")}</span>
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
