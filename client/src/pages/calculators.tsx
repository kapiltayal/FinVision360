import { Briefcase, Calculator, House, Scale } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Retirement401kPage from "./retirement-401k";
import RentVsBuyCalculator from "./rent-vs-buy-calculator";
import HomeAffordabilityCalculator from "./home-affordability-calculator";
import HomeMortgageCalculator from "./home-mortgage-calculator";

const calculatorTabs = ["401k", "rent-vs-buy", "home-affordability", "mortgage-amortization"] as const;

export default function CalculatorsPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab");
  const activeTab = calculatorTabs.includes(requestedTab as (typeof calculatorTabs)[number])
    ? requestedTab as (typeof calculatorTabs)[number]
    : "401k";

  return (
    <div className="flex w-full flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setLocation(`/calculators?tab=${value}`)}
        className="w-full"
      >
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-background p-0">
          <TabsTrigger value="401k" data-testid="tab-calculator-401k" className="flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-offset-background data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
            <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
            401(k) Calculator
          </TabsTrigger>
          <TabsTrigger value="rent-vs-buy" data-testid="tab-calculator-rent-vs-buy" className="flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-offset-background data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
            <Scale className="h-4 w-4 shrink-0" aria-hidden="true" />
            Rent vs. Buy
          </TabsTrigger>
          <TabsTrigger value="home-affordability" data-testid="tab-calculator-home-affordability" className="flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-offset-background data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
            <House className="h-4 w-4 shrink-0" aria-hidden="true" />
            Home Affordability
          </TabsTrigger>
          <TabsTrigger value="mortgage-amortization" data-testid="tab-calculator-mortgage-amortization" className="flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-offset-background data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
            <Calculator className="h-4 w-4 shrink-0" aria-hidden="true" />
            Mortgage &amp; Amortization
          </TabsTrigger>
        </TabsList>

        <div className="mx-auto w-full max-w-7xl space-y-4 p-6">
        <TabsContent
          value="401k"
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          <Retirement401kPage />
        </TabsContent>
        <TabsContent
          value="rent-vs-buy"
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          <RentVsBuyCalculator />
        </TabsContent>
        <TabsContent
          value="home-affordability"
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          <HomeAffordabilityCalculator />
        </TabsContent>
        <TabsContent
          value="mortgage-amortization"
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          <HomeMortgageCalculator />
        </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}