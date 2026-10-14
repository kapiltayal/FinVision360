import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import logoPath from "@assets/FinVision360_Logo_H_(transparent)_1776714495394.png";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";
import { AppFooter } from "@/components/app-footer";
import { useAuth } from "@/hooks/use-auth";

export function PublicPageLayout({
  children,
  width = "max-w-4xl",
}: {
  children: React.ReactNode;
  width?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-4 min-h-14 py-2 flex flex-wrap items-center justify-between gap-3">
          <Link href="/home" className="shrink-0">
            <img src={logoPath} alt="FinVision360" className="h-8 sm:h-11 w-auto cursor-pointer" />
          </Link>
          <nav
            aria-label="Public navigation"
            className="order-last md:order-none w-full md:w-auto flex items-center justify-center gap-4 sm:gap-6 text-sm text-muted-foreground"
          >
            <a href="/home#features" className="hover-elevate rounded-sm px-1">Features</a>
            <a href="/home#how-it-works" className="hover-elevate rounded-sm px-1">How It Works</a>
            <Link href="/pricing" className="hover-elevate rounded-sm px-1">Pricing</Link>
            <Link href="/blog" className="hover-elevate rounded-sm px-1">Blog</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {!user ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setLocation("/home?auth=login")}
                  data-testid="button-public-signin"
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  onClick={() => setLocation("/signup")}
                  data-testid="button-public-signup"
                >
                  Get Started
                </Button>
              </>
            ) : (
              <Link href="/snapshot">
                <Button variant="ghost" size="sm">Back to Snapshot</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className={`${width} mx-auto px-4 py-12`}>
          {children}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
