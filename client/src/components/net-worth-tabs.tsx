import { Link, useLocation } from "wouter";
import { BarChart3, CreditCard, LayoutDashboard, Wallet } from "lucide-react";

export const netWorthNavigationTabs = [
  { title: "Net Worth", url: "/", icon: LayoutDashboard },
  { title: "Assets", url: "/assets", icon: Wallet },
  { title: "Liabilities", url: "/liabilities", icon: CreditCard },
  { title: "Liability Map", url: "/liability-map", icon: BarChart3 },
];

export function NetWorthTabs() {
  const [location] = useLocation();

  return (
    <div className="border-b bg-background shrink-0">
      <div className="flex items-center gap-1 px-4 overflow-x-auto">
        {netWorthNavigationTabs.map((tab) => {
          const isActive = tab.url === "/"
            ? location === "/"
            : location.startsWith(tab.url);
          return (
            <div key={tab.url} className="contents">
              {tab.url === "/liability-map" && (
                <span
                  aria-hidden="true"
                  data-testid="separator-liabilities-liability-map"
                  className="mx-1 h-6 w-px shrink-0 self-center bg-border"
                />
              )}
              <Link
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
