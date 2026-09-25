import { Link } from "wouter";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Landmark,
  PiggyBank,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const calculators = [
  {
    title: "Retirement Planner",
    description: "Project retirement net worth, income, and expenses using your financial plan.",
    url: "/retirement",
    icon: ChartNoAxesCombined,
    iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    category: "Retirement",
  },
  {
    title: "Social Security Benefits",
    description: "Estimate benefits and explore how your claiming age affects monthly income.",
    url: "/retirement/social-security",
    icon: ShieldCheck,
    iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    category: "Retirement",
  },
  {
    title: "Pension Planning",
    description: "Add pension sources and review their expected monthly income in retirement.",
    url: "/retirement/pension",
    icon: Landmark,
    iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    category: "Retirement",
  },
  {
    title: "401(k) Calculator",
    description: "Model account growth, employer matching, and Traditional versus Roth contributions.",
    url: "/retirement/401k",
    icon: PiggyBank,
    iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    category: "Retirement",
  },
];

export default function CalculatorsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="page-header-gradient">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">Financial planning tools</p>
            <h1 className="text-2xl font-bold" data-testid="text-calculators-title">
              Calculators
            </h1>
            <p className="mt-1 text-muted-foreground">
              Explore projections and planning tools built from your financial information.
            </p>
          </div>
          <div className="rounded-full border bg-background/70 px-3 py-1 text-sm text-muted-foreground">
            {calculators.length} tools
          </div>
        </div>
      </header>

      <section aria-label="Available calculators" className="grid gap-4 sm:grid-cols-2">
        {calculators.map((calculator) => (
          <Link
            key={calculator.url}
            href={calculator.url}
            data-testid={`calculator-link-${calculator.url.split("/").pop()}`}
            className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full border-border/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
              <CardContent className="flex h-full items-start gap-4 p-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${calculator.iconClass}`}>
                  <calculator.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {calculator.category}
                      </p>
                      <h2 className="mt-1 font-semibold">{calculator.title}</h2>
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {calculator.description}
                  </p>
                  <span className="mt-4 inline-block text-sm font-medium text-primary">
                    Open tool
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}