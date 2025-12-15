
import { useState, useEffect } from "react";
import { Header } from "./components/layout/Header";
import { Dashboard } from "./components/home/Dashboard";
import { ProductIntro } from "./components/product/ProductIntro";
import { InsuranceProduct } from "./components/home/types";

export default function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'product'>('home');
  const [dashboardInitialProduct, setDashboardInitialProduct] = useState<InsuranceProduct | null>(null);
  const [scrollToSection, setScrollToSection] = useState<string | null>(null);

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
