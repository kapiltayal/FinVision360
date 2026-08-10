import { Link } from "wouter";

const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com",
    icon: "/Images/Social Media Icons/SocialMedia Facebook transparent.png",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com",
    icon: "/Images/Social Media Icons/SocialMedia Instagram transparent.png",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/finvision360",
    icon: "/Images/Social Media Icons/SocialMedia Linkedin transparent.png",
  },
  {
    name: "X",
    href: "https://www.x.com",
    icon: "/Images/Social Media Icons/SocialMedia X transparent.png",
  },
];

export function AppFooter() {
  return (
    <footer className="border-t mt-8">
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2 text-center">
        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
          ⚠️ This app is currently under development and testing — please DO NOT share any personal and sensitive information. Use the website carefully and verify all information independently.
        </p>
      </div>

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

        {/* Social media icons */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ name, href, icon }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <img src={icon} alt={name} className="h-6 w-6 object-contain" />
              </a>
            ))}
          </div>
          <a
            href="http://www.freepik.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Designed by myriammira / Freepik
          </a>
        </div>
      </div>
    </footer>
  );
}
