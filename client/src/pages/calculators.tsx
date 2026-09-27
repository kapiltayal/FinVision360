import { Briefcase, Calculator, House, Scale } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Retirement401kPage from "./retirement-401k";
import RentVsBuyCalculator from "./rent-vs-buy-calculator";
import HomeAffordabilityCalculator from "./home-affordability-calculator";
import HomeMortgageCalculator from "./home-mortgage-calculator";

const calculatorTabs = ["401k", "rent-vs-buy", "home-affordability", "mortgage-amortization"] as const;
const calculatorTabClassName =
  "group flex min-h-9 w-full items-center justify-center gap-1.5 whitespace-normal rounded-lg border border-transparent px-2 py-2 text-center text-[16.5px] font-medium leading-tight text-muted-foreground transition-all duration-200 hover:bg-background/70 hover:text-foreground focus-visible:ring-offset-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:px-3 sm:text-[18px]";

export default function CalculatorsPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab");
  const activeTab = calculatorTabs.includes(requestedTab as (typeof calculatorTabs)[number])
    ? requestedTab as (typeof calculatorTabs)[number]
    : "401k";

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <header className="page-header-gradient">
        <p className="mb-1 text-sm font-medium text-primary">Financial planning tools</p>
        <h1 className="text-2xl font-bold" data-testid="text-calculators-title">
          Calculators
        </h1>
        <p className="mt-1 text-muted-foreground">
          Explore retirement savings, housing costs, and mortgage payoff plans with interactive estimates.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setLocation(`/calculators?tab=${value}`)}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full max-w-5xl grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/60 p-1 shadow-sm lg:grid-cols-4">
          <TabsTrigger value="401k" data-testid="tab-calculator-401k" className={calculatorTabClassName}>
            <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>401(k) Calculator</span>
          </TabsTrigger>
          <TabsTrigger value="rent-vs-buy" data-testid="tab-calculator-rent-vs-buy" className={calculatorTabClassName}>
            <Scale className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Rent vs. Buy</span>
          </TabsTrigger>
          <TabsTrigger value="home-affordability" data-testid="tab-calculator-home-affordability" className={calculatorTabClassName}>
            <House className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Home Affordability</span>
          </TabsTrigger>
          <TabsTrigger value="mortgage-amortization" data-testid="tab-calculator-mortgage-amortization" className={calculatorTabClassName}>
            <Calculator className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Mortgage &amp; Amortization</span>
          </TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}