import { Link } from "wouter";

export function AppFooter() {
  return (
    <footer className="border-t mt-8">
      <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} <strong>Tooothy LLC</strong> · Northbrook, IL · All rights reserved.
        </p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <Link href="/about" className="hover:text-foreground transition-colors">About Us</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
          <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">For informational purposes only.</p>
      </div>
    </footer>
  );
}
