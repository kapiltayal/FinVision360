import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { ExportMenu } from "@/components/export-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Target, TrendingUp, Calendar, DollarSign, Save, Clock } from "lucide-react";
import { type RetirementGoal } from "@shared/schema";
import { formatCurrency } from "@/lib/format";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

export default function RetirementPlannerPage() {
  const { toast } = useToast();
  const { data: goal, isLoading } = useQuery<RetirementGoal | null>({ queryKey: ["/api/retirement"] });

  const [form, setForm] = useState({
    currentAge: 30,
    retirementAge: 65,
    monthlyContribution: "500",
    expectedReturn: "7",
    inflationRate: "3",
    currentSavings: "10000",
    targetAmount: "1000000",
  });

  useEffect(() => {
    if (goal) {
      setForm({
        currentAge: goal.currentAge || 30,
        retirementAge: goal.retirementAge || 65,
        monthlyContribution: goal.monthlyContribution || "500",
        expectedReturn: goal.expectedReturn || "7",
        inflationRate: goal.inflationRate || "3",
        currentSavings: goal.currentSavings || "10000",
        targetAmount: goal.targetAmount || "1000000",
      });
    }
  }, [goal]);

  const { formattedDate, markUpdated } = useLastUpdated("retirement-planner");

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/retirement", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retirement"] });
      markUpdated();
      toast({ title: "Retirement plan saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const projectionData = useMemo(() => {
    const years = form.retirementAge - form.currentAge;
    const monthlyRate = parseFloat(form.expectedReturn) / 100 / 12;
    const inflationRate = parseFloat(form.inflationRate) / 100;
    const monthly = parseFloat(form.monthlyContribution);
    let nominal = parseFloat(form.currentSavings);
    let real = nominal;
    const data = [{ year: form.currentAge, nominal: Math.round(nominal), real: Math.round(real) }];

    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        nominal = nominal * (1 + monthlyRate) + monthly;
      }
      real = nominal / Math.pow(1 + inflationRate, y);
      data.push({ year: form.currentAge + y, nominal: Math.round(nominal), real: Math.round(real) });
    }
    return data;
  }, [form]);

  const finalValue = projectionData[projectionData.length - 1]?.nominal || 0;
  const finalRealValue = projectionData[projectionData.length - 1]?.real || 0;
  const targetAmount = parseFloat(form.targetAmount) || 0;
  const shortfall = targetAmount - finalValue;
  const yearsToRetire = form.retirementAge - form.currentAge;
  const totalContributed = parseFloat(form.currentSavings) + parseFloat(form.monthlyContribution) * 12 * yearsToRetire;
  const investmentGrowth = finalValue - totalContributed;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-96 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-retirement-title">Retirement Planner</h1>
          <p className="text-muted-foreground">Project your savings and plan your path to financial freedom</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1" data-testid="text-retirement-last-updated">
            <Clock className="h-3 w-3" /> Last updated: {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={{
            filename: "Retirement Plan Projections",
            sheets: [
              {
                name: "Settings",
                columns: ["Setting", "Value"],
                rows: [
                  ["Current Age", form.currentAge],
                  ["Retirement Age", form.retirementAge],
                  ["Current Savings ($)", parseFloat(form.currentSavings || "0")],
                  ["Monthly Contribution ($)", parseFloat(form.monthlyContribution || "0")],
                  ["Expected Return (%)", parseFloat(form.expectedReturn || "0")],
                  ["Inflation Rate (%)", parseFloat(form.inflationRate || "0")],
                  ["Target Amount ($)", parseFloat(form.targetAmount || "0")],
                ],
              },
              {
                name: "Projections",
                columns: ["Age", "Nominal Value ($)", "Real Value (Inflation-Adj $)"],
                rows: projectionData.map((d) => [d.year, d.nominal, d.real]),
              },
            ],
          }} />
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-retirement">
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
                <p className="text-sm text-muted-foreground">Projected Value</p>
                <p className="text-lg font-bold" data-testid="text-projected-value">{formatCurrency(finalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Real Value (Today's $)</p>
                <p className="text-lg font-bold">{formatCurrency(finalRealValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`stat-card-3d border ${shortfall <= 0 ? "stat-card-3d-green" : "stat-card-3d-red"}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-md flex items-center justify-center ${shortfall <= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <Target className={`h-5 w-5 ${shortfall <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{shortfall <= 0 ? "Surplus" : "Shortfall"}</p>
                <p className={`text-lg font-bold ${shortfall <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(Math.abs(shortfall))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Years to Retire</p>
                <p className="text-lg font-bold">{yearsToRetire} years</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Current Age</Label>
                  <span className="text-sm font-medium">{form.currentAge}</span>
                </div>
                <Slider value={[form.currentAge]} onValueChange={([v]) => setForm({ ...form, currentAge: v })} min={18} max={70} step={1} data-testid="slider-current-age" />
              </div>
              <div className="space-y-2">
                <Label>Current Savings ($)</Label>
                <Input data-testid="input-current-savings" type="number" value={form.currentSavings} onChange={(e) => setForm({ ...form, currentSavings: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Contribution ($)</Label>
                <Input data-testid="input-monthly-contribution" type="number" value={form.monthlyContribution} onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Future Expectations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Retirement Age</Label>
                  <span className="text-sm font-medium">{form.retirementAge}</span>
                </div>
                <Slider value={[form.retirementAge]} onValueChange={([v]) => setForm({ ...form, retirementAge: v })} min={form.currentAge + 1} max={80} step={1} data-testid="slider-retirement-age" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Expected Return</Label>
                  <span className="text-sm font-medium">{form.expectedReturn}%</span>
                </div>
                <Slider value={[parseFloat(form.expectedReturn)]} onValueChange={([v]) => setForm({ ...form, expectedReturn: v.toString() })} min={1} max={15} step={0.5} data-testid="slider-expected-return" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Inflation Rate</Label>
                  <span className="text-sm font-medium">{form.inflationRate}%</span>
                </div>
                <Slider value={[parseFloat(form.inflationRate)]} onValueChange={([v]) => setForm({ ...form, inflationRate: v.toString() })} min={0} max={10} step={0.5} data-testid="slider-inflation-rate" />
              </div>
              <div className="space-y-2">
                <Label>Target Amount ($)</Label>
                <Input data-testid="input-target-amount" type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Growth Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="nominalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (active && payload?.length) {
                        return (
                          <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md">
                            <p className="text-sm font-medium">Age {label}</p>
                            <p className="text-sm" style={{ color: "hsl(var(--chart-1))" }}>Nominal: {formatCurrency(payload[0]?.value || 0)}</p>
                            <p className="text-sm" style={{ color: "hsl(var(--chart-2))" }}>Real: {formatCurrency(payload[1]?.value || 0)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {targetAmount > 0 && (
                    <ReferenceLine y={targetAmount} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" label={{ value: "Target", position: "insideTopRight", fontSize: 11, fill: "hsl(var(--chart-4))" }} />
                  )}
                  <Area type="monotone" dataKey="nominal" stroke="hsl(var(--chart-1))" fill="url(#nominalGradient)" strokeWidth={2} name="Nominal Value" />
                  <Area type="monotone" dataKey="real" stroke="hsl(var(--chart-2))" fill="url(#realGradient)" strokeWidth={2} name="Real Value" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-3 rounded-md bg-muted/80">
                <p className="text-xs text-muted-foreground">Total Contributed</p>
                <p className="text-sm font-semibold">{formatCurrency(totalContributed)}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/80">
                <p className="text-xs text-muted-foreground">Investment Growth</p>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(investmentGrowth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
