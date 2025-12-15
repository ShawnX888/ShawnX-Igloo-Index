
import { cn } from "../../lib/utils";
import { InsuranceProduct } from "./types";
import { X, ChevronRight } from "lucide-react";
import { PRODUCTS } from "./ControlPanel";

interface ProductSelectorProps {
  selectedProduct: InsuranceProduct | null;
  setSelectedProduct: (product: InsuranceProduct | null) => void;
  onNavigateToProduct: () => void;
  className?: string;
}

export function ProductSelector({
  selectedProduct,
  setSelectedProduct,
  onNavigateToProduct,
  className
}: ProductSelectorProps) {
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto", className)}>
      {PRODUCTS.map((product) => (
        <button
          key={product.id}
          onClick={() => setSelectedProduct(selectedProduct?.id === product.id ? null : product)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm transition-all whitespace-nowrap",
            selectedProduct?.id === product.id
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
          )}
        >
          <span className="text-lg">{product.icon}</span>
          <span className="text-sm font-semibold">{product.name}</span>
          {selectedProduct?.id === product.id && (
             <X className="w-4 h-4 ml-1 opacity-80 hover:opacity-100" 
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProduct(null);
                }} 
             />
          )}
        </button>
      ))}
      <button 
        onClick={onNavigateToProduct}
        className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-blue-600 bg-white/80 hover:bg-white rounded-full transition-colors whitespace-nowrap backdrop-blur-sm"
      >
        More <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}
