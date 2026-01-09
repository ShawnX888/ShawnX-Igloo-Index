
import { useState, useEffect } from "react";
import { Header } from "./components/layout/Header";
import { Dashboard } from "./components/home/Dashboard";
import { ProductIntro } from "./components/product/ProductIntro";
import { InsuranceProduct } from "./components/home/types";
import { weatherDataGenerator } from "./lib/weatherDataGenerator";
import { clearRiskCache } from "./hooks/useRiskAnalysis";

export default function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'product'>('home');
  const [dashboardInitialProduct, setDashboardInitialProduct] = useState<InsuranceProduct | null>(null);
  const [scrollToSection, setScrollToSection] = useState<string | null>(null);

  // Clear cache on app startup (development mode)
  useEffect(() => {
    // Clear all weather data cache to ensure fresh calculations
    weatherDataGenerator.clearCache();
    
    // Clear all risk event cache
    clearRiskCache();
    
    // Expose clear methods to window for manual clearing in console
    // Usage: window.clearWeatherCache() or window.clearWeatherCache('ctx-extended-daily')
    (window as any).clearWeatherCache = (pattern?: string) => {
      weatherDataGenerator.clearCache(pattern);
      console.log(`Weather cache cleared${pattern ? ` (pattern: ${pattern})` : ' (all)'}`);
    };
    
    (window as any).clearRiskCache = (pattern?: string) => {
      clearRiskCache(pattern);
      console.log(`Risk cache cleared${pattern ? ` (pattern: ${pattern})` : ' (all)'}`);
    };
    
    (window as any).clearAllCaches = () => {
      weatherDataGenerator.clearCache();
      clearRiskCache();
      console.log('All caches cleared');
    };
    
    console.log('All caches cleared on app startup');
  }, []);

  // Scroll to top when page changes, unless specific section requested
  useEffect(() => {
    if (!scrollToSection) {
      window.scrollTo(0, 0);
    }
  }, [currentPage, scrollToSection]);

  // Function to switch to product page from dashboard
  const handleNavigateToProduct = (section?: string) => {
    if (section) setScrollToSection(section);
    else setScrollToSection(null);
    setCurrentPage('product');
  };
  
  // Function to switch to home page from product page
  const handleNavigateToHome = (product?: InsuranceProduct) => {
    setDashboardInitialProduct(product || null);
    setCurrentPage('home');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-1 pt-16">
        {currentPage === 'home' ? (
          <Dashboard 
            onNavigateToProduct={handleNavigateToProduct} 
            initialProduct={dashboardInitialProduct}
          />
        ) : (
          <ProductIntro 
            onNavigateToHome={handleNavigateToHome} 
            scrollToSection={scrollToSection}
          />
        )}
      </main>
    </div>
  );
}
