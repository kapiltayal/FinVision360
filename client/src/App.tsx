import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { FeedbackButton } from "@/components/feedback-button";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth, useSupabaseSession } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import SnapshotPage from "@/pages/snapshot";
import NetWorthPage from "@/pages/net-worth";
import RetirementPage from "@/pages/retirement";
import InsurancePage from "@/pages/insurance";
import AIAdvisorPage from "@/pages/ai-advisor";
import EstatePlanningPage from "@/pages/estate-planning";
import SettingsPage from "@/pages/settings";
import IncomeExpensesTabsPage from "@/pages/income-expenses-tabs";
import BankRatesPage from "@/pages/bank-rates";
import ConnectedAccountsPage from "@/pages/connected-accounts";
import AboutPage from "@/pages/about";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import FAQPage from "@/pages/faq";
import ContactPage from "@/pages/contact";
import GoalsPage from "@/pages/goals";
import ResetPasswordPage from "@/pages/reset-password";

function AuthenticatedApp() {
  const [location] = useLocation();
  const showFooter = location !== "/home";

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <AppHeader />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full flex flex-col">
          <div className="flex-1">
            <Switch>
              <Route path="/snapshot" component={SnapshotPage} />
              <Route path="/" component={NetWorthPage} />
              <Route path="/home" component={LandingPage} />
              <Route path="/assets" component={NetWorthPage} />
              <Route path="/liabilities" component={NetWorthPage} />
              <Route path="/retirement" component={RetirementPage} />
              <Route path="/retirement/social-security" component={RetirementPage} />
              <Route path="/retirement/401k" component={RetirementPage} />
              <Route path="/retirement/pension" component={RetirementPage} />
              <Route path="/income-expenses" component={IncomeExpensesTabsPage} />
              <Route path="/income-expenses/finance-tracker" component={IncomeExpensesTabsPage} />
              <Route path="/insurance" component={InsurancePage} />
              <Route path="/estate-planning" component={EstatePlanningPage} />
              <Route path="/goals" component={GoalsPage} />
              <Route path="/finance-tracker" component={IncomeExpensesTabsPage} />
              <Route path="/ai-advisor" component={AIAdvisorPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/bank-rates" component={BankRatesPage} />
              <Route path="/connected-accounts" component={ConnectedAccountsPage} />
              <Route component={NotFound} />
            </Switch>
          </div>
          {showFooter && <AppFooter />}
        </div>
      </main>
      <FeedbackButton />
    </div>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  useSupabaseSession(); // global auth state listener — clears cache on signout/token expiry

  // Supabase password-reset emails redirect to {SITE_URL}/#access_token=...&type=recovery
  // Intercept that hash here and forward to the dedicated reset-password page.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type=email_change")) {
      setLocation("/reset-password");
    }
  }, []);

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
      <Route path="/reset-password" component={ResetPasswordPage} />
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
