import { Link } from "wouter";
import { PublicPageLayout } from "@/components/public-page-layout";
import { MapPin, Mail, Building2, Target, ShieldCheck, Brain, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <div className="space-y-12">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">About FinVision360</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Your complete personal finance intelligence platform — built to give you a 360° view of your financial life.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Tooothy LLC</h2>
              <p className="text-sm text-muted-foreground">Parent Company</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            FinVision360.com is a product of <strong>Tooothy LLC</strong>, a Northbrook, IL based company dedicated to
            building smart, approachable technology products that help people take control of their financial futures.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>Northbrook, Illinois, United States</span>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            We believe everyone deserves a clear, complete picture of their finances — not just a bank balance or a credit
            score, but a true 360° view that includes assets, liabilities, retirement readiness, insurance, and intelligent
            forecasting. FinVision360 brings all of that into one place, making it easy to understand where you are today and
            plan for where you want to be tomorrow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Target,
              title: "Built for Clarity",
              desc: "We strip away complexity and surface the numbers that actually matter to your financial health — net worth, asset allocation, debt-to-income, and more.",
            },
            {
              icon: Brain,
              title: "AI-Powered Guidance",
              desc: "Our AI Advisor understands your full financial picture and gives you personalized strategies for debt payoff, retirement planning, and net worth growth.",
            },
            {
              icon: ShieldCheck,
              title: "Security First",
              desc: "Your financial data is stored securely with industry-standard encryption and session-based authentication. We never sell or share your personal data.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border bg-card p-6 space-y-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">What FinVision360 Offers</h2>
          <ul className="space-y-3">
            {[
              "Net worth dashboard with real-time asset and liability tracking",
              "Asset allocation visualization with category breakdowns",
              "Debt management with interest rate analysis",
              "Retirement planning calculators including 401(k) and Social Security projections",
              "Income and expense tracking by category",
              "Insurance policy management",
              "AI-powered financial advisor for scenario analysis and debt strategy",
              "Bank rate monitoring to find the best savings and lending rates",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Get in Touch</h2>
            <p className="text-sm text-muted-foreground">
              Questions, feedback, or partnership inquiries — we'd love to hear from you.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>hello@finvision360.com</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>Tooothy LLC · Northbrook, IL</span>
              </div>
            </div>
          </div>
          <Link href="/contact">
            <Button className="gap-2 shrink-0">
              Contact Us <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </PublicPageLayout>
  );
}
