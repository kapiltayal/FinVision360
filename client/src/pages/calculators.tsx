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
        <TabsList className="grid h-auto w-full max-w-5xl grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="401k" data-testid="tab-calculator-401k">
            401(k) Calculator
          </TabsTrigger>
          <TabsTrigger value="rent-vs-buy" data-testid="tab-calculator-rent-vs-buy">
            Rent vs. Buy
          </TabsTrigger>
          <TabsTrigger value="home-affordability" data-testid="tab-calculator-home-affordability">
            Home affordability
          </TabsTrigger>
          <TabsTrigger value="mortgage-amortization" data-testid="tab-calculator-mortgage-amortization">
            Mortgage &amp; amortization
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