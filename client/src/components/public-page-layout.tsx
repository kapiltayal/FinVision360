import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
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
  const backHref = user ? "/snapshot" : "/";
  const backLabel = user ? "Back to Snapshot" : "Back to Home";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <img src={logoPath} alt="FinVision360" className="h-11 w-auto cursor-pointer" />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href={backHref}>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                {backLabel}
              </Button>
            </Link>
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
