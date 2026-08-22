import { useLocation, Link, Switch, Route } from "wouter";
import { Target, ShieldCheck, BarChart3, Landmark } from "lucide-react";
import RetirementPlannerPage from "./retirement-planner";
import SocialSecurityPage from "./retirement-social-security";
import Retirement401kPage from "./retirement-401k";
import RetirementPensionPage from "./retirement-pension";

const tabs = [
  { title: "Retirement Planner", url: "/retirement", icon: Target },
  { title: "Social Security", url: "/retirement/social-security", icon: ShieldCheck },
  { title: "401k Calculator", url: "/retirement/401k", icon: BarChart3 },
  { title: "Pension", url: "/retirement/pension", icon: Landmark },
];

export default function RetirementPage() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-background shrink-0">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive =
              tab.url === "/retirement"
                ? location === "/retirement"
                : location.startsWith(tab.url);
            return (
              <Link
                key={tab.url}
                href={tab.url}
                data-testid={`tab-${tab.title.toLowerCase().replace(/\s/g, "-")}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab.url === "/retirement"
                    ? isActive
                      ? "my-1 rounded-md border-transparent bg-gradient-to-r from-primary to-emerald-600 text-primary-foreground shadow-sm hover:from-primary/90 hover:to-emerald-600/90"
                      : "my-1 rounded-md border-transparent bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200"
                    : isActive
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
      <div className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/retirement" component={RetirementPlannerPage} />
          <Route path="/retirement/social-security" component={SocialSecurityPage} />
          <Route path="/retirement/401k" component={Retirement401kPage} />
          <Route path="/retirement/pension" component={RetirementPensionPage} />
        </Switch>
      </div>
    </div>
  );
}
