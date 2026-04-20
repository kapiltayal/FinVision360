import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Target,
  Brain,
  Settings,
  LogOut,
  Sun,
  Moon,
  Landmark,
} from "lucide-react";
import logoPath from "@assets/colored-logo_1776714262826.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useAuth, useLogout } from "@/hooks/use-auth";

const baseNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Assets", url: "/assets", icon: Wallet },
  { title: "Liabilities", url: "/liabilities", icon: CreditCard },
  { title: "Retirement", url: "/retirement", icon: Target },
  { title: "AI Advisor", url: "/ai-advisor", icon: Brain },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminNavItems = [
  { title: "Bank Rates", url: "/bank-rates", icon: Landmark },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const logout = useLogout();
  const navItems = [...baseNavItems, ...((user as any)?.isAdmin ? adminNavItems : [])];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center">
          <img src={logoPath} alt="FinVision360" className="h-16 w-auto" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                    className="data-[active=true]:bg-sidebar-accent"
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-1 px-2">
          <span className="text-xs text-muted-foreground truncate">
            {user?.fullName || user?.username}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => logout.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
