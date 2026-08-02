import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Info, TrendingUp, DollarSign, Percent, BarChart3, Save, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { ExportMenu } from "@/components/export-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Retirement401kGoal } from "@shared/schema";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const CONTRIBUTION_LIMIT_2024 = 23000;
const CATCHUP_LIMIT_2024 = 30500;

export default function Retirement401kPage() {
  const { toast } = useToast();
  const { data: goal } = useQuery<Retirement401kGoal | null>({ queryKey: ["/api/retirement/401k"] });

  const [form, setForm] = useState({
    currentAge: 35,
    retirementAge: 65,
    currentBalance: "25000",
    annualSalary: "80000",
    contributionPct: 10,
    employerMatchPct: 4,
    employerMatchLimit: 50,
    expectedReturn: 7,
    taxBracket: 22,
    rothTaxRate: 20,
  });

  useEffect(() => {
    if (goal) {
      setForm({
        currentAge: goal.currentAge ?? 35,
        retirementAge: goal.retirementAge ?? 65,
        currentBalance: goal.currentBalance ?? "25000",
        annualSalary: goal.annualSalary ?? "80000",
        contributionPct: parseFloat(goal.contributionPct ?? "10"),
        employerMatchPct: parseFloat(goal.employerMatchPct ?? "4"),
        employerMatchLimit: parseFloat(goal.employerMatchLimit ?? "50"),
        expectedReturn: parseFloat(goal.expectedReturn ?? "7"),
        taxBracket: parseFloat(goal.taxBracket ?? "22"),
        rothTaxRate: parseFloat(goal.rothTaxRate ?? "20"),
      });
    }
  }, [goal]);

  const { formattedDate, markUpdated } = useLastUpdated("retirement-401k");

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/retirement/401k", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retirement/401k"] });
      markUpdated();
      toast({ title: "401k plan saved" });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const set = (key: keyof typeof form, val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  const years = form.retirementAge - form.currentAge;
  const salary = parseFloat(form.annualSalary) || 0;
  const currentBalance = parseFloat(form.currentBalance) || 0;
  const annualContribution = Math.min(
    salary * (form.contributionPct / 100),
    form.currentAge >= 50 ? CATCHUP_LIMIT_2024 : CONTRIBUTION_LIMIT_2024
  );
  const employerMatch = Math.min(
    salary * (form.employerMatchPct / 100),
    salary * (form.employerMatchLimit / 100) * (form.contributionPct >= form.employerMatchLimit ? 1 : form.contributionPct / form.employerMatchLimit)
  );
  const totalAnnualContribution = annualContribution + employerMatch;
  const monthlyRate = form.expectedReturn / 100 / 12;

  const projectionData = useMemo(() => {
    let tradBalance = currentBalance;
    let rothBalance = currentBalance;
    const data = [];

    for (let y = 0; y <= years; y++) {
      const age = form.currentAge + y;
      const maxContrib = age >= 50 ? CATCHUP_LIMIT_2024 : CONTRIBUTION_LIMIT_2024;
      const empMatch = Math.min(
        salary * (form.employerMatchPct / 100),
        salary * (form.employerMatchLimit / 100)
      );
      const userContrib = Math.min(salary * (form.contributionPct / 100), maxContrib);
      const totalContrib = y === 0 ? 0 : userContrib + empMatch;

      const monthlyContrib = totalContrib / 12;
      if (y > 0) {
        let tBal = tradBalance;
        let rBal = rothBalance;
        for (let m = 0; m < 12; m++) {
          tBal = tBal * (1 + monthlyRate) + monthlyContrib;
          rBal = rBal * (1 + monthlyRate) + monthlyContrib;
        }
        tradBalance = tBal;
        rothBalance = rBal;
      }

      const tradAfterTax = tradBalance * (1 - form.taxBracket / 100);
      const rothAfterTax = rothBalance;

      data.push({
        age,
        traditional: Math.round(tradBalance),
        roth: Math.round(rothBalance),
        tradAfterTax: Math.round(tradAfterTax),
        rothAfterTax: Math.round(rothAfterTax),
        contributions: Math.round(currentBalance + totalAnnualContribution * y),
      });
    }
    return data;
  }, [form, currentBalance, salary, totalAnnualContribution, years, monthlyRate]);

  const finalTrad = projectionData[projectionData.length - 1]?.traditional || 0;
  const finalRoth = projectionData[projectionData.length - 1]?.roth || 0;
  const finalTradAfterTax = projectionData[projectionData.length - 1]?.tradAfterTax || 0;
  const totalContributed = currentBalance + totalAnnualContribution * years;
  const growthAmount = finalTrad - totalContributed;

  const contributionPctOfLimit = (annualContribution / (form.currentAge >= 50 ? CATCHUP_LIMIT_2024 : CONTRIBUTION_LIMIT_2024)) * 100;
  const isMaxingOut = contributionPctOfLimit >= 99;
  const gettingFullMatch = form.contributionPct >= form.employerMatchLimit;

  const annualBreakdownData = useMemo(() => {
    return projectionData.filter((_, i) => i % 5 === 0 || i === projectionData.length - 1).map((d) => ({
      age: d.age,
      "Your Contributions": Math.round(currentBalance + annualContribution * (d.age - form.currentAge)),
      "Employer Match": Math.round(employerMatch * (d.age - form.currentAge)),
      "Investment Growth": Math.max(0, d.traditional - currentBalance - totalAnnualContribution * (d.age - form.currentAge)),
    }));
  }, [projectionData, currentBalance, annualContribution, employerMatch, form.currentAge, totalAnnualContribution]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-1 flex-wrap page-header-gradient">
        <div>
          <h1 className="text-2xl font-bold">401k Calculator & Forecast</h1>
          <p className="text-muted-foreground">Model your 401k growth, employer match, and compare Traditional vs. Roth</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1" data-testid="text-401k-last-updated">
            <Clock className="h-3 w-3" /> Last updated: {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={{
            filename: "401k Projections",
            sheets: [
              {
                name: "Settings",
                columns: ["Setting", "Value"],
                rows: [
                  ["Current Age", form.currentAge],
                  ["Retirement Age", form.retirementAge],
                  ["Current Balance ($)", parseFloat(form.currentBalance || "0")],
                  ["Annual Salary ($)", parseFloat(form.annualSalary || "0")],
                  ["Contribution (%)", form.contributionPct],
                  ["Employer Match (%)", form.employerMatchPct],
                  ["Employer Match Limit (%)", form.employerMatchLimit],
                  ["Expected Return (%)", form.expectedReturn],
                  ["Tax Bracket (%)", form.taxBracket],
                ],
              },
              {
                name: "Projections",
                columns: ["Age", "Traditional Balance ($)", "Roth Balance ($)", "Traditional After-Tax ($)", "Roth After-Tax ($)", "Total Contributions ($)"],
                rows: projectionData.map((d) => [d.age, d.traditional, d.roth, d.tradAfterTax, d.rothAfterTax, d.contributions]),
              },
            ],
          }} />
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-401k">
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Plan"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projected Balance</p>
                <p className="text-lg font-bold" data-testid="text-401k-projected">{formatCurrency(finalTrad)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d stat-card-3d-green border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">After-Tax (Trad.)</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(finalTradAfterTax)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-[#1C91D4]/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-[#1C91D4]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Investment Growth</p>
                <p className="text-lg font-bold text-[#1475A8] dark:text-[#49AEE3]">{formatCurrency(growthAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-violet-500/10 flex items-center justify-center">
                <Percent className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employer Match/yr</p>
                <p className="text-lg font-bold">{formatCurrency(employerMatch)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Your 401k Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Current Age</Label>
                <span className="text-sm font-medium">{form.currentAge}</span>
              </div>
              <Slider value={[form.currentAge]} onValueChange={([v]) => set("currentAge", v)} min={18} max={69} step={1} data-testid="slider-401k-current-age" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Retirement Age</Label>
                <span className="text-sm font-medium">{form.retirementAge}</span>
              </div>
              <Slider value={[form.retirementAge]} onValueChange={([v]) => set("retirementAge", v)} min={form.currentAge + 1} max={80} step={1} data-testid="slider-401k-retirement-age" />
            </div>
            <div className="space-y-2">
              <Label>Current 401k Balance ($)</Label>
              <Input data-testid="input-401k-balance" type="number" value={form.currentBalance} onChange={(e) => set("currentBalance", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Annual Salary ($)</Label>
              <Input data-testid="input-401k-salary" type="number" value={form.annualSalary} onChange={(e) => set("annualSalary", e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Your Contribution</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">{form.contributionPct}%</span>
                  {!gettingFullMatch && (
                    <Badge variant="destructive" className="text-xs px-1 py-0">Missing match</Badge>
                  )}
                </div>
              </div>
              <Slider value={[form.contributionPct]} onValueChange={([v]) => set("contributionPct", v)} min={1} max={50} step={1} data-testid="slider-401k-contribution" />
              <p className="text-xs text-muted-foreground">{formatCurrency(annualContribution)}/yr · {contributionPctOfLimit.toFixed(0)}% of {form.currentAge >= 50 ? "$30,500" : "$23,000"} limit {isMaxingOut && "✓ Maxing out!"}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Employer Match</Label>
                <span className="text-sm font-medium">{form.employerMatchPct}% up to {form.employerMatchLimit}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Match %</p>
                  <Slider value={[form.employerMatchPct]} onValueChange={([v]) => set("employerMatchPct", v)} min={0} max={10} step={0.5} data-testid="slider-employer-match-pct" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Up to salary %</p>
                  <Slider value={[form.employerMatchLimit]} onValueChange={([v]) => set("employerMatchLimit", v)} min={1} max={20} step={1} data-testid="slider-employer-match-limit" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Expected Annual Return</Label>
                <span className="text-sm font-medium">{form.expectedReturn}%</span>
              </div>
              <Slider value={[form.expectedReturn]} onValueChange={([v]) => set("expectedReturn", v)} min={1} max={15} step={0.5} data-testid="slider-401k-return" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Current Tax Bracket (Trad.)</Label>
                <span className="text-sm font-medium">{form.taxBracket}%</span>
              </div>
              <Slider value={[form.taxBracket]} onValueChange={([v]) => set("taxBracket", v)} min={10} max={37} step={1} data-testid="slider-tax-bracket" />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="growth">
            <TabsList className="w-full" data-testid="tabs-401k">
              <TabsTrigger value="growth" className="flex-1">Growth Over Time</TabsTrigger>
              <TabsTrigger value="breakdown" className="flex-1">Contribution Breakdown</TabsTrigger>
            </TabsList>

            <TabsContent value="growth">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Balance Projection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[420px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projectionData} margin={{ top: 5, right: 10, left: 10, bottom: 56 }}>
                        <defs>
                          <linearGradient id="tradGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="contribGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="age" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: "Age", position: "insideBottom", offset: -10, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={62} label={{ value: "401k Balance", angle: -90, position: "insideLeft", offset: 0, fontSize: 11, fill: "hsl(var(--muted-foreground))", dy: 45 }} />
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
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 24 }} />
                        <Area type="monotone" dataKey="contributions" name="Total Contributions" stroke="hsl(var(--chart-3))" fill="url(#contribGradient)" strokeWidth={1.5} />
                        <Area type="monotone" dataKey="traditional" name="Balance (w/ growth)" stroke="hsl(var(--chart-1))" fill="url(#tradGradient)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="breakdown">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Where the Money Comes From</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={annualBreakdownData} margin={{ top: 5, right: 10, left: 10, bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="age" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: "Age", position: "insideBottom", offset: -10, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={62} label={{ value: "Cumulative Amount", angle: -90, position: "insideLeft", offset: 0, fontSize: 11, fill: "hsl(var(--muted-foreground))", dy: 58 }} />
                        <Tooltip
                          content={({ active, payload, label }: any) => {
                            if (active && payload?.length) {
                              return (
                                <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md text-xs space-y-1">
                                  <p className="font-semibold">Age {label}</p>
                                  {payload.map((p: any) => (
                                    <p key={p.dataKey} style={{ color: p.fill }}>{p.name}: {formatCurrency(p.value)}</p>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 24 }} />
                        <Bar dataKey="Your Contributions" stackId="a" fill="hsl(var(--chart-1))" />
                        <Bar dataKey="Employer Match" stackId="a" fill="hsl(var(--chart-2))" />
                        <Bar dataKey="Investment Growth" stackId="a" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Traditional vs. Roth 401k</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-sm font-semibold">Traditional 401k</p>
                  <p className="text-xs text-muted-foreground">Pre-tax contributions, taxed on withdrawal</p>
                  <p className="text-2xl font-bold">{formatCurrency(finalTrad)}</p>
                  <p className="text-xs text-muted-foreground">Balance at retirement</p>
                  <div className="pt-1 border-t">
                    <p className="text-xs text-muted-foreground">After {form.taxBracket}% tax on withdrawal</p>
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(finalTradAfterTax)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Tax savings now: {formatCurrency(annualContribution * (form.taxBracket / 100))}/yr</p>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-sm font-semibold">Roth 401k</p>
                  <p className="text-xs text-muted-foreground">After-tax contributions, tax-free growth</p>
                  <p className="text-2xl font-bold">{formatCurrency(finalRoth)}</p>
                  <p className="text-xs text-muted-foreground">Balance at retirement</p>
                  <div className="pt-1 border-t">
                    <p className="text-xs text-muted-foreground">After-tax (0% on withdrawal)</p>
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(finalRoth)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">No tax savings now, fully tax-free later</p>
                </div>
              </div>

              <Card className="bg-muted/70">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-semibold text-foreground">Which should you choose?</p>
                      <p><strong>Traditional:</strong> Best if you expect to be in a lower tax bracket in retirement, or need the tax break now to afford higher contributions.</p>
                      <p><strong>Roth:</strong> Best if you're early in your career (lower bracket now), expect higher taxes in retirement, or want tax-free flexibility later. Roth also has no required minimum distributions (RMDs).</p>
                      <p><strong>Many people split between both</strong> to hedge against future tax uncertainty.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!gettingFullMatch && (
                <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-semibold text-amber-700 dark:text-amber-400">You're leaving free money on the table!</p>
                        <p className="mt-1">
                          Your employer matches up to <strong>{form.employerMatchLimit}%</strong> of your salary but you're only contributing <strong>{form.contributionPct}%</strong>.
                          Increase your contribution to at least <strong>{form.employerMatchLimit}%</strong> to get the full match of <strong>{formatCurrency(salary * (form.employerMatchPct / 100))}/yr</strong>.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
