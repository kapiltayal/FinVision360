import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Car,
  Home,
  Heart,
  Shield,
  Umbrella,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Wallet,
  BarChart3,
  Target,
  ShieldCheck,
  Banknote,
  ScrollText,
  UserCheck,
  Users,
} from "lucide-react";
import { type Asset, type Liability, type IncomeEntry, type ExpenseEntry, type InsurancePolicy, type RetirementGoal, type Retirement401kGoal, type EstateBeneficiary, type EstateDocument, type EstateContact, ESTATE_DOCUMENT_TYPES } from "@shared/schema";

const FREQ: Record<string, number> = {
  weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, annual: 1 / 12,
};
function toMonthly(amount: string, freq: string) {
  return parseFloat(amount || "0") * (FREQ[freq] ?? 1);
}

const INSURANCE_TYPES = [
  { key: "auto", label: "Auto", Icon: Car },
  { key: "home", label: "Home", Icon: Home },
  { key: "life", label: "Life", Icon: Heart },
  { key: "health", label: "Health", Icon: Shield },
  { key: "other", label: "Other", Icon: Umbrella },
  { key: "annuity", label: "Annuity", Icon: PiggyBank },
];

const CARD_SHADOW = "0 2px 4px rgba(0,0,0,0.05), 0 6px 16px rgba(0,0,0,0.07), 0 16px 32px rgba(0,0,0,0.04)";
const CARD_SHADOW_HOVER = "0 4px 8px rgba(0,0,0,0.07), 0 12px 28px rgba(0,0,0,0.1), 0 28px 48px rgba(0,0,0,0.07)";

type Priority = "high" | "medium" | "low";
interface Rec {
  priority: Priority;
  title: string;
  description: string;
  color: string;
}

function SnapshotCard({
  title,
  accent,
  icon: Icon,
  href,
  children,
  className = "",
}: {
  title: string;
  accent: string;
  icon: React.ElementType;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [, nav] = useLocation();
  return (
    <div
      onClick={() => href && nav(href)}
      role={href ? "button" : undefined}
      data-testid={`card-snapshot-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className={`relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/50 p-6 transition-all duration-300 overflow-hidden ${href ? "cursor-pointer hover:-translate-y-1" : ""} ${className}`}
      style={{ boxShadow: CARD_SHADOW }}
      onMouseEnter={(e) => href && ((e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW_HOVER)}
      onMouseLeave={(e) => href && ((e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW)}
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: accent }} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
        </div>
        {href && <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-2 text-sm ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function SnapshotPage() {
  const { user } = useAuth();
  const firstName = (user as any)?.fullName?.split(" ")[0] || (user as any)?.username || "Your";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const { data: assets = [], isLoading: aL } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: liabilities = [], isLoading: lL } = useQuery<Liability[]>({ queryKey: ["/api/liabilities"] });
  const { data: incomeList = [], isLoading: iL } = useQuery<IncomeEntry[]>({ queryKey: ["/api/income"] });
  const { data: expenseList = [], isLoading: eL } = useQuery<ExpenseEntry[]>({ queryKey: ["/api/expenses"] });
  const { data: policies = [], isLoading: pL } = useQuery<InsurancePolicy[]>({ queryKey: ["/api/insurance"] });
  const { data: retGoal } = useQuery<RetirementGoal | null>({ queryKey: ["/api/retirement"] });
  const { data: goal401k } = useQuery<Retirement401kGoal | null>({ queryKey: ["/api/retirement/401k"] });
  const { data: estateBeneficiaries = [] } = useQuery<EstateBeneficiary[]>({ queryKey: ["/api/estate/beneficiaries"] });
  const { data: estateDocuments = [] } = useQuery<EstateDocument[]>({ queryKey: ["/api/estate/documents"] });
  const { data: estateContacts = [] } = useQuery<EstateContact[]>({ queryKey: ["/api/estate/contacts"] });

  const isLoading = aL || lL || iL || eL || pL;

  const totalAssets = useMemo(() => assets.reduce((s, a) => s + parseFloat(a.value || "0"), 0), [assets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((s, l) => s + parseFloat(l.balance || "0"), 0), [liabilities]);
  const netWorth = totalAssets - totalLiabilities;

  const totalMonthlyIncome = useMemo(() => incomeList.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0), [incomeList]);
  const totalMonthlyExpenses = useMemo(() => expenseList.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0), [expenseList]);
  const netMonthly = totalMonthlyIncome - totalMonthlyExpenses;
  const savingsRate = totalMonthlyIncome > 0 ? (netMonthly / totalMonthlyIncome) * 100 : 0;

  const retirementAssets = useMemo(() =>
    assets.filter(a => a.category === "retirement_fund").reduce((s, a) => s + parseFloat(a.value || "0"), 0), [assets]);
  const k401Balance = goal401k ? parseFloat((goal401k as any).currentBalance || "0") : retirementAssets;
  const ssnMonthlyEst = Math.min(totalMonthlyIncome * 0.42, 3822);

  const projectedRetirement = useMemo(() => {
    if (!retGoal) return 0;
    const years = (retGoal as any).retirementAge - (retGoal as any).currentAge;
    if (years <= 0) return 0;
    const monthlyRate = parseFloat((retGoal as any).expectedReturn || "7") / 100 / 12;
    const monthly = parseFloat((retGoal as any).monthlyContribution || "0");
    let balance = parseFloat((retGoal as any).currentSavings || "0");
    for (let m = 0; m < years * 12; m++) balance = balance * (1 + monthlyRate) + monthly;
    return Math.round(balance);
  }, [retGoal]);

  const emergencyFunds = useMemo(() =>
    assets
      .filter(a => ["savings_account", "cash", "bank_account"].includes(a.category))
      .reduce((s, a) => s + parseFloat(a.value || "0"), 0),
    [assets]);

  const monthsOfCoverage = totalMonthlyExpenses > 0 ? emergencyFunds / totalMonthlyExpenses : null;

  const coverageMap = useMemo(() => {
    const map: Record<string, InsurancePolicy[]> = {};
    for (const p of policies) {
      if (!map[p.type]) map[p.type] = [];
      map[p.type].push(p);
    }
    return map;
  }, [policies]);

  const recommendations = useMemo((): Rec[] => {
    const recs: Rec[] = [];

    const savingsBalance = assets
      .filter(a => ["savings_account", "cash"].includes(a.category))
      .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
    const emergencyTarget = totalMonthlyExpenses * 3;
    if (emergencyTarget > 0 && savingsBalance < emergencyTarget) {
      recs.push({
        priority: savingsBalance < emergencyTarget * 0.5 ? "high" : "medium",
        title: "Build Your Emergency Fund",
        description: `You have ${formatCurrency(savingsBalance)} saved. Target at least ${formatCurrency(emergencyTarget)} — 3 months of expenses — to weather unexpected events.`,
        color: "#ef4444",
      });
    }

    const ccDebt = liabilities.filter(l => l.category === "credit_card");
    const ccTotal = ccDebt.reduce((s, l) => s + parseFloat(l.balance || "0"), 0);
    if (ccTotal > 0) {
      const avgRate = ccDebt.reduce((s, l) => s + parseFloat(l.interestRate || "0"), 0) / ccDebt.length;
      if (avgRate > 15) {
        recs.push({
          priority: "high",
          title: "Eliminate High-Interest Debt",
          description: `${formatCurrency(ccTotal)} in credit card debt at ~${avgRate.toFixed(1)}% APR is costly. Use the avalanche method to pay off the highest-rate cards first.`,
          color: "#f97316",
        });
      }
    }

    if (totalMonthlyIncome > 0 && savingsRate < 20) {
      recs.push({
        priority: savingsRate < 10 ? "high" : "medium",
        title: "Increase Your Savings Rate",
        description: `Your savings rate is ${savingsRate.toFixed(1)}%. Increasing to 20% or more accelerates wealth building — try trimming discretionary spending first.`,
        color: "#eab308",
      });
    }

    const missingCritical = ["life", "health"].filter(t => !coverageMap[t] || coverageMap[t].length === 0);
    if (missingCritical.length > 0) {
      recs.push({
        priority: "medium",
        title: "Fill Insurance Gaps",
        description: `You appear to be missing ${missingCritical.join(" and ")} insurance. These are foundational protections — review your coverage needs.`,
        color: "#8b5cf6",
      });
    }

    if (retirementAssets === 0 && k401Balance === 0) {
      recs.push({
        priority: "medium",
        title: "Start Saving for Retirement",
        description: "No retirement assets detected. Contributing even a small amount today takes advantage of compounding — start with your employer's 401k match.",
        color: "#1C91D4",
      });
    }

    if (recs.length === 0) {
      recs.push({
        priority: "low",
        title: "Great Financial Health!",
        description: "Your finances look strong. Stay consistent with contributions, review your insurance annually, and keep your emergency fund topped up.",
        color: "#22c55e",
      });
    }

    return recs.slice(0, 4);
  }, [assets, liabilities, totalMonthlyExpenses, totalMonthlyIncome, savingsRate, coverageMap, retirementAssets, k401Balance]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="h-36" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a1040 100%)" }} />
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const priorityIcon = (p: Priority) => {
    if (p === "high") return <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />;
    if (p === "medium") return <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />;
    return <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── Hero Header ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, #0d3a5c 0%, #1565a8 30%, #1c91d4 58%, #1060a0 80%, #0d3a5c 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(28,145,212,0.15) 0%, transparent 70%)" }} />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }} />
          <div className="absolute inset-0"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="relative px-6 py-10 md:py-12">
          <p className="text-blue-400 text-xs font-bold tracking-[0.2em] uppercase mb-2">Financial Snapshot</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
            {firstName}&apos;s Financial Snapshot
          </h1>
          <p className="text-slate-400 text-sm">Your complete financial picture &nbsp;·&nbsp; as of {today}</p>
        </div>
      </div>

      {/* ── Cards Grid ── */}
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 max-w-7xl mx-auto">

        {/* ── Net Worth ── */}
        <SnapshotCard title="Net Worth" accent="#1C91D4" icon={Wallet} href="/">
          <div className="mb-4">
            <p
              className="text-3xl font-bold tabular-nums leading-none mb-1"
              style={{ color: netWorth >= 0 ? "#1C91D4" : "#ef4444" }}
              data-testid="text-snapshot-networth"
            >
              {formatCurrency(netWorth)}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {netWorth >= 0
                ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                : <TrendingDown className="h-3 w-3 text-red-500" />}
              <span>{netWorth >= 0 ? "Positive" : "Negative"} net worth</span>
            </div>
          </div>
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <StatRow label="Total Assets" value={formatCurrency(totalAssets)} className="text-emerald-600 dark:text-emerald-400 font-medium" />
            <StatRow label="Total Liabilities" value={formatCurrency(totalLiabilities)} className="text-red-500 dark:text-red-400 font-medium" />
          </div>
        </SnapshotCard>

        {/* ── Income & Expenses ── */}
        <SnapshotCard title="Income & Expenses" accent="#22c55e" icon={BarChart3} href="/income-expenses">
          <div className="mb-4">
            <p
              className="text-3xl font-bold tabular-nums leading-none mb-1"
              style={{ color: netMonthly >= 0 ? "#22c55e" : "#ef4444" }}
              data-testid="text-snapshot-cashflow"
            >
              {netMonthly >= 0 ? "+" : ""}{formatCurrency(netMonthly)}<span className="text-base font-normal text-muted-foreground">/mo</span>
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <span>Savings rate: </span>
              <span
                className="font-semibold"
                style={{ color: savingsRate >= 20 ? "#22c55e" : savingsRate >= 10 ? "#eab308" : "#ef4444" }}
              >
                {savingsRate.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <StatRow label="Monthly Income" value={formatCurrency(totalMonthlyIncome)} />
            <StatRow label="Monthly Expenses" value={formatCurrency(totalMonthlyExpenses)} />
          </div>
        </SnapshotCard>

        {/* ── Retirement ── */}
        <SnapshotCard title="Retirement" accent="#8b5cf6" icon={Target} href="/retirement">
          <div className="mb-4">
            <p className="text-3xl font-bold tabular-nums leading-none mb-1 text-violet-500"
              data-testid="text-snapshot-retirement">
              {projectedRetirement > 0 ? formatCurrency(projectedRetirement) : formatCurrency(retirementAssets)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {projectedRetirement > 0 ? "Projected at retirement" : "Current retirement savings"}
            </p>
          </div>
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <StatRow label="401k / Retirement Funds" value={formatCurrency(k401Balance || retirementAssets)} />
            <StatRow label="SSN Est. (at retirement)" value={`~${formatCurrency(ssnMonthlyEst)}/mo`} />
            {retGoal && (
              <StatRow
                label="Years to Retire"
                value={`${Math.max(0, (retGoal as any).retirementAge - (retGoal as any).currentAge)} yrs`}
              />
            )}
          </div>
        </SnapshotCard>

        {/* ── Protection ── */}
        <SnapshotCard title="Protection Coverage" accent="#f97316" icon={ShieldCheck} href="/insurance">
          <div className="grid grid-cols-3 gap-3">
            {INSURANCE_TYPES.map(({ key, label, Icon }) => {
              const typePolicies = coverageMap[key] || [];
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const in30 = new Date(today); in30.setDate(in30.getDate() + 30);

              const expired = typePolicies.filter(p => p.renewalDate && new Date(p.renewalDate) < today);
              const expiring = typePolicies.filter(p => {
                if (!p.renewalDate) return false;
                const d = new Date(p.renewalDate);
                return d >= today && d <= in30;
              });
              const active = typePolicies.filter(p => !p.renewalDate || new Date(p.renewalDate) > in30);

              const allExpired = typePolicies.length > 0 && expired.length === typePolicies.length;
              const hasWarning = expiring.length > 0 || (expired.length > 0 && active.length > 0);
              const covered = active.length > 0 || expiring.length > 0;

              const tileState: "ok" | "warn" | "expired" | "none" =
                typePolicies.length === 0 ? "none"
                : allExpired ? "expired"
                : hasWarning ? "warn"
                : "ok";

              const tileColor =
                tileState === "ok" ? "#22c55e"
                : tileState === "warn" ? "#f59e0b"
                : "#ef4444";

              const shadowRgb =
                tileState === "ok" ? "34,197,94"
                : tileState === "warn" ? "245,158,11"
                : "239,68,68";

              const tileShadowBase = `0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 3px rgba(${shadowRgb},0.1), 0 3px 0 rgba(${shadowRgb},0.12), 0 4px 1px rgba(0,0,0,0.05)`;
              const tileShadowHover = `0 1px 0 rgba(255,255,255,0.5) inset, 0 2px 6px rgba(${shadowRgb},0.15), 0 5px 0 rgba(${shadowRgb},0.16), 0 6px 2px rgba(0,0,0,0.07)`;

              const tileBg =
                tileState === "ok" ? "linear-gradient(160deg, rgba(240,255,244,1) 0%, rgba(220,252,231,0.8) 100%)"
                : tileState === "warn" ? "linear-gradient(160deg, rgba(255,251,235,1) 0%, rgba(254,243,199,0.8) 100%)"
                : "linear-gradient(160deg, rgba(255,241,241,1) 0%, rgba(254,226,226,0.8) 100%)";

              const tileBorder =
                tileState === "ok" ? "rgba(34,197,94,0.35)"
                : tileState === "warn" ? "rgba(245,158,11,0.35)"
                : "rgba(239,68,68,0.3)";

              const tooltipLines: string[] = [];
              if (typePolicies.length === 0) {
                tooltipLines.push(`No ${label.toLowerCase()} coverage`);
              } else {
                active.forEach(p => tooltipLines.push(`✓ ${p.name}${p.provider ? ` · ${p.provider}` : ""}${p.renewalDate ? ` (renews ${p.renewalDate})` : ""}`));
                expiring.forEach(p => tooltipLines.push(`⚠ Expiring soon: ${p.name} · ${p.renewalDate}`));
                expired.forEach(p => tooltipLines.push(`✗ Expired: ${p.name} · ${p.renewalDate}`));
              }

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-default select-none"
                      style={{
                        borderColor: tileBorder,
                        background: tileBg,
                        boxShadow: tileShadowBase,
                        transition: "transform 0.18s ease, box-shadow 0.18s ease",
                      }}
                      data-testid={`indicator-insurance-${key}`}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.transform = "translateY(-4px)";
                        el.style.boxShadow = tileShadowHover;
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.transform = "translateY(0)";
                        el.style.boxShadow = tileShadowBase;
                      }}
                    >
                      <div className="relative">
                        <Icon className="h-5 w-5" style={{ color: tileColor }} />
                        <span
                          className="absolute -top-1 -right-1 h-2 w-2 rounded-full border-2 border-white dark:border-slate-900"
                          style={{ background: tileColor }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold leading-none" style={{ color: tileColor }}>{label}</span>
                      {(tileState === "expired" || tileState === "warn") && (
                        <span className="text-[9px] font-bold leading-none" style={{ color: tileColor }}>
                          {tileState === "expired" ? "EXPIRED" : "EXPIRING"}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs whitespace-pre-line">
                    {tooltipLines.join("\n")}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            {Object.keys(coverageMap).filter(k => {
              const ps = coverageMap[k] || [];
              const today = new Date(); today.setHours(0,0,0,0);
              return ps.some(p => !p.renewalDate || new Date(p.renewalDate) >= today);
            }).length} of {INSURANCE_TYPES.length} types active · hover for details
            {policies.filter(p => p.renewalDate && new Date(p.renewalDate) < new Date()).length > 0 && (
              <span className="ml-1 font-semibold text-red-500">
                · {policies.filter(p => p.renewalDate && new Date(p.renewalDate) < new Date()).length} expired
              </span>
            )}
          </p>
        </SnapshotCard>

        {/* ── Emergency Funds ── */}
        <SnapshotCard title="Emergency Funds" accent="#0d9488" icon={Banknote} href="/assets">
          <div className="mb-4">
            <p
              className="text-3xl font-bold tabular-nums leading-none mb-1"
              style={{ color: "#0d9488" }}
              data-testid="text-snapshot-emergency-funds"
            >
              {formatCurrency(emergencyFunds)}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {emergencyFunds === 0
                ? <span className="text-red-500 font-medium">No emergency savings found</span>
                : monthsOfCoverage !== null
                  ? <>
                      <span
                        className="font-semibold"
                        style={{ color: monthsOfCoverage >= 6 ? "#22c55e" : monthsOfCoverage >= 3 ? "#eab308" : "#ef4444" }}
                      >
                        {monthsOfCoverage.toFixed(1)} months
                      </span>
                      <span>&nbsp;of coverage</span>
                    </>
                  : <span>No expense data to calculate coverage</span>
              }
            </div>
          </div>

          {/* Progress bar — 0 to 6 months target */}
          {monthsOfCoverage !== null && totalMonthlyExpenses > 0 && (
            <div className="mb-3">
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (monthsOfCoverage / 6) * 100)}%`,
                    background: monthsOfCoverage >= 6 ? "#22c55e" : monthsOfCoverage >= 3 ? "#eab308" : "#ef4444",
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0 mo</span>
                <span className="font-medium" style={{ color: "#0d9488" }}>Target: 3–6 mo</span>
                <span>6 mo</span>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <StatRow label="Savings & Cash Assets" value={formatCurrency(emergencyFunds)} />
            {totalMonthlyExpenses > 0 && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Based on your <span className="font-semibold tabular-nums">{formatCurrency(totalMonthlyExpenses)}</span>/mo in expenses
              </p>
            )}
          </div>
        </SnapshotCard>

        {/* ── Estate & Legacy ── */}
        <SnapshotCard title="Estate & Legacy" accent="#0d9488" icon={ScrollText} href="/estate-planning">
          {(() => {
            const docsComplete = ESTATE_DOCUMENT_TYPES.filter(d => estateDocuments.find(r => r.documentType === d.key && r.isComplete)).length;
            const totalDocs = ESTATE_DOCUMENT_TYPES.length;
            const assetsWithBen = estateBeneficiaries.filter(b => b.hasBeneficiary).length;
            const totalAssetCount = assets.length;
            const docPct = totalDocs > 0 ? Math.round((docsComplete / totalDocs) * 100) : 0;
            const benPct = totalAssetCount > 0 ? Math.round((assetsWithBen / totalAssetCount) * 100) : 0;
            const overallPct = Math.round((docPct + benPct) / 2);

            return (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-3xl font-bold tabular-nums leading-none text-teal-500" data-testid="text-snapshot-estate-pct">
                    {overallPct}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Overall readiness</p>
                </div>
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Documents</span>
                      <span className="font-medium">{docsComplete}/{totalDocs}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${docPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1"><UserCheck className="h-3 w-3" /> Beneficiaries</span>
                      <span className="font-medium">{assetsWithBen}/{totalAssetCount}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${benPct}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Key Contacts</span>
                    <span className="font-medium">{estateContacts.length} added</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </SnapshotCard>

        {/* ── Recommendations ── */}
        <SnapshotCard title="Financial Recommendations" accent="#6366f1" icon={Lightbulb} className="md:col-span-3">
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl border"
                style={{
                  borderColor: `${rec.color}28`,
                  background: `${rec.color}0a`,
                }}
                data-testid={`recommendation-${i}`}
              >
                <span style={{ color: rec.color }} className="mt-0.5">
                  {priorityIcon(rec.priority)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug mb-0.5" style={{ color: rec.color }}>
                    {rec.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                </div>
                <span
                  className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                  style={{ background: `${rec.color}20`, color: rec.color }}
                >
                  {rec.priority}
                </span>
              </div>
            ))}
          </div>
        </SnapshotCard>

      </div>
    </div>
  );
}
