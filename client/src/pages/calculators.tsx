import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Retirement401kPage from "./retirement-401k";
import RentVsBuyCalculator from "./rent-vs-buy-calculator";
import HomeAffordabilityCalculator from "./home-affordability-calculator";

export default function CalculatorsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <header className="page-header-gradient">
        <p className="mb-1 text-sm font-medium text-primary">Financial planning tools</p>
        <h1 className="text-2xl font-bold" data-testid="text-calculators-title">
          Calculators
        </h1>
        <p className="mt-1 text-muted-foreground">
          Explore retirement savings and housing decisions with interactive estimates.
        </p>
      </header>

      <Tabs defaultValue="401k" className="space-y-4">
        <TabsList className="grid h-auto w-full max-w-4xl grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="401k" data-testid="tab-calculator-401k">
            401(k) Calculator
          </TabsTrigger>
          <TabsTrigger value="rent-vs-buy" data-testid="tab-calculator-rent-vs-buy">
            Rent vs. Buy
          </TabsTrigger>
          <TabsTrigger value="home-affordability" data-testid="tab-calculator-home-affordability">
            Home affordability
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
      </Tabs>
    </div>
  );
}