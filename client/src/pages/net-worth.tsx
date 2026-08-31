import { useLocation, Link, Switch, Route } from "wouter";
import { LayoutDashboard, Wallet, CreditCard } from "lucide-react";
import DashboardPage from "./dashboard";
import AssetsPage from "./assets";
import LiabilitiesPage from "./liabilities";

const tabs = [
  { title: "Net Worth", url: "/", icon: LayoutDashboard },
  { title: "Assets", url: "/assets", icon: Wallet },
  { title: "Liabilities", url: "/liabilities", icon: CreditCard },
];

export default function NetWorthPage() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-background shrink-0">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive =
              tab.url === "/"
                ? location === "/"
                : location.startsWith(tab.url);

            return (
              <Link
                key={tab.url}
                href={tab.url}
                data-testid={`tab-${tab.title.toLowerCase().replace(/\s/g, "-")}`}
                className={`flex items-center gap-2 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab.url === "/"
                    ? `py-[7.5px] ${
                        isActive
                          ? "my-1 rounded-md border-transparent bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-sm hover:from-primary/90 hover:to-blue-600/90"
                          : "my-1 rounded-md border-transparent bg-gradient-to-r from-primary/10 to-blue-600/10 text-primary hover:from-primary/20 hover:to-blue-600/20 hover:text-primary dark:hover:from-primary/20 dark:hover:to-blue-600/20"
                      }`
                    : `py-3 ${
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      }`
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.title}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/assets" component={AssetsPage} />
          <Route path="/liabilities" component={LiabilitiesPage} />
        </Switch>
      </div>
    </div>
  );
}