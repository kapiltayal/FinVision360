import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, Heart, DollarSign, Briefcase, Users, Clock, ChevronDown,
  TrendingUp, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

function getFRA(birthYear: number): number {
  if (birthYear <= 1954) return 66;
  if (birthYear === 1955) return 66 + 2 / 12;
  if (birthYear === 1956) return 66 + 4 / 12;
  if (birthYear === 1957) return 66 + 6 / 12;
  if (birthYear === 1958) return 66 + 8 / 12;
  if (birthYear === 1959) return 66 + 10 / 12;
  return 67;
}

function getFRALabel(birthYear: number): string {
  if (birthYear <= 1954) return "66";
  if (birthYear === 1955) return "66 & 2 months";
  if (birthYear === 1956) return "66 & 4 months";
  if (birthYear === 1957) return "66 & 6 months";
  if (birthYear === 1958) return "66 & 8 months";
  if (birthYear === 1959) return "66 & 10 months";
  return "67";
}

function getBenefitAt62(fraMonthlyBenefit: number, fra: number): number {
  const monthsEarly = (fra - 62) * 12;
  const first36 = Math.min(36, monthsEarly);
  const beyond36 = Math.max(0, monthsEarly - 36);
  const reduction = first36 * (5 / 9 / 100) + beyond36 * (5 / 12 / 100);
  return fraMonthlyBenefit * (1 - reduction);
}

function getBenefitAt70(fraMonthlyBenefit: number, fra: number): number {
  return fraMonthlyBenefit * (1 + (70 - fra) * 12 * (8 / 100 / 12));
}

const SS_FACTORS = [
  {
    icon: Heart,
    title: "Health & Life Expectancy",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    points: [
      "Poor health or shorter family lifespan → claim earlier at 62",
      "Excellent health and family longevity → delay to maximize total lifetime benefits",
      "Break-even for delaying to FRA vs. 62 is typically around age 78–82",
    ],
  },
  {
    icon: DollarSign,
    title: "Financial Need",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    points: [
      "If you need income now, claiming at 62 may be the right choice",
      "Other retirement savings (401k, IRA) can bridge the gap while you delay",
      "Delaying reduces the drawdown of your portfolio early in retirement",
    ],
  },
  {
    icon: Briefcase,
    title: "Still Working?",
    color: "text-[#1C91D4]",
    bg: "bg-[#1C91D4]/10",
    points: [
      "Before FRA: benefits reduced $1 for every $2 earned above $22,320 (2024)",
      "Year you reach FRA: reduced $1 for every $3 above $59,520",
      "After FRA: zero earnings penalty regardless of how much you earn",
    ],
  },
  {
    icon: Users,
    title: "Spousal Benefits",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    points: [
      "Spouses can claim up to 50% of the higher earner's FRA benefit",
      "Survivor benefit = 100% of deceased spouse's benefit amount",
      "Higher earner delaying to 70 maximizes the surviving spouse's income for life",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Tax Considerations",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    points: [
      "Up to 85% of Social Security may be taxable depending on total income",
      "Combined income = AGI + non-taxable interest + ½ of SS benefits",
      "Roth conversions before claiming SS can significantly reduce taxes",
    ],
  },
  {
    icon: Clock,
    title: "Timing Strategies",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    points: [
      "Each year of delay past FRA adds 8% — a guaranteed, risk-free return",
      "Claim-and-suspend lets a spouse collect spousal benefits while yours grow",
      "No additional benefit for waiting past age 70 — that's the maximum",
    ],
  },
];

export default function SocialSecurityPage() {
  const currentYear = new Date().getFullYear();
  const [birthYear, setBirthYear] = useState(1965);
  const [fraMonthlyBenefit, setFraMonthlyBenefit] = useState("2000");
  const [expectedLifeAge, setExpectedLifeAge] = useState("85");
  const [openFactor, setOpenFactor] = useState<string | null>(null);

  const toggleFactor = (title: string) =>
    setOpenFactor((prev) => (prev === title ? null : title));

  const fra = getFRA(birthYear);
  const fraLabel = getFRALabel(birthYear);
  const currentAge = currentYear - birthYear;
  const benefit = parseFloat(fraMonthlyBenefit) || 0;
  const lifeAge = parseFloat(expectedLifeAge) || 85;

  const monthlyAt62 = getBenefitAt62(benefit, fra);
  const monthlyAtFRA = benefit;
  const monthlyAt70 = getBenefitAt70(benefit, fra);

  const breakEvenFRAvsEarly = useMemo(() => {
    if (!monthlyAt62 || !monthlyAtFRA) return null;
    const monthsDelay = (fra - 62) * 12;
    return 62 + monthsDelay / 12 + (monthlyAt62 * monthsDelay) / (monthlyAtFRA - monthlyAt62) / 12;
  }, [monthlyAt62, monthlyAtFRA, fra]);

  const breakEven70vsEarly = useMemo(() => {
    if (!monthlyAt62 || !monthlyAt70) return null;
    const monthsDelay = (70 - 62) * 12;
    return 62 + monthsDelay / 12 + (monthlyAt62 * monthsDelay) / (monthlyAt70 - monthlyAt62) / 12;
  }, [monthlyAt62, monthlyAt70]);

  const breakEven70vsFRA = useMemo(() => {
    if (!monthlyAtFRA || !monthlyAt70) return null;
    const monthsDelay = (70 - fra) * 12;
    return fra + monthsDelay / 12 + (monthlyAtFRA * monthsDelay) / (monthlyAt70 - monthlyAtFRA) / 12;
  }, [monthlyAtFRA, monthlyAt70, fra]);

  const recommendation = useMemo(() => {
    if (!breakEvenFRAvsEarly || !breakEven70vsFRA) return null;
    if (lifeAge < breakEvenFRAvsEarly) {
      return {
        label: "Claim at 62",
        color: "text-amber-600 dark:text-amber-400",
        border: "border-amber-300 dark:border-amber-700",
        bg: "bg-amber-50 dark:bg-amber-950/40",
        icon: AlertTriangle,
        iconColor: "text-amber-500",
        message: `Based on your expected life of age ${lifeAge}, claiming at 62 maximizes your total lifetime benefits. You would not live long enough for the higher FRA or age-70 payments to surpass the head start from claiming early.`,
      };
    }
    if (lifeAge < breakEven70vsFRA) {
      return {
        label: `Claim at FRA (${fraLabel})`,
        color: "text-[#1475A8] dark:text-[#49AEE3]",
        border: "border-[#1C91D4]/40 dark:border-[#1C91D4]/40",
        bg: "bg-blue-50 dark:bg-blue-950/40",
        icon: TrendingUp,
        iconColor: "text-[#1C91D4]",
        message: `Based on your expected life of age ${lifeAge}, claiming at your Full Retirement Age (${fraLabel}) is the sweet spot — FRA beats 62 after age ${breakEvenFRAvsEarly.toFixed(1)}, and you won't quite reach the break-even needed for age 70 to surpass it.`,
      };
    }
    return {
      label: "Claim at 70 (Maximum)",
      color: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-300 dark:border-emerald-700",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      message: `Based on your expected life of age ${lifeAge}, waiting until 70 maximizes your total lifetime benefits. After age ${breakEven70vsFRA.toFixed(1)}, the higher monthly payment from delaying surpasses what FRA would have paid — and the gap keeps growing.`,
    };
  }, [lifeAge, breakEvenFRAvsEarly, breakEven70vsFRA, fraLabel]);

  const cumulativeData = useMemo(() => {
    const data = [];
    let cum62 = 0, cumFRA = 0, cum70 = 0;
    for (let age = 62; age <= 90; age++) {
      cum62 += age >= 62 ? monthlyAt62 * 12 : 0;
      cumFRA += age >= Math.ceil(fra) ? monthlyAtFRA * 12 : 0;
      cum70 += age >= 70 ? monthlyAt70 * 12 : 0;
      data.push({ age, at62: Math.round(cum62), atFRA: Math.round(cumFRA), at70: Math.round(cum70) });
    }
    return data;
  }, [monthlyAt62, monthlyAtFRA, monthlyAt70, fra]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="page-header-gradient">
        <h1 className="text-2xl font-bold">Social Security Planning</h1>
        <p className="text-muted-foreground">Understand your benefits and find the optimal time to claim</p>
      </div>

      {/* Key Factors — 3D card */}
      <Card className="stat-card-3d">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Key Factors to Consider</CardTitle>
          <p className="text-xs text-muted-foreground">Click any topic to expand details</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SS_FACTORS.map((factor) => {
              const isOpen = openFactor === factor.title;
              return (
                <div key={factor.title} className="rounded-lg border overflow-hidden">
                  <button
                    onClick={() => toggleFactor(factor.title)}
                    data-testid={`accordion-${factor.title.toLowerCase().replace(/\s+/g, "-")}`}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-muted/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-md ${factor.bg} flex items-center justify-center shrink-0`}>
                        <factor.icon className={`h-4 w-4 ${factor.color}`} />
                      </div>
                      <span className="text-sm font-semibold">{factor.title}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t pt-3 bg-muted/60">
                      <ul className="space-y-2">
                        {factor.points.map((point, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Benefit Calculator */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Benefit Calculator</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Compare lifetime cumulative benefits across claiming ages and find your break-even points.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Birth Year</Label>
                <Input
                  data-testid="input-ss-birth-year"
                  type="number"
                  value={birthYear}
                  min={1943}
                  max={currentYear - 18}
                  onChange={(e) => setBirthYear(parseInt(e.target.value) || 1965)}
                />
                <p className="text-xs text-muted-foreground">Current age: {currentAge}</p>
              </div>
              <div className="space-y-2">
                <Label>Estimated Benefit at FRA ($/month)</Label>
                <Input
                  data-testid="input-ss-fra-benefit"
                  type="number"
                  value={fraMonthlyBenefit}
                  onChange={(e) => setFraMonthlyBenefit(e.target.value)}
                  placeholder="2000"
                />
                <p className="text-xs text-muted-foreground">Find this at ssa.gov/myaccount</p>
              </div>
              <div className="space-y-2">
                <Label>Expected Life Age</Label>
                <Input
                  data-testid="input-ss-life-age"
                  type="number"
                  value={expectedLifeAge}
                  min={63}
                  max={110}
                  onChange={(e) => setExpectedLifeAge(e.target.value)}
                  placeholder="85"
                />
                <p className="text-xs text-muted-foreground">Used to personalize the recommendation below</p>
              </div>

              <div className="pt-2 space-y-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Full Retirement Age</span>
                  <Badge variant="outline" className="font-semibold" data-testid="text-fra-label">{fraLabel}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Benefit at 62</span>
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400" data-testid="text-benefit-62">
                    {formatCurrency(monthlyAt62)}/mo
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Benefit at FRA</span>
                  <span className="text-sm font-semibold text-[#1475A8] dark:text-[#49AEE3]" data-testid="text-benefit-fra">
                    {formatCurrency(monthlyAtFRA)}/mo
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Benefit at 70</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-benefit-70">
                    {formatCurrency(monthlyAt70)}/mo
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Cumulative Benefits by Start Age</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData} margin={{ top: 5, right: 10, left: 10, bottom: 22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="age" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: "Age", position: "insideBottom", offset: -10, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={68} label={{ value: "Cumulative Benefits", angle: -90, position: "insideLeft", offset: 0, fontSize: 11, fill: "hsl(var(--muted-foreground))", dy: 62 }} />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (active && payload?.length) {
                          return (
                            <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md text-xs space-y-1">
                              <p className="font-semibold">Age {label}</p>
                              {payload.map((p: any) => (
                                <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="at62" name="Start at 62" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="atFRA" name={`Start at FRA (${fraLabel})`} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="at70" name="Start at 70" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    {breakEvenFRAvsEarly && (
                      <ReferenceLine x={Math.round(breakEvenFRAvsEarly)} stroke="hsl(var(--chart-1))" strokeDasharray="4 4" label={{ value: "BE-FRA", position: "top", fontSize: 10, fill: "hsl(var(--chart-1))" }} />
                    )}
                    {breakEven70vsEarly && (
                      <ReferenceLine x={Math.round(breakEven70vsEarly)} stroke="hsl(var(--chart-2))" strokeDasharray="4 4" label={{ value: "BE-70", position: "top", fontSize: 10, fill: "hsl(var(--chart-2))" }} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Break-Even Summary */}
        <div className="mt-6">
          <h3 className="text-base font-semibold mb-1">Break-Even Summary</h3>
          <p className="text-sm text-muted-foreground mb-4">
            At what age does each strategy overtake the others in total lifetime benefits?
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1 — Claim at 62 */}
            <Card className="border-amber-200 dark:border-amber-800 overflow-hidden">
              <div className="h-1 bg-amber-400" />
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">62</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">If you claim at 62</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(monthlyAt62)}/mo · Annual: {formatCurrency(monthlyAt62 * 12)}</p>
                  </div>
                </div>
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Break-even vs FRA</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {breakEvenFRAvsEarly ? `Age ${breakEvenFRAvsEarly.toFixed(1)}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      FRA beats 62 if you live past this age
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Break-even vs Age 70</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {breakEven70vsEarly ? `Age ${breakEven70vsEarly.toFixed(1)}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Age 70 beats 62 if you live past this age
                    </p>
                  </div>
                  <div className="pt-1">
                    <Badge variant="outline" className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                      {((1 - monthlyAt62 / (monthlyAtFRA || 1)) * 100).toFixed(1)}% reduction from FRA
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Box 2 — Claim at FRA */}
            <Card className="border-[#1C91D4]/30 dark:border-[#1C91D4]/30 overflow-hidden">
              <div className="h-1 bg-[#1C91D4]" />
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#1475A8] dark:text-[#49AEE3] leading-none text-center">FRA</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">If you claim at FRA ({fraLabel})</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(monthlyAtFRA)}/mo · Annual: {formatCurrency(monthlyAtFRA * 12)}</p>
                  </div>
                </div>
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Break-even vs Age 62</p>
                    <p className="text-lg font-bold text-[#1475A8] dark:text-[#49AEE3]">
                      {breakEvenFRAvsEarly ? `Age ${breakEvenFRAvsEarly.toFixed(1)}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      FRA wins over 62 after this age
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Break-even vs Age 70</p>
                    <p className="text-lg font-bold text-[#1475A8] dark:text-[#49AEE3]">
                      {breakEven70vsFRA ? `Age ${breakEven70vsFRA.toFixed(1)}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Age 70 beats FRA if you live past this age
                    </p>
                  </div>
                  <div className="pt-1">
                    <Badge variant="outline" className="text-xs border-[#1C91D4]/40 text-[#1475A8] dark:text-[#49AEE3]">
                      Full benefit · no reduction
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Box 3 — Personalized Recommendation */}
            {recommendation ? (
              <Card className={`overflow-hidden border ${recommendation.border}`}>
                <div className={`h-1 ${recommendation.label.startsWith("Claim at 62") ? "bg-amber-400" : recommendation.label.startsWith("Claim at FRA") ? "bg-[#1C91D4]" : "bg-emerald-500"}`} />
                <CardContent className={`p-5 h-full ${recommendation.bg}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-white/70 dark:bg-black/20 flex items-center justify-center shrink-0 border">
                      <recommendation.icon className={`h-4 w-4 ${recommendation.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Recommendation</p>
                      <p className={`text-sm font-bold ${recommendation.color}`}>{recommendation.label}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-current/10">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {recommendation.message}
                    </p>
                    <div className="mt-3">
                      <Badge
                        className={`text-xs ${
                          recommendation.label.startsWith("Claim at 62")
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-700"
                            : recommendation.label.startsWith("Claim at FRA")
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
                        }`}
                        variant="outline"
                      >
                        Based on expected life: age {lifeAge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed border-t pt-3">
                      This recommendation is based purely on numerical break-even analysis. Personal circumstances — including health, employment, spousal benefits, and tax situation — can significantly affect the optimal decision. Please consult a qualified financial advisor before making your claiming choice.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-emerald-200 dark:border-emerald-800 overflow-hidden">
                <div className="h-1 bg-emerald-500" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">70</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">If you claim at 70</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(monthlyAt70)}/mo · Annual: {formatCurrency(monthlyAt70 * 12)}</p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">Enter your information above to see a personalized recommendation.</p>
                    <Badge variant="outline" className="text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400">
                      {(((monthlyAt70 / (monthlyAtFRA || 1)) - 1) * 100).toFixed(1)}% more than FRA
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
