import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPath from "@assets/FinVision360_Logo_H_(transparent)_1776714495394.png";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";

export function PublicPageLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();

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
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {children}
        </div>
      </main>

      <footer className="border-t py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <img src={logoPath} alt="FinVision360" className="h-7 w-auto" />
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <Link href="/about" className="hover:text-foreground transition-colors">About Us</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
              <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Tooothy LLC</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
