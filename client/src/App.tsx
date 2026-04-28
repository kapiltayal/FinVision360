import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import AssetsPage from "@/pages/assets";
import LiabilitiesPage from "@/pages/liabilities";
import RetirementPage from "@/pages/retirement";
import InsurancePage from "@/pages/insurance";
import AIAdvisorPage from "@/pages/ai-advisor";
import SettingsPage from "@/pages/settings";
import IncomeExpensesPage from "@/pages/income-expenses";
import BankRatesPage from "@/pages/bank-rates";
import AboutPage from "@/pages/about";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import FAQPage from "@/pages/faq";
import ContactPage from "@/pages/contact";

function AuthenticatedApp() {
  const [location] = useLocation();
  const showFooter = location !== "/home";

  return (
    <div className="flex flex-col h-screen w-full">
      <AppHeader />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full flex flex-col">
          <div className="flex-1">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/home" component={LandingPage} />
              <Route path="/assets" component={AssetsPage} />
              <Route path="/liabilities" component={LiabilitiesPage} />
              <Route path="/retirement" component={RetirementPage} />
              <Route path="/retirement/social-security" component={RetirementPage} />
              <Route path="/retirement/401k" component={RetirementPage} />
              <Route path="/income-expenses" component={IncomeExpensesPage} />
              <Route path="/insurance" component={InsurancePage} />
              <Route path="/ai-advisor" component={AIAdvisorPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/bank-rates" component={BankRatesPage} />
              <Route component={NotFound} />
            </Switch>
          </div>
          {showFooter && <AppFooter />}
        </div>
      </main>
    </div>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-md mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/about" component={AboutPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/faq" component={FAQPage} />
      <Route path="/contact" component={ContactPage} />
      <Route>
        {user ? <AuthenticatedApp /> : <LandingPage />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
