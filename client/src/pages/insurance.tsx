import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car, Home, Heart, TrendingUp, Plus, Pencil, Trash2,
  ShieldCheck, DollarSign, Calendar, FileText, Stethoscope, MoreHorizontal,
  ChevronDown, ChevronUp, X,
} from "lucide-react";
import { type InsurancePolicy } from "@shared/schema";
import { formatCurrency } from "@/lib/format";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from "recharts";

type TabType = "auto" | "home" | "life" | "annuity" | "health" | "other";

const TABS: { key: TabType; label: string; icon: any; color: string; bg: string; hex: string }[] = [
  { key: "auto",    label: "Auto",      icon: Car,            color: "text-[#1C91D4]",    bg: "bg-[#1C91D4]/10",    hex: "#1C91D4" },
  { key: "home",    label: "Home",      icon: Home,           color: "text-amber-500",   bg: "bg-amber-500/10",   hex: "#f59e0b" },
  { key: "life",    label: "Life",      icon: Heart,          color: "text-rose-500",    bg: "bg-rose-500/10",    hex: "#f43f5e" },
  { key: "health",  label: "Health",    icon: Stethoscope,    color: "text-teal-500",    bg: "bg-teal-500/10",    hex: "#14b8a6" },
  { key: "other",   label: "Other",     icon: MoreHorizontal, color: "text-purple-500",  bg: "bg-purple-500/10",  hex: "#a855f7" },
  { key: "annuity", label: "Annuities", icon: TrendingUp,     color: "text-emerald-500", bg: "bg-emerald-500/10", hex: "#10b981" },
];

const OTHER_SUBTYPES = [
  { value: "umbrella",        label: "Umbrella" },
  { value: "disability",      label: "Disability" },
  { value: "long_term_care",  label: "Long-Term Care" },
  { value: "pet",             label: "Pet Insurance" },
  { value: "identity_theft",  label: "Identity Theft" },
  { value: "business",        label: "Business Insurance" },
  { value: "other",           label: "Other" },
];

type Vehicle = { year: string; make: string; model: string };

const EMPTY_VEHICLE: Vehicle = { year: "", make: "", model: "" };

const EMPTY_FORM = {
  type: "auto" as TabType,
  name: "",
  provider: "",
  policyNumber: "",
  premium: "",
  premiumFrequency: "monthly",
  coverageAmount: "",
  deductible: "",
  renewalDate: "",
  // multi-vehicle stored as JSON string
  vehiclesJson: JSON.stringify([{ ...EMPTY_VEHICLE }]),
  // home
  propertyAddress: "",
  // life
  lifeType: "term",
  deathBenefit: "",
  cashValue: "",
  beneficiary: "",
  // annuity
  annuityType: "fixed",
  currentValue: "",
  monthlyPayout: "",
  interestRate: "",
  surrenderPeriod: "",
  // health
  healthPlanType: "ppo",
  memberId: "",
  groupNumber: "",
  outOfPocketMax: "",
  // other
  otherSubtype: "umbrella",
  notes: "",
};

function parseExtraVehicles(notes: string): { vehicles: Vehicle[]; userNotes: string } {
  const match = notes.match(/\[__vehicles__\]([\s\S]*?)\[end__vehicles__\]/);
  if (!match) return { vehicles: [], userNotes: notes };
  try {
    const vehicles = JSON.parse(match[1]) as Vehicle[];
    const userNotes = notes.replace(match[0], "").trim();
    return { vehicles, userNotes };
  } catch {
    return { vehicles: [], userNotes: notes };
  }
}

function toForm(p: InsurancePolicy): typeof EMPTY_FORM {
  let userNotes = p.notes || "";
  let vehicles: Vehicle[] = [{ year: p.vehicleYear?.toString() || "", make: p.vehicleMake || "", model: p.vehicleModel || "" }];

  if (p.type === "auto") {
    const parsed = parseExtraVehicles(userNotes);
    vehicles = [vehicles[0], ...parsed.vehicles];
    userNotes = parsed.userNotes;
  }

  const base: typeof EMPTY_FORM = {
    type: p.type as TabType,
    name: p.name,
    provider: p.provider || "",
    policyNumber: p.policyNumber || "",
    premium: p.premium || "",
    premiumFrequency: p.premiumFrequency || "monthly",
    coverageAmount: p.coverageAmount || "",
    deductible: p.deductible || "",
    renewalDate: p.renewalDate || "",
    vehiclesJson: JSON.stringify(vehicles),
    propertyAddress: p.propertyAddress || "",
    lifeType: p.lifeType || "term",
    deathBenefit: p.deathBenefit || "",
    cashValue: p.cashValue || "",
    beneficiary: p.beneficiary || "",
    annuityType: p.annuityType || "fixed",
    currentValue: p.currentValue || "",
    monthlyPayout: p.monthlyPayout || "",
    interestRate: p.interestRate || "",
    surrenderPeriod: p.surrenderPeriod?.toString() || "",
    healthPlanType: "ppo",
    memberId: "",
    groupNumber: "",
    outOfPocketMax: "",
    otherSubtype: "umbrella",
    notes: userNotes,
  };

  if (p.type === "health") {
    base.healthPlanType = p.lifeType || "ppo";
    base.memberId = p.beneficiary || "";
    base.groupNumber = p.propertyAddress || "";
    base.outOfPocketMax = p.cashValue || "";
  }
  if (p.type === "other") {
    base.otherSubtype = p.lifeType || "umbrella";
    base.beneficiary = p.beneficiary || "";
  }
  return base;
}

function formToPayload(form: typeof EMPTY_FORM) {
  const payload: any = {
    type: form.type,
    name: form.name,
    provider: form.provider || null,
    policyNumber: form.policyNumber || null,
    premium: form.premium || null,
    premiumFrequency: form.premiumFrequency,
    coverageAmount: form.coverageAmount || null,
    deductible: form.deductible || null,
    renewalDate: form.renewalDate || null,
    notes: form.notes || null,
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    propertyAddress: null,
    lifeType: null,
    deathBenefit: null,
    cashValue: null,
    beneficiary: null,
    annuityType: null,
    currentValue: null,
    monthlyPayout: null,
    interestRate: null,
    surrenderPeriod: null,
  };

  if (form.type === "auto") {
    let vehicles: Vehicle[] = [];
    try { vehicles = JSON.parse(form.vehiclesJson); } catch {}
    const [first, ...rest] = vehicles;
    payload.vehicleYear = first?.year ? parseInt(first.year) : null;
    payload.vehicleMake = first?.make || null;
    payload.vehicleModel = first?.model || null;
    if (rest.length > 0) {
      const tag = `[__vehicles__]${JSON.stringify(rest)}[end__vehicles__]`;
      payload.notes = form.notes ? `${tag}\n${form.notes}` : tag;
    } else {
      payload.notes = form.notes || null;
    }
  }
  if (form.type === "home") {
    payload.propertyAddress = form.propertyAddress || null;
  }
  if (form.type === "life") {
    payload.lifeType = form.lifeType || null;
    payload.deathBenefit = form.deathBenefit || null;
    payload.cashValue = form.cashValue || null;
    payload.beneficiary = form.beneficiary || null;
  }
  if (form.type === "annuity") {
    payload.annuityType = form.annuityType || null;
    payload.currentValue = form.currentValue || null;
    payload.monthlyPayout = form.monthlyPayout || null;
    payload.interestRate = form.interestRate || null;
    payload.surrenderPeriod = form.surrenderPeriod ? parseInt(form.surrenderPeriod) : null;
  }
  if (form.type === "health") {
    payload.lifeType = form.healthPlanType || null;
    payload.beneficiary = form.memberId || null;
    payload.propertyAddress = form.groupNumber || null;
    payload.cashValue = form.outOfPocketMax || null;
  }
  if (form.type === "other") {
    payload.lifeType = form.otherSubtype || null;
    payload.beneficiary = form.beneficiary || null;
  }
  return payload;
}

function VehicleRow({
  vehicle, index, total, onChange, onRemove,
}: {
  vehicle: Vehicle;
  index: number;
  total: number;
  onChange: (v: Vehicle) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Vehicle {index + 1}</p>
        {total > 1 && (
          <button type="button" onClick={onRemove} className="text-destructive hover:text-destructive/80">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Year</Label>
          <Input
            type="number"
            value={vehicle.year}
            onChange={(e) => onChange({ ...vehicle, year: e.target.value })}
            placeholder="2022"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Make</Label>
          <Input
            value={vehicle.make}
            onChange={(e) => onChange({ ...vehicle, make: e.target.value })}
            placeholder="Toyota"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          <Input
            value={vehicle.model}
            onChange={(e) => onChange({ ...vehicle, model: e.target.value })}
            placeholder="Camry"
          />
        </div>
      </div>
    </div>
  );
}

function PolicyForm({ form, onChange }: { form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void }) {
  const set = (key: keyof typeof EMPTY_FORM, val: string) => onChange({ ...form, [key]: val });

  let vehicles: Vehicle[] = [];
  try { vehicles = JSON.parse(form.vehiclesJson); } catch {}
  if (vehicles.length === 0) vehicles = [{ ...EMPTY_VEHICLE }];

  const setVehicles = (vs: Vehicle[]) => onChange({ ...form, vehiclesJson: JSON.stringify(vs) });

  const updateVehicle = (i: number, v: Vehicle) => {
    const next = [...vehicles];
    next[i] = v;
    setVehicles(next);
  };

  const addVehicle = () => setVehicles([...vehicles, { ...EMPTY_VEHICLE }]);
  const removeVehicle = (i: number) => setVehicles(vehicles.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label>Policy Name *</Label>
          <Input data-testid="input-policy-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Blue Cross Health Plan" />
        </div>
        <div className="space-y-1">
          <Label>Provider / Company</Label>
          <Input data-testid="input-policy-provider" value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="Geico, Allstate, BCBS…" />
        </div>
        <div className="space-y-1">
          <Label>Policy Number</Label>
          <Input data-testid="input-policy-number" value={form.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Premium Amount ($)</Label>
          <Input data-testid="input-policy-premium" type="number" value={form.premium} onChange={(e) => set("premium", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Frequency</Label>
          <Select value={form.premiumFrequency} onValueChange={(v) => set("premiumFrequency", v)}>
            <SelectTrigger data-testid="select-premium-frequency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Coverage Amount ($)</Label>
          <Input data-testid="input-coverage-amount" type="number" value={form.coverageAmount} onChange={(e) => set("coverageAmount", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Deductible ($)</Label>
          <Input data-testid="input-deductible" type="number" value={form.deductible} onChange={(e) => set("deductible", e.target.value)} />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Renewal / Expiry Date</Label>
          <Input data-testid="input-renewal-date" type="date" value={form.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} />
        </div>
      </div>

      {form.type === "auto" && (
        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Vehicles ({vehicles.length})
            </p>
            <Button type="button" size="sm" variant="outline" onClick={addVehicle} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Vehicle
            </Button>
          </div>
          <div className="space-y-2">
            {vehicles.map((v, i) => (
              <VehicleRow
                key={i}
                vehicle={v}
                index={i}
                total={vehicles.length}
                onChange={(updated) => updateVehicle(i, updated)}
                onRemove={() => removeVehicle(i)}
              />
            ))}
          </div>
        </div>
      )}

      {form.type === "home" && (
        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Details</p>
          <div className="space-y-1">
            <Label>Property Address</Label>
            <Input data-testid="input-property-address" value={form.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} placeholder="123 Main St, City, State" />
          </div>
        </div>
      )}

      {form.type === "life" && (
        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Life Insurance Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Policy Type</Label>
              <Select value={form.lifeType} onValueChange={(v) => set("lifeType", v)}>
                <SelectTrigger data-testid="select-life-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="term">Term</SelectItem>
                  <SelectItem value="whole">Whole Life</SelectItem>
                  <SelectItem value="universal">Universal Life</SelectItem>
                  <SelectItem value="variable">Variable Life</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Death Benefit ($)</Label>
              <Input data-testid="input-death-benefit" type="number" value={form.deathBenefit} onChange={(e) => set("deathBenefit", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cash Value ($)</Label>
              <Input data-testid="input-cash-value" type="number" value={form.cashValue} onChange={(e) => set("cashValue", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Beneficiary</Label>
              <Input data-testid="input-beneficiary" value={form.beneficiary} onChange={(e) => set("beneficiary", e.target.value)} placeholder="Jane Doe" />
            </div>
          </div>
        </div>
      )}

      {form.type === "health" && (
        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Health Plan Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Plan Type</Label>
              <Select value={form.healthPlanType} onValueChange={(v) => set("healthPlanType", v)}>
                <SelectTrigger data-testid="select-health-plan-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hmo">HMO</SelectItem>
                  <SelectItem value="ppo">PPO</SelectItem>
                  <SelectItem value="epo">EPO</SelectItem>
                  <SelectItem value="hdhp">HDHP</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="medicare">Medicare</SelectItem>
                  <SelectItem value="medicaid">Medicaid</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Out-of-Pocket Max ($)</Label>
              <Input data-testid="input-out-of-pocket-max" type="number" value={form.outOfPocketMax} onChange={(e) => set("outOfPocketMax", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Member ID</Label>
              <Input data-testid="input-member-id" value={form.memberId} onChange={(e) => set("memberId", e.target.value)} placeholder="MBR123456" />
            </div>
            <div className="space-y-1">
              <Label>Group / Employer Name</Label>
              <Input data-testid="input-group-number" value={form.groupNumber} onChange={(e) => set("groupNumber", e.target.value)} placeholder="Employer or Group #" />
            </div>
          </div>
        </div>
      )}

      {form.type === "other" && (
        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Policy Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Insurance Sub-Type</Label>
              <Select value={form.otherSubtype} onValueChange={(v) => set("otherSubtype", v)}>
                <SelectTrigger data-testid="select-other-subtype"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OTHER_SUBTYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Beneficiary / Insured</Label>
              <Input data-testid="input-other-beneficiary" value={form.beneficiary} onChange={(e) => set("beneficiary", e.target.value)} placeholder="Name or entity covered" />
            </div>
          </div>
        </div>
      )}

      {form.type === "annuity" && (
        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Annuity Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Annuity Type</Label>
              <Select value={form.annuityType} onValueChange={(v) => set("annuityType", v)}>
                <SelectTrigger data-testid="select-annuity-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                  <SelectItem value="indexed">Indexed</SelectItem>
                  <SelectItem value="immediate">Immediate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Current Value ($)</Label>
              <Input data-testid="input-annuity-value" type="number" value={form.currentValue} onChange={(e) => set("currentValue", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Monthly Payout ($)</Label>
              <Input data-testid="input-monthly-payout" type="number" value={form.monthlyPayout} onChange={(e) => set("monthlyPayout", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Interest / Growth Rate (%)</Label>
              <Input data-testid="input-annuity-rate" type="number" value={form.interestRate} onChange={(e) => set("interestRate", e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Surrender Period (years)</Label>
              <Input data-testid="input-surrender-period" type="number" value={form.surrenderPeriod} onChange={(e) => set("surrenderPeriod", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className="border-t pt-3 space-y-1">
        <Label>Notes</Label>
        <Textarea data-testid="input-policy-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Any additional details…" />
      </div>
    </div>
  );
}

function annualPremium(policy: InsurancePolicy): number {
  const p = parseFloat(policy.premium || "0");
  if (!p) return 0;
  if (policy.premiumFrequency === "monthly") return p * 12;
  if (policy.premiumFrequency === "quarterly") return p * 4;
  return p;
}

function getOtherSubtypeLabel(value: string | null): string {
  return OTHER_SUBTYPES.find((s) => s.value === value)?.label || value || "Other";
}

function getPlanTypeLabel(value: string | null): string {
  return (value || "").toUpperCase() || "—";
}

function getAllVehicles(policy: InsurancePolicy): Vehicle[] {
  const first: Vehicle = {
    year: policy.vehicleYear?.toString() || "",
    make: policy.vehicleMake || "",
    model: policy.vehicleModel || "",
  };
  const hasFirst = first.make || first.model || first.year;
  const { vehicles: extra } = parseExtraVehicles(policy.notes || "");
  return hasFirst ? [first, ...extra] : extra;
}

const DONUT_RADIAN = Math.PI / 180;
function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * DONUT_RADIAN);
  const y = cy + radius * Math.sin(-midAngle * DONUT_RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function SummaryCard({
  icon: Icon, iconClass, iconBg, label, value, expanded, onToggle, chartData, emptyLabel,
}: {
  icon: any; iconClass: string; iconBg: string; label: string; value: string;
  expanded: boolean; onToggle: () => void;
  chartData: { name: string; value: number; color: string }[];
  emptyLabel: string;
}) {
  const hasData = chartData.some((d) => d.value > 0);
  const filteredData = chartData.filter((d) => d.value > 0);

  return (
    <Card
      className={`stat-card-3d cursor-pointer ${expanded ? "ring-2 ring-primary/30" : ""}`}
      onClick={onToggle}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-md ${iconBg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${iconClass}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-lg font-bold">{value}</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
            {!hasData ? (
              <p className="text-sm text-muted-foreground text-center py-4">{emptyLabel}</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filteredData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      label={DonutLabel}
                    >
                      {filteredData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }: any) => {
                        if (active && payload?.length) {
                          return (
                            <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md text-xs">
                              <p className="font-semibold">{payload[0].name}</p>
                              <p>{formatCurrency(payload[0].value)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value, entry: any) => (
                        <span style={{ color: entry.color }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PolicyCard({
  policy, onEdit, onDelete,
}: {
  policy: InsurancePolicy;
  onEdit: (p: InsurancePolicy) => void;
  onDelete: (p: InsurancePolicy) => void;
}) {
  const tab = TABS.find((t) => t.key === policy.type)!;
  const Icon = tab?.icon || ShieldCheck;

  const mainValue =
    policy.type === "annuity" ? policy.currentValue
    : policy.type === "life" ? (policy.deathBenefit || policy.coverageAmount)
    : policy.coverageAmount;

  const allVehicles = policy.type === "auto" ? getAllVehicles(policy) : [];

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-policy-${policy.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-9 w-9 rounded-md ${tab?.bg} flex items-center justify-center shrink-0`}>
              <Icon className={`h-4 w-4 ${tab?.color}`} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{policy.name}</p>
              {policy.provider && <p className="text-xs text-muted-foreground truncate">{policy.provider}</p>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(policy)} data-testid={`button-edit-policy-${policy.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(policy)} data-testid={`button-delete-policy-${policy.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {mainValue && (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">
                  {policy.type === "annuity" ? "Value" : policy.type === "life" ? "Death Benefit" : "Coverage"}
                </p>
                <p className="text-sm font-semibold">{formatCurrency(parseFloat(mainValue))}</p>
              </div>
            </div>
          )}
          {policy.premium && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Premium</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(parseFloat(policy.premium))}
                  <span className="text-xs font-normal text-muted-foreground">/{policy.premiumFrequency?.slice(0, 2) || "mo"}</span>
                </p>
              </div>
            </div>
          )}
          {policy.deductible && (
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Deductible</p>
                <p className="text-sm font-semibold">{formatCurrency(parseFloat(policy.deductible))}</p>
              </div>
            </div>
          )}
          {policy.renewalDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Renewal</p>
                <p className="text-sm font-semibold">{policy.renewalDate}</p>
              </div>
            </div>
          )}
          {policy.type === "health" && policy.cashValue && (
            <div className="flex items-center gap-1.5 col-span-2">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Out-of-Pocket Max</p>
                <p className="text-sm font-semibold">{formatCurrency(parseFloat(policy.cashValue))}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {policy.type === "auto" && allVehicles.length > 0 && allVehicles.map((v, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {[v.year, v.make, v.model].filter(Boolean).join(" ") || `Vehicle ${i + 1}`}
            </Badge>
          ))}
          {policy.type === "home" && policy.propertyAddress && (
            <p className="text-xs text-muted-foreground truncate w-full">{policy.propertyAddress}</p>
          )}
          {policy.type === "life" && (
            <>
              {policy.lifeType && <Badge variant="outline" className="text-xs capitalize">{policy.lifeType}</Badge>}
              {policy.beneficiary && <Badge variant="secondary" className="text-xs">👤 {policy.beneficiary}</Badge>}
            </>
          )}
          {policy.type === "health" && (
            <>
              {policy.lifeType && <Badge variant="outline" className="text-xs">{getPlanTypeLabel(policy.lifeType)}</Badge>}
              {policy.beneficiary && <Badge variant="secondary" className="text-xs">ID: {policy.beneficiary}</Badge>}
              {policy.propertyAddress && <Badge variant="secondary" className="text-xs">Grp: {policy.propertyAddress}</Badge>}
            </>
          )}
          {policy.type === "other" && (
            <>
              {policy.lifeType && <Badge variant="outline" className="text-xs">{getOtherSubtypeLabel(policy.lifeType)}</Badge>}
              {policy.beneficiary && <Badge variant="secondary" className="text-xs">👤 {policy.beneficiary}</Badge>}
            </>
          )}
          {policy.type === "annuity" && (
            <>
              {policy.annuityType && <Badge variant="outline" className="text-xs capitalize">{policy.annuityType}</Badge>}
              {policy.monthlyPayout && <Badge variant="secondary" className="text-xs">{formatCurrency(parseFloat(policy.monthlyPayout))}/mo payout</Badge>}
            </>
          )}
        </div>

        {policy.policyNumber && (
          <p className="text-xs text-muted-foreground">Policy #{policy.policyNumber}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function InsurancePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("auto");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsurancePolicy | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM, type: "auto" });
  const [expandedCard, setExpandedCard] = useState<"premiums" | "coverage" | "annuity" | null>(null);

  const { data: policies = [], isLoading } = useQuery<InsurancePolicy[]>({
    queryKey: ["/api/insurance"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/insurance", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insurance"] });
      toast({ title: "Policy added" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/insurance/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insurance"] });
      toast({ title: "Policy updated" });
      setDialogOpen(false);
      setEditingPolicy(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/insurance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insurance"] });
      toast({ title: "Policy deleted" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = (type: TabType) => {
    setEditingPolicy(null);
    setForm({ ...EMPTY_FORM, type });
    setDialogOpen(true);
  };

  const openEdit = (policy: InsurancePolicy) => {
    setEditingPolicy(policy);
    setForm(toForm(policy));
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: "Policy name is required", variant: "destructive" });
      return;
    }
    const payload = formToPayload(form);
    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const tabPolicies = policies.filter((p) => p.type === activeTab);
  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const totalAnnualPremium = policies.reduce((sum, p) => sum + annualPremium(p), 0);
  const totalCoverage = policies
    .filter((p) => p.type !== "annuity")
    .reduce((sum, p) => sum + parseFloat(p.coverageAmount || p.deathBenefit || "0"), 0);
  const totalAnnuityValue = policies
    .filter((p) => p.type === "annuity")
    .reduce((sum, p) => sum + parseFloat(p.currentValue || "0"), 0);

  const premiumChartData = TABS.map((t) => ({
    name: t.label,
    value: policies.filter((p) => p.type === t.key).reduce((s, p) => s + annualPremium(p), 0),
    color: t.hex,
  }));

  const coverageChartData = TABS.filter((t) => t.key !== "annuity").map((t) => ({
    name: t.label,
    value: policies
      .filter((p) => p.type === t.key)
      .reduce((s, p) => s + parseFloat(p.coverageAmount || p.deathBenefit || "0"), 0),
    color: t.hex,
  }));

  const annuityTypeColors: Record<string, string> = {
    fixed: "#10b981", variable: "#1C91D4", indexed: "#f59e0b", immediate: "#a855f7",
  };
  const annuityChartData = ["fixed", "variable", "indexed", "immediate"].map((type) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: policies
      .filter((p) => p.type === "annuity" && p.annuityType === type)
      .reduce((s, p) => s + parseFloat(p.currentValue || "0"), 0),
    color: annuityTypeColors[type],
  }));

  const toggleCard = (card: "premiums" | "coverage" | "annuity") =>
    setExpandedCard((prev) => (prev === card ? null : card));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-insurance-title">Insurance & Annuities</h1>
          <p className="text-muted-foreground">Track all your insurance policies and annuities</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={DollarSign}
          iconClass="text-primary"
          iconBg="bg-primary/10"
          label="Total Annual Premiums"
          value={`${formatCurrency(totalAnnualPremium)}/yr`}
          expanded={expandedCard === "premiums"}
          onToggle={() => toggleCard("premiums")}
          chartData={premiumChartData}
          emptyLabel="No premiums recorded yet"
        />
        <SummaryCard
          icon={ShieldCheck}
          iconClass="text-[#1C91D4]"
          iconBg="bg-[#1C91D4]/10"
          label="Total Coverage"
          value={formatCurrency(totalCoverage)}
          expanded={expandedCard === "coverage"}
          onToggle={() => toggleCard("coverage")}
          chartData={coverageChartData}
          emptyLabel="No coverage amounts recorded yet"
        />
        <SummaryCard
          icon={TrendingUp}
          iconClass="text-emerald-500"
          iconBg="bg-emerald-500/10"
          label="Annuity Assets"
          value={formatCurrency(totalAnnuityValue)}
          expanded={expandedCard === "annuity"}
          onToggle={() => toggleCard("annuity")}
          chartData={annuityChartData}
          emptyLabel="No annuity assets recorded yet"
        />
      </div>

      <div className="border-b">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const count = policies.filter((p) => p.type === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`tab-insurance-${tab.key}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-md ${currentTab.bg} flex items-center justify-center`}>
              <currentTab.icon className={`h-4 w-4 ${currentTab.color}`} />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {currentTab.key === "annuity" ? "Annuities" : `${currentTab.label} Insurance`}
              </h2>
              <p className="text-xs text-muted-foreground">{tabPolicies.length} {tabPolicies.length === 1 ? "policy" : "policies"}</p>
            </div>
          </div>
          <Button size="sm" onClick={() => openAdd(activeTab)} data-testid={`button-add-${activeTab}`}>
            <Plus className="h-4 w-4 mr-1" />
            Add {currentTab.label}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : tabPolicies.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
              <div className={`h-12 w-12 rounded-full ${currentTab.bg} flex items-center justify-center`}>
                <currentTab.icon className={`h-6 w-6 ${currentTab.color}`} />
              </div>
              <div>
                <p className="font-medium">No {currentTab.label.toLowerCase()} {currentTab.key === "annuity" ? "annuities" : "policies"} yet</p>
                <p className="text-sm text-muted-foreground">Add your first to start tracking</p>
              </div>
              <Button size="sm" onClick={() => openAdd(activeTab)} data-testid={`button-add-first-${activeTab}`}>
                <Plus className="h-4 w-4 mr-1" />
                Add {currentTab.label} {currentTab.key === "annuity" ? "Annuity" : "Policy"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tabPolicies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} onEdit={openEdit} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingPolicy(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Policy" : `Add ${currentTab.label} ${currentTab.key === "annuity" ? "Annuity" : "Policy"}`}</DialogTitle>
          </DialogHeader>
          <PolicyForm form={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-policy"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : editingPolicy ? "Save Changes" : "Add Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
