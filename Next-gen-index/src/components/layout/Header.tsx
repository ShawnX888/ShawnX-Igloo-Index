
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Umbrella } from "lucide-react";

export function Header({ currentPage, setCurrentPage }: { currentPage: 'home' | 'product', setCurrentPage: (page: 'home' | 'product') => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setCurrentPage('home')}>
        <div className="size-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-blue-200 shadow-md transition-transform hover:scale-105 active:scale-95">
          <Umbrella className="text-white w-5 h-5 stroke-[2.5]" />
        </div>
        <div className="text-xl font-bold tracking-tight">
          <span className="text-gray-900">Index</span>
          <span className="text-blue-600">Insure</span>
        </div>
      </div>

      <nav className="hidden md:flex items-center gap-8">
        <button 
          onClick={() => setCurrentPage('home')}
          className={`text-sm font-medium transition-colors hover:text-blue-600 ${currentPage === 'home' ? 'text-blue-600' : 'text-gray-600'}`}
        >
          Rainfall & Risk
        </button>
        <button 
          onClick={() => setCurrentPage('product')}
          className={`text-sm font-medium transition-colors hover:text-blue-600 ${currentPage === 'product' ? 'text-blue-600' : 'text-gray-600'}`}
        >
          Insurance Products
        </button>
        <div className="flex items-center gap-2 cursor-not-allowed opacity-50 select-none">
          <span className="text-sm font-medium text-gray-600">Enterprise API</span>
          <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">
            Coming Soon
          </span>
        </div>
      </nav>

      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm">Log In</Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
      </div>
    </header>
  );
}
