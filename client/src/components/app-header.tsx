import { useLocation, Link } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Target,
  ShieldCheck,
  Brain,
  Settings,
  LogOut,
  ChevronDown,
  ArrowLeftRight,
  Landmark,
  ShieldAlert,
  Sparkles,
  Link2,
  UserCircle,
} from "lucide-react";
import logoPath from "@assets/FinVision360_Logo_H_(transparent)_1776714495394.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth, useLogout } from "@/hooks/use-auth";

const baseNavItems = [
  { title: "Financial Snapshot", url: "/snapshot", icon: Sparkles },
  { title: "Net Worth", url: "/", icon: LayoutDashboard },
  { title: "Assets", url: "/assets", icon: Wallet },
  { title: "Liabilities", url: "/liabilities", icon: CreditCard },
  { title: "Income & Expenses", url: "/income-expenses", icon: ArrowLeftRight },
  { title: "Retirement", url: "/retirement", icon: Target },
  { title: "Insurance", url: "/insurance", icon: ShieldCheck },
  { title: "AI Advisor", url: "/ai-advisor", icon: Brain },
];

const adminNavItems = [
  { title: "Bank Rates", url: "/bank-rates", icon: Landmark },
];

export function AppHeader() {
  const [location] = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const { user } = useAuth();
  const logout = useLogout();
  const isAdmin = (user as any)?.isAdmin;

  const currentPage = baseNavItems.find(
    (item) => location === item.url || (item.url !== "/" && location.startsWith(item.url))
  );
  const currentAdminPage = adminNavItems.find(
    (item) => location === item.url || (item.url !== "/" && location.startsWith(item.url))
  );

  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="flex items-center justify-between h-14 px-4 gap-4">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2 shrink-0 hover-elevate rounded px-1">
          <img src={logoPath} alt="FinVision360" className="h-11 w-auto" />
        </Link>

        {/* Navigation Dropdown */}
        <div className="flex-1" />
        <DropdownMenu open={navOpen} onOpenChange={setNavOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-white border-0 hover:text-white hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #1565a8 0%, #1c91d4 55%, #42b8ed 100%)" }}
              data-testid="button-nav-menu"
            >
              {currentPage ? (
                <>
                  <currentPage.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{currentPage.title}</span>
                </>
              ) : (
                "Menu"
              )}
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-semibold">Navigation</div>
            <div className="h-px bg-border my-1" />
            {baseNavItems.map((item) => (
              <Link
                key={item.title}
                href={item.url}
                onClick={() => setNavOpen(false)}
                className="flex items-center gap-2 px-2 py-2 text-sm hover:bg-accent rounded cursor-pointer"
                data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.title}</span>
                {(location === item.url || (item.url !== "/" && location.startsWith(item.url))) && (
                  <span className="text-primary">✓</span>
                )}
              </Link>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Admin Dropdown — only for admins */}
        {isAdmin && (
          <DropdownMenu open={adminOpen} onOpenChange={setAdminOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-white border-0 hover:text-white hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(135deg, #1565a8 0%, #1c91d4 55%, #42b8ed 100%)" }}
                data-testid="button-admin-menu"
              >
                {currentAdminPage ? (
                  <>
                    <currentAdminPage.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentAdminPage.title}</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </>
                )}
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-sm font-semibold">Admin</div>
              <div className="h-px bg-border my-1" />
              {adminNavItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.url}
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-2 px-2 py-2 text-sm hover:bg-accent rounded cursor-pointer"
                  data-testid={`nav-admin-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                  {(location === item.url || (item.url !== "/" && location.startsWith(item.url))) && (
                    <span className="text-primary">✓</span>
                  )}
                </Link>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Divider */}
        <div className="h-7 w-px bg-gradient-to-b from-transparent via-blue-400 dark:via-blue-500 to-transparent mx-2" aria-hidden="true" />

        {/* User Menu */}
        <DropdownMenu open={userOpen} onOpenChange={setUserOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-white border-0 hover:text-white hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #1565a8 0%, #1c91d4 55%, #42b8ed 100%)" }}
              data-testid="button-user-menu"
            >
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline truncate max-w-[100px]">
                {user?.fullName || user?.username}
              </span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold">{user?.fullName || user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <div className="h-px bg-border my-1" />
            <Link
              href="/connected-accounts"
              onClick={() => setUserOpen(false)}
              className="flex items-center gap-2 px-2 py-2 text-sm hover:bg-accent rounded cursor-pointer"
              data-testid="nav-connected-accounts"
            >
              <Link2 className="h-4 w-4" />
              <span>Connected Accounts</span>
            </Link>
            <Link
              href="/settings"
              onClick={() => setUserOpen(false)}
              className="flex items-center gap-2 px-2 py-2 text-sm hover:bg-accent rounded cursor-pointer"
              data-testid="nav-settings"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Link>
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
      </div>
    </header>
  );
}
