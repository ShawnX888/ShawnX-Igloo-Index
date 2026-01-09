
import { useEffect } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, CloudRain, Calendar, Sun, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { PRODUCTS } from "../home/ControlPanel";
import { InsuranceProduct } from "../home/types";

interface ProductIntroProps {
  onNavigateToHome: (product?: InsuranceProduct) => void;
  scrollToSection?: string | null;
}

export function ProductIntro({ onNavigateToHome, scrollToSection }: ProductIntroProps) {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  useEffect(() => {
    if (scrollToSection) {
      // Use a longer timeout to ensure page is fully rendered
      // Also try multiple times in case the element isn't ready yet
      const scrollToElement = () => {
        const element = document.getElementById(scrollToSection);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        return false;
      };

      // Try immediately
      if (!scrollToElement()) {
        // If not found, try after a short delay
        const timeout1 = setTimeout(() => {
          if (!scrollToElement()) {
            // If still not found, try after a longer delay
            setTimeout(scrollToElement, 200);
          }
        }, 100);
        
        return () => clearTimeout(timeout1);
      }
    }
  }, [scrollToSection]);

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 opacity-60 grid grid-cols-3">
          <div className="relative h-full w-full border-r border-white/10">
             <img 
               src="https://images.unsplash.com/photo-1756362398582-2e686313011c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWF2eSUyMHJhaW4lMjBzdG9ybSUyMGRhcmslMjBkcmFtYXRpY3xlbnwxfHx8fDE3NjUzNTkzNjh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
               alt="Heavy Rain & Flood" 
               className="w-full h-full object-cover"
             />
             <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
          </div>
          <div className="relative h-full w-full border-r border-white/10">
             <img 
               src="https://images.unsplash.com/photo-1761069606442-ea55fecdb136?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcm91Z2h0JTIwZHJ5JTIwY3JhY2tlZCUyMGVhcnRoJTIwZGVzZXJ0JTIwaG90fGVufDF8fHx8MTc2NTM1OTM2OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
               alt="Extreme Drought" 
               className="w-full h-full object-cover"
             />
             <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
          </div>
          <div className="relative h-full w-full">
             <img 
               src="https://images.unsplash.com/photo-1662661604502-de6ad50eec5d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0eXBob29uJTIwaHVycmljYW5lJTIwdHJvcGljYWwlMjBzdG9ybSUyMHdpbmQlMjB3YXZlcyUyMHBhbG0lMjB0cmVlc3xlbnwxfHx8fDE3NjUzNTkzNjh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
               alt="Typhoon & Storm" 
               className="w-full h-full object-cover"
             />
             <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
          </div>
        </div>
        <div className="container mx-auto px-6 relative z-10 text-white">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <Badge className="mb-4 bg-blue-600 hover:bg-blue-700 text-white border-none px-4 py-1.5 text-sm uppercase tracking-wider">
              Next Gen Protection
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Smarter Insurance for a Changing Climate
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 font-light">
              Index-based insurance pays out automatically when satellite data detects extreme weather. No claims, no fuss.
            </p>
            <Button 
              size="lg" 
              onClick={() => onNavigateToHome()}
              className="bg-white text-black hover:bg-gray-100 font-semibold text-lg px-8 py-6 rounded-full"
            >
              See How It Works <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* What is Index Insurance */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Why Index Insurance?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A smarter, faster way to manage climate risk compared to traditional indemnity insurance.
            </p>
          </div>

          <div className="relative grid md:grid-cols-2 gap-8 items-stretch">
            {/* Traditional Insurance */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 opacity-80">
                <div className="flex flex-col h-full">
                    <h3 className="text-2xl font-bold mb-6 flex items-center text-gray-500">
                        <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3 text-lg">🏛️</span>
                        Traditional Insurance
                    </h3>
                    <ul className="space-y-6 flex-1">
                        {[
                            { label: "Trigger", value: "Physical damage assessment" },
                            { label: "Payout Speed", value: "Weeks or months (Claims process)" },
                            { label: "Transparency", value: "Subjective loss adjustment" },
                            { label: "Cost", value: "High administrative overhead" }
                        ].map((item, i) => (
                            <li key={i} className="border-b border-gray-100 pb-4 last:border-0">
                                <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{item.label}</span>
                                <span className="text-gray-700 font-medium">{item.value}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* VS Badge (Absolute Center) */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full items-center justify-center font-black text-xl text-gray-300 shadow-xl border-4 border-gray-50 z-10">
                VS
            </div>

            {/* Index Insurance */}
            <motion.div 
              className="bg-white p-8 rounded-3xl shadow-xl border-2 border-blue-600 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                    RECOMMENDED
                </div>
                <div className="flex flex-col h-full">
                    <h3 className="text-2xl font-bold mb-6 flex items-center text-blue-900">
                        <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                        </span>
                        Index Insurance
                    </h3>
                    <ul className="space-y-6 flex-1">
                        {[
                            { label: "Trigger", value: "Satellite weather data (Objective)" },
                            { label: "Payout Speed", value: "Automatic & Immediate" },
                            { label: "Transparency", value: "Clear, pre-defined thresholds" },
                            { label: "Cost", value: "Lower premiums, efficient tech" }
                        ].map((item, i) => (
                            <li key={i} className="border-b border-gray-100 pb-4 last:border-0">
                                <span className="block text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">{item.label}</span>
                                <span className="text-gray-900 font-bold">{item.value}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </motion.div>
          </div>
            
          {/* Summary Box */}
           <div className="mt-12 p-8 bg-blue-900 rounded-3xl text-center text-white shadow-lg mx-auto max-w-4xl relative overflow-hidden">
             {/* Decorative circles */}
             <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -translate-x-10 -translate-y-10"></div>
             <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20 translate-x-10 translate-y-10"></div>
             
             <h4 className="text-2xl font-semibold mb-3 relative z-10">Why it matters for your business</h4>
             <p className="text-blue-100 text-lg max-w-2xl mx-auto relative z-10 leading-relaxed">
               "Index insurance acts as a financial weather hedge. When the data says the threshold is met, you get paid automatically—regardless of actual losses to your crops, logistics, or event operations."
             </p>
           </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-24 px-6 bg-white" id="core-products">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Our Core Products</h2>
            <p className="text-lg text-gray-600">Tailored protection for every risk profile.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Daily Product */}
            <ProductCard 
              title="Daily Heavy Rain"
              icon={<CloudRain className="w-10 h-10 text-blue-500" />}
              desc="Protection against sudden downpours."
              trigger="4-hour cumulative rainfall within one day (00:00 to 23:00) > threshold (100mm, 120mm, 140mm)."
              thresholds={["100mm", "120mm", "140mm"]}
              image="https://images.unsplash.com/photo-1761687896467-1e27a0e3b355?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaWdodG5pbmclMjBzdG9ybSUyMGhlYXZ5JTIwcmFpbiUyMGRhcmslMjBkcmFtYXRpY3xlbnwxfHx8fDE3NjUzMzkwMTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              onClick={() => onNavigateToHome(PRODUCTS.find(p => p.id === 'daily'))}
            />

            {/* Weekly Product */}
            <ProductCard 
              title="Weekly Accumulation"
              icon={<Calendar className="w-10 h-10 text-purple-500" />}
              desc="Coverage for prolonged wet spells affecting crop growth."
              trigger="7-day cumulative rainfall within one month > threshold (300mm, 350mm, 400mm)."
              thresholds={["300mm", "350mm", "400mm"]}
              image="https://images.unsplash.com/photo-1723540561412-002d352416f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmbG9vZGVkJTIwZ3JlZW4lMjBjcm9wcyUyMG92ZXJjYXN0JTIwcmFpbiUyMGhlYXZ5JTIwcmFpbiUyMGZhcm1pbmd8ZW58MXx8fHwxNzY1MzM5Mzg1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              onClick={() => onNavigateToHome(PRODUCTS.find(p => p.id === 'weekly'))}
            />

            {/* Monthly Product */}
            <ProductCard 
              title="Drought Defense"
              icon={<Sun className="w-10 h-10 text-orange-500" />}
              desc="Safety net against water scarcity and dry spells."
              trigger="Cumulative rainfall of one month < threshold (60mm, 40mm, 20mm)."
              thresholds={["60mm", "40mm", "20mm"]}
              image="https://images.unsplash.com/photo-1759410865296-9c7a3404e024?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcm91Z2h0JTIwZHJ5JTIwbGFuZCUyMGZhcm18ZW58MXx8fHwxNzY1MTgwNjc0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              onClick={() => onNavigateToHome(PRODUCTS.find(p => p.id === 'drought'))}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gray-900 text-white text-center">
         <h2 className="text-3xl font-bold mb-6">Ready to see it in action?</h2>
         <p className="mb-8 text-gray-400 max-w-xl mx-auto">Explore historical data and simulate potential payouts for your region.</p>
         <Button 
            size="lg" 
            onClick={() => onNavigateToHome(PRODUCTS[0])}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-full"
         >
           Launch Dashboard
         </Button>
      </section>
    </div>
  );
}

function ProductCard({ title, icon, desc, trigger, thresholds, image, onClick }: any) {
  return (
    <Card className="overflow-hidden border-0 shadow-lg group hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
      <div className="h-48 overflow-hidden relative shrink-0">
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors z-10" />
        <img src={image} alt={title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute bottom-4 left-4 z-20 bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm">
          {icon}
        </div>
      </div>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trigger Condition</p>
          <p className="text-sm font-medium text-gray-900">{trigger}</p>
        </div>
        <div>
           <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payout Structure</p>
           {thresholds && thresholds.length >= 3 ? (
             <div className="space-y-2">
                <div className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                   <span className="text-gray-600 font-medium">Moderate <span className="text-gray-400 font-normal">({thresholds[0]})</span></span>
                   <span className="font-bold text-blue-600">20%</span>
                </div>
                <div className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                   <span className="text-gray-600 font-medium">Severe <span className="text-gray-400 font-normal">({thresholds[1]})</span></span>
                   <span className="font-bold text-blue-600">50%</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-0.5">
                   <span className="text-gray-600 font-medium">Extreme <span className="text-gray-400 font-normal">({thresholds[2]})</span></span>
                   <span className="font-bold text-blue-600">100%</span>
                </div>
             </div>
           ) : (
            <div className="flex gap-2 flex-wrap">
               {thresholds ? thresholds.map((t: string, i: number) => (
                  <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100">{t}</Badge>
               )) : (
                  <>
                    <Badge variant="outline">Tier 1</Badge>
                    <Badge variant="outline">Tier 2</Badge>
                    <Badge variant="outline">Tier 3</Badge>
                  </>
               )}
            </div>
           )}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full group-hover:bg-blue-600" onClick={onClick}>
          Simulate Risk
        </Button>
      </CardFooter>
    </Card>
  )
}
