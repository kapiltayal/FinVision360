import { useLocation, Link, Switch, Route } from "wouter";
import { ArrowLeftRight, Receipt } from "lucide-react";
import IncomeExpensesPage from "./income-expenses";
import FinanceTrackerPage from "./finance-tracker";

const tabs = [
  { title: "Income & Expenses", url: "/income-expenses", icon: ArrowLeftRight },
  { title: "Finance Tracker", url: "/income-expenses/finance-tracker", icon: Receipt },
];

export default function IncomeExpensesTabsPage() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col">
      <div className="border-b bg-background shrink-0">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive =
              tab.url === "/income-expenses"
                ? location === "/income-expenses"
                : location === tab.url || location === "/finance-tracker";

            return (
              <Link
                key={tab.url}
                href={tab.url}
                data-testid={`tab-${tab.title.toLowerCase().replace(/\s/g, "-").replace(/&/g, "and")}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.title}
              </Link>
            );
          })}
        </div>
      </div>
      <div>
        <Switch>
          <Route path="/income-expenses" component={IncomeExpensesPage} />
          <Route path="/income-expenses/finance-tracker" component={FinanceTrackerPage} />
          <Route path="/finance-tracker" component={FinanceTrackerPage} />
        </Switch>
      </div>
    </div>
  );
}