import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLogin, useRegister, useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  PiggyBank,
  BarChart3,
  Brain,
  Wallet,
  CreditCard,
  Target,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  Sun,
  Moon,
  LineChart,
  Settings,
  LogOut,
  LayoutDashboard,
  ChevronDown,
} from "lucide-react";
import logoPath from "@assets/FinVision360_logo_transparent.png";
import { useTheme } from "@/components/theme-provider";
import { useLogout } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function AuthModal({
  open,
  onOpenChange,
  defaultTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab: "login" | "register";
}) {
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ username: "", password: "", fullName: "", email: "" });
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const register = useRegister();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(loginData, {
      onError: (error: any) => toast({ title: "Login failed", description: error.message, variant: "destructive" }),
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    register.mutate(registerData, {
      onError: (error: any) => toast({ title: "Registration failed", description: error.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={logoPath} alt="FinVision360" className="h-9 w-auto" />
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Create Account</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  data-testid="input-login-username"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  placeholder="Enter your username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    data-testid="input-login-password"
                    type={showPassword ? "text" : "password"}
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder="Enter your password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending} data-testid="button-login">
                {login.isPending ? "Signing in…" : "Sign In"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Demo: <span className="font-mono">demo</span> / <span className="font-mono">demo123</span>
              </p>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    data-testid="input-register-fullname"
                    value={registerData.fullName}
                    onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    data-testid="input-register-email"
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    placeholder="jane@email.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  data-testid="input-register-username"
                  value={registerData.username}
                  onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                  placeholder="Choose a username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  data-testid="input-register-password"
                  type="password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  placeholder="Min 6 characters"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={register.isPending} data-testid="button-register">
                {register.isPending ? "Creating account…" : "Create Free Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const features = [
  {
    icon: Wallet,
    title: "Daily Finance Management",
    desc: "Track every account — checking, savings, cash — in one place. Know your real balance at all times.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: BarChart3,
    title: "Investments & Portfolio",
    desc: "Monitor all your investments, brokerage accounts, and retirement funds with real-time net worth calculations.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Insurance & Protection",
    desc: "Factor insurance assets and protection strategies into your overall financial picture and planning.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Target,
    title: "Retirement Planning",
    desc: "Visualize your path to retirement with interactive projections, inflation-adjusted forecasts, and contribution planning.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    icon: CreditCard,
    title: "Debt Management",
    desc: "Track every debt — mortgages, credit cards, student loans — and understand the true cost of interest.",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    icon: Brain,
    title: "AI-Powered Advisor",
    desc: "Get personalized recommendations, debt payoff strategies, and net worth forecasts from your personal finance intelligence.",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
];

const benefits = [
  "Track all assets and liabilities in one dashboard",
  "See your real net worth updated instantly",
  "Understand the interest you earn vs. what you pay",
  "Plan retirement with inflation-adjusted projections",
  "AI-powered debt reduction strategies",
  "Scenario planning: 'What if?' financial modeling",
];

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [userOpen, setUserOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const logout = useLogout();

  const openLogin = () => { setAuthTab("login"); setAuthOpen(true); };
  const openRegister = () => { setAuthTab("register"); setAuthOpen(true); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      {!user && (
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <img src={logoPath} alt="FinVision360" className="h-11 w-auto" />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover-elevate rounded-sm px-1">Features</a>
            <a href="#how-it-works" className="hover-elevate rounded-sm px-1">How It Works</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            {user ? (
              <DropdownMenu open={userOpen} onOpenChange={setUserOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
                    <span className="hidden sm:inline text-sm truncate max-w-[100px]">
                      {user.fullName || user.username}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-semibold">{user.fullName || user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <a
                    href="/#/"
                    onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2 px-2 py-2 text-sm hover:bg-accent rounded cursor-pointer"
                    data-testid="nav-dashboard"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </a>
                  <a
                    href="/#/settings"
                    onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2 px-2 py-2 text-sm hover:bg-accent rounded cursor-pointer"
                    data-testid="nav-settings"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </a>
                  <div className="h-px bg-border my-1" />
                  <button
                    onClick={() => logout.mutate()}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-accent rounded"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={openLogin} data-testid="button-header-login">
                  Sign In
                </Button>
                <Button size="sm" onClick={openRegister} data-testid="button-header-signup">
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      )}

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
          <Brain className="h-3 w-3" />
          AI-Powered Personal Finance
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-tight">
          Your Personal<br />
          <span className="text-primary">Finance Intelligence</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
          Track your day-to-day finances, grow your savings, plan for retirement, and get
          AI-powered guidance — all in one place.
        </p>
        {user ? (
          <Link href="/" className="inline-block">
            <Button size="lg" data-testid="button-hero-dashboard">
              Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <>
            <div className="flex items-center justify-center flex-wrap gap-3">
              <Button size="lg" onClick={openRegister} data-testid="button-hero-signup">
                Start for Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="secondary" onClick={openLogin} data-testid="button-hero-login">
                Sign In
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              No credit card required · Demo account available
            </p>
          </>
        )}

        {/* Mock dashboard preview */}
        <div className="mt-14 relative mx-auto max-w-4xl">
          <div className="rounded-lg border bg-card shadow-lg p-4 text-left">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs text-muted-foreground">Net Worth Dashboard</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Net Worth", value: "$421,300", color: "text-emerald-500" },
                { label: "Total Assets", value: "$732,300", color: "text-blue-500" },
                { label: "Total Liabilities", value: "$311,000", color: "text-red-500" },
                { label: "Interest Spread", value: "+3.21%", color: "text-violet-500" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-md bg-muted/80 p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 rounded-md bg-muted/80 p-3 h-24 flex items-end gap-1">
                {[40, 55, 45, 70, 65, 80, 72, 85, 90, 88, 95, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-primary/60"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="rounded-md bg-muted/80 p-3 h-24 flex items-center justify-center">
                <div className="relative h-14 w-14">
                  <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                    <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                    <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(var(--chart-1))" strokeWidth="4" strokeDasharray="50 82" />
                    <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(var(--chart-2))" strokeWidth="4" strokeDasharray="20 82" strokeDashoffset="-50" />
                    <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(var(--chart-3))" strokeWidth="4" strokeDasharray="12 82" strokeDashoffset="-70" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/60 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Everything You Need</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From your daily checking account to long-term retirement goals — manage it all in one place.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat) => (
              <div key={feat.title} className="rounded-lg bg-card border p-5 hover-elevate">
                <div className={`h-10 w-10 rounded-md ${feat.bg} flex items-center justify-center mb-4`}>
                  <feat.icon className={`h-5 w-5 ${feat.color}`} />
                </div>
                <h3 className="font-semibold mb-1.5">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits / How it works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">Your finances, crystal clear</h2>
              <p className="text-muted-foreground text-base mb-8 leading-relaxed">
                FinVision360 gives you a complete picture of where you stand financially today,
                and where you're headed tomorrow. Add all your accounts once — and watch your
                net worth update in real time.
              </p>
              <ul className="space-y-3">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              {[
                { icon: LineChart, label: "Net Worth Over Time", desc: "Watch your wealth grow with beautiful charts", pct: 72 },
                { icon: Target, label: "Retirement Readiness", desc: "On track for $2M by age 62", pct: 58 },
                { icon: CreditCard, label: "Debt Payoff Progress", desc: "Avalanche method saves $12,400 in interest", pct: 35 },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border bg-card p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <span className="text-xs text-muted-foreground">{item.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full">
                      <div className="h-1.5 bg-primary rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section className="bg-primary py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Brain className="h-10 w-10 text-primary-foreground/80 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Meet Your Personal Finance Intelligence
          </h2>
          <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            Ask anything about your finances. Get personalized debt strategies, retirement forecasts,
            and "what-if" scenario analysis — powered by AI with full context of your financial picture.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { q: "What if I pay an extra $500/mo toward debt?", t: "Scenario Planning" },
              { q: "Should I use avalanche or snowball method?", t: "Debt Strategy" },
              { q: "When will I reach $1M net worth?", t: "Net Worth Forecast" },
            ].map((item) => (
              <div key={item.t} className="rounded-lg bg-white/10 p-4 text-left">
                <p className="text-xs text-primary-foreground/60 mb-1">{item.t}</p>
                <p className="text-sm text-primary-foreground italic">"{item.q}"</p>
              </div>
            ))}
          </div>
          {user ? (
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" data-testid="button-ai-cta">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              onClick={openRegister}
              data-testid="button-ai-cta"
            >
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between flex-wrap gap-4">
          <img src={logoPath} alt="FinVision360" className="h-9 w-auto" />
          <p className="text-xs text-muted-foreground">Your personal finance intelligence for every stage of life.</p>
        </div>
      </footer>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />
    </div>
  );
}
