import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import Assets from "@/pages/assets";
import Liabilities from "@/pages/liabilities";
import Retirement from "@/pages/retirement";
import AIAdvisor from "@/pages/ai-advisor";
import Settings from "@/pages/settings";
import BankRates from "@/pages/bank-rates";
import IncomeExpenses from "@/pages/income-expenses";
import Insurance from "@/pages/insurance";
import RetirementPlanner from "@/pages/retirement-planner";
import Retirement401k from "@/pages/retirement-401k";
import RetirementSocialSecurity from "@/pages/retirement-social-security";
import VideoTemplate from "@/components/video/VideoTemplate";
import { useAuth } from "@/hooks/use-auth";

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Switch>
      <Route path="/video" component={VideoTemplate} />
      <Route path="/home" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      {user ? (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/assets" component={Assets} />
          <Route path="/liabilities" component={Liabilities} />
          <Route path="/retirement" component={Retirement} />
          <Route path="/retirement/planner" component={RetirementPlanner} />
          <Route path="/retirement/401k" component={Retirement401k} />
          <Route path="/retirement/social-security" component={RetirementSocialSecurity} />
          <Route path="/ai-advisor" component={AIAdvisor} />
          <Route path="/settings" component={Settings} />
          <Route path="/bank-rates" component={BankRates} />
          <Route path="/income-expenses" component={IncomeExpenses} />
          <Route path="/insurance" component={Insurance} />
        </>
      ) : (
        <Route path="/" component={LandingPage} />
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
