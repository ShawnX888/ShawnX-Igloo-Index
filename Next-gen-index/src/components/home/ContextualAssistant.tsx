
import { MessageSquare, Send, X, Bot, User, ChevronLeft, Minimize2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { Region, DataType, InsuranceProduct } from "./types";

interface ContextualAssistantProps {
  isMinimized: boolean;
  onMaximize: () => void;
  onMinimize: () => void;
  selectedRegion: Region;
  rainfallType: DataType; // 使用DataType替代RainfallType
  className?: string;
  setRainfallType: (type: DataType) => void;
  setSelectedRegion: (region: Region) => void;
  setSelectedProduct: (product: InsuranceProduct | null) => void;
}

export function ContextualAssistant({ 
  isMinimized, 
  onMaximize,
  onMinimize,
  selectedRegion, 
  rainfallType, 
  className,
  setRainfallType,
  setSelectedRegion,
  setSelectedProduct
}: ContextualAssistantProps) {

  // If minimized, show a horizontal floating button
  if (isMinimized) {
    return (
      <div className="flex items-center justify-end">
        <Button 
          onClick={onMaximize}
          className="h-12 px-5 bg-white border border-gray-200 shadow-lg text-gray-700 hover:text-blue-600 hover:bg-gray-50 hover:border-blue-200 rounded-full flex items-center gap-3 transition-all duration-300 group"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
            <Bot className="w-4 h-4 text-blue-600 group-hover:text-white" />
          </div>
          <span className="font-semibold text-sm">Contextual AI Assistant</span>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
        </Button>
      </div>
    );
  }

  // Expanded View
  return (
    <div className={cn("flex flex-col h-full bg-white border border-gray-200 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Contextual AI Assistant</h3>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Analysis Mode</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900" onClick={onMinimize}>
          <Minimize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-white/50 space-y-6">
          {/* Initial Greeting */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
               <Bot className="w-3 h-3 text-blue-600" />
            </div>
            <div className="flex flex-col gap-2 max-w-[90%]">
               <div className="bg-gray-100 rounded-2xl rounded-tl-none p-4 text-sm text-gray-700">
                <p>
                  Welcome to the Index Insurance Portal. I've set the view to <strong>{selectedRegion.district}, {selectedRegion.country}</strong>.
                </p>
                <p className="mt-2">
                  Currently showing <span className="font-semibold text-blue-600 uppercase text-xs">Historical Rainfall</span>.
                </p>
               </div>
               
               {/* Suggestion Chips */}
               <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setRainfallType('predicted')}
                    className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors"
                  >
                    Show Predicted Rain
                  </button>
                  <button 
                    onClick={() => setSelectedRegion({...selectedRegion, district: 'Jakarta Timur'})}
                    className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                  >
                    Check Jakarta Timur
                  </button>
               </div>
            </div>
          </div>
          
          {/* User Simulation */}
          <div className="flex gap-3 flex-row-reverse opacity-50">
             <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center shrink-0 text-white mt-1">
               <User className="w-3 h-3" />
             </div>
             <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none p-3 text-sm shadow-md">
               Are there any flood risks?
             </div>
          </div>

          {/* AI Response with Product Suggestion */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
               <Bot className="w-3 h-3 text-blue-600" />
            </div>
            <div className="flex flex-col gap-2 max-w-[90%]">
               <div className="bg-gray-100 rounded-2xl rounded-tl-none p-4 text-sm text-gray-700">
                <p>
                  Yes, historical data indicates <strong>3 severe events</strong> in the last week.
                </p>
                <p className="mt-2">
                  I recommend overlaying the <strong>Daily Heavy Rain</strong> product to see if these events triggered a payout.
                </p>
               </div>
               
               {/* Actionable Product Card */}
               <div 
                 className="bg-green-50 border border-green-200 p-3 rounded-xl cursor-pointer hover:bg-green-100 transition-colors"
                 onClick={() => setSelectedProduct({id: "daily", name: "Daily Heavy Rain", description: "", icon: ""})}
               >
                 <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🌧️</span>
                    <span className="font-semibold text-green-900 text-sm">Overlay "Daily Heavy Rain"</span>
                 </div>
                 <div className="text-xs text-green-700">Click to visualize trigger thresholds on the chart.</div>
               </div>
            </div>
          </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-100 bg-white shrink-0">
        <div className="relative flex items-center">
          <input 
            type="text" 
            placeholder="Ask AI to change view..." 
            className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
          />
          <button className="absolute right-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
