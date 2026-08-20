import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ConnectedAccountsImportPanel } from "@/components/finance-tracker/connected-accounts-import";
import {
  TrendingUp, TrendingDown, Wallet, Plus, Upload, RefreshCw, Pencil, Trash2,
  AlertCircle, ArrowDownCircle, ArrowUpCircle, Repeat2, Tag, Search, X,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, BarChart3,
  PieChart as PieChartIcon, Landmark, Database, CalendarDays, CreditCard,
  HeartHandshake,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
type Transaction = {
  id: number; user_id: string; date: string; description: string; merchant: string | null;
  amount: string; type: "income" | "expense"; subcategory: string;
  needs_want: "need" | "want" | "na" | null; is_recurring: boolean;
  recurring_type: "subscription" | "recurring_bill" | null;
  source: "manual" | "plaid" | "upload" | "import"; notes: string | null;
  plaid_transaction_id: string | null; plaid_account_id: string | null;
  plaid_account_name: string | null; plaid_institution_name: string | null;
  created_at: string; updated_at: string;
};
type SortKey = "date" | "description" | "type" | "category" | "needsWant" | "amount" | "recurring";
type SortDirection = "asc" | "desc";
const TRANSACTION_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "needsWant", label: "Need/Want" },
  { key: "amount", label: "Amount" },
  { key: "recurring", label: "Recurring" },
];
type Stats = {
  total_income: string;
  total_expenses: string;
  unassigned_count: string;
  total_count: string;
  min_date: string | null;
  max_date: string | null;
};
type ImportResult = {
  inserted: number;
  skipped: number;
  skippedReasons: Record<string, number>;
};
type TrendRow = { period: string; income: string; expenses: string };
type CatRow = { subcategory: string; total: string; count: string };
type SubscriptionInsight = {
  name: string;
  charge_count: string;
  total_paid: string;
  latest_amount: string;
  latest_charge_date: string;
};
type SpendingInsights = {
  subscriptions: {
    count: string;
    total: string;
    items: SubscriptionInsight[];
  };
  needsWant: {
    needs: string;
    wants: string;
    unclassified: string;
  };
};
type MerchantUpdateField = "subcategory" | "needsWant" | "recurring";
type PendingMerchantUpdate = {
  id: number;
  merchantName: string;
  changedFields: MerchantUpdateField[];
  data: Record<string, any>;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const INCOME_SUBCATS = [
  { value: "salary", label: "Salary / Wages" }, { value: "bonus", label: "Bonus" },
  { value: "freelance", label: "Freelance / Contract" }, { value: "dividend", label: "Dividend" },
  { value: "interest", label: "Interest" }, { value: "rental", label: "Rental Income" },
  { value: "capital_gains", label: "Capital Gains" }, { value: "business", label: "Business Income" },
  { value: "gift", label: "Gift / Transfer" }, { value: "refund", label: "Refund / Cashback" },
  { value: "other_income", label: "Other Income" }, { value: "unassigned", label: "Unassigned" },
];
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];
const EXPENSE_SUBCATS = [
  { value: "housing", label: "Housing / Rent" }, { value: "utilities", label: "Utilities" },
  { value: "groceries", label: "Groceries" }, { value: "transportation", label: "Transportation" },
  { value: "dining_out", label: "Dining Out" }, { value: "entertainment", label: "Entertainment" },
  { value: "healthcare", label: "Healthcare" }, { value: "insurance", label: "Insurance" },
  { value: "education", label: "Education" }, { value: "shopping", label: "Shopping" },
  { value: "subscriptions", label: "Subscriptions" }, { value: "personal_care", label: "Personal Care" },
  { value: "travel", label: "Travel" }, { value: "debt_payment", label: "Debt Payment" },
  { value: "investment", label: "Investment" }, { value: "taxes", label: "Taxes" },
  { value: "savings_transfer", label: "Savings Transfer" }, { value: "other_expense", label: "Other Expense" },
  { value: "unassigned", label: "Unassigned" },
];
const ALL_SUBCATS = [...INCOME_SUBCATS, ...EXPENSE_SUBCATS];

const CAT_COLORS: Record<string, string> = {
  housing: "#3b82f6", utilities: "#8b5cf6", groceries: "#22c55e", transportation: "#f97316",
  dining_out: "#ef4444", entertainment: "#ec4899", healthcare: "#06b6d4", insurance: "#6366f1",
  education: "#84cc16", shopping: "#f59e0b", subscriptions: "#a855f7", personal_care: "#fb923c",
  travel: "#14b8a6", debt_payment: "#dc2626", investment: "#059669", taxes: "#9333ea",
  savings_transfer: "#0ea5e9", other_expense: "#94a3b8", salary: "#16a34a", bonus: "#15803d",
  freelance: "#4ade80", dividend: "#86efac", interest: "#166534", rental: "#6ee7b7",
  capital_gains: "#052e16", business: "#22c55e", gift: "#a7f3d0", refund: "#d1fae5",
  other_income: "#bbf7d0", unassigned: "#cbd5e1",
};

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" }, { value: "week", label: "This Week" },
  { value: "month", label: "This Month" }, { value: "lastMonth", label: "Last Month" },
  { value: "last90", label: "Last 90 Days" }, { value: "year", label: "This Year" },
  { value: "all", label: "All Time" }, { value: "custom", label: "Custom" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtDate(s: string) {
  return new Date(s.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtPeriod(s: string, groupBy: string) {
  const d = new Date(s.slice(0, 10) + "T12:00:00");
  if (groupBy === "day") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (groupBy === "week") return `Wk ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  if (groupBy === "year") return String(d.getFullYear());
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
function catLabel(v: string) {
  return ALL_SUBCATS.find(s => s.value === v)?.label ?? v;
}

function getDateRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  if (period === "today") return { start: today, end: today };
  if (period === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { start: d.toISOString().split("T")[0], end: today };
  }
  if (period === "month") {
    return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: today };
  }
  if (period === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: formatDate(start), end: formatDate(end) };
  }
  if (period === "last90") {
    const start = new Date(now);
    start.setDate(start.getDate() - 89);
    return { start: formatDate(start), end: today };
  }
  if (period === "year") return { start: `${now.getFullYear()}-01-01`, end: today };
  if (period === "custom") return { start: customStart, end: customEnd };
  return { start: undefined, end: undefined };
}

// ── CSV Parsing ───────────────────────────────────────────────────────────────
function detectDelimiter(line: string) {
  const counts = { "\t": 0, ",": 0, ";": 0, "|": 0 };
  for (const ch of line) if (ch in counts) (counts as any)[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
function parseCSVText(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  return lines.map(line => {
    const cells: string[] = []; let inQ = false; let cur = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === delim && !inQ) { cells.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}
function parseDate(s: string): string | null {
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (us) {
    const yr = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${yr}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}
function guessCol(headers: string[], keywords: string[]) {
  const h = headers.map(x => x.toLowerCase().trim());
  for (const kw of keywords) {
    const i = h.findIndex(x => x.includes(kw));
    if (i !== -1) return String(i);
  }
  return "";
}

// ── TransactionDialog ─────────────────────────────────────────────────────────
function TransactionDialog({
  open, onOpenChange, initial, onSave, saving,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial?: Partial<Transaction>; onSave: (data: any) => void; saving: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(initial?.date ?? today);
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial?.amount ? String(parseFloat(initial.amount)) : "");
  const [type, setType] = useState<"income" | "expense">(initial?.type ?? "expense");
  const [subcat, setSubcat] = useState(initial?.subcategory ?? "unassigned");
  const [nw, setNw] = useState(initial?.needs_want ?? "");
  const [recurring, setRecurring] = useState(initial?.is_recurring ?? false);
  const [recurringType, setRecurringType] = useState(initial?.recurring_type ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const subcats = type === "income" ? INCOME_SUBCATS : EXPENSE_SUBCATS;
  const isEdit = !!initial?.id;

  const canSave = date && desc && amount && parseFloat(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Type *</Label>
              <Select value={type} onValueChange={v => { setType(v as any); setSubcat("unassigned"); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Description *</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Spotify, Payroll…" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount *</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={subcat} onValueChange={setSubcat}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subcats.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Needs / Want</Label>
              <Select value={nw || "na"} onValueChange={setNw}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="na">N/A</SelectItem>
                  <SelectItem value="need">Need</SelectItem>
                  <SelectItem value="want">Want</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="rounded" />
                <span className="text-sm">Recurring</span>
              </label>
            </div>
          </div>
          {recurring && (
            <div>
              <Label className="text-xs">Recurring Type</Label>
              <Select value={recurringType || "subscription"} onValueChange={setRecurringType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription">Subscription (fixed amount)</SelectItem>
                  <SelectItem value="recurring_bill">Recurring Bill (variable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!canSave || saving}
            onClick={() => onSave({ date, description: desc, amount, type, subcategory: subcat, needsWant: nw || null, isRecurring: recurring, recurringType: recurring ? (recurringType || "subscription") : null, notes })}
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CSV Upload Panel ──────────────────────────────────────────────────────────
function CsvUploadPanel({
  onImport,
  importing,
}: {
  onImport: (payload: { transactions: any[]; rejected: Record<string, number> }) => void;
  importing: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [colDate, setColDate] = useState("");
  const [colDesc, setColDesc] = useState("");
  const [colAmt, setColAmt] = useState("");
  const [colType, setColType] = useState("");
  const [negIsExpense, setNegIsExpense] = useState(true);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSVText(text);
      if (parsed.length < 2) return;
      const hdrs = parsed[0];
      const data = parsed.slice(1).filter(r => r.some(c => c));
      setHeaders(hdrs);
      setRows(data);
      setColDate(guessCol(hdrs, ["date", "posted", "trans date", "transaction date"]));
      setColDesc(guessCol(hdrs, ["description", "memo", "name", "payee", "merchant", "details", "narrative"]));
      setColAmt(guessCol(hdrs, ["amount", "debit", "credit", "value", "sum"]));
      setColType(guessCol(hdrs, ["type", "category", "transaction type"]));
    };
    reader.readAsText(file);
  }

  function buildImportPayload() {
    const dIdx = parseInt(colDate); const descIdx = parseInt(colDesc); const aIdx = parseInt(colAmt);
    const tIdx = colType !== "" ? parseInt(colType) : -1;
    const transactions: any[] = [];
    const rejected: Record<string, number> = {};
    const addRejected = (reason: string) => {
      rejected[reason] = (rejected[reason] ?? 0) + 1;
    };

    rows.forEach(r => {
      const dateStr = parseDate(r[dIdx] ?? "");
      const desc = r[descIdx]?.trim() ?? "";
      const rawAmt = parseFloat((r[aIdx] ?? "").replace(/[$,\s]/g, ""));
      const reasons: string[] = [];
      if (!dateStr) reasons.push("Missing or invalid date");
      if (!desc) reasons.push("Missing description");
      if (isNaN(rawAmt)) reasons.push("Missing or invalid amount");

      if (reasons.length > 0) {
        addRejected(reasons.join("; "));
        return;
      }

      let type: "income" | "expense";
      if (tIdx !== -1) {
        const tv = (r[tIdx] ?? "").toLowerCase();
        type = tv.includes("income") || tv.includes("credit") || tv.includes("deposit") ? "income" : "expense";
      } else {
        type = negIsExpense ? (rawAmt < 0 ? "expense" : "income") : (rawAmt > 0 ? "expense" : "income");
      }
      transactions.push({ date: dateStr, description: desc, amount: Math.abs(rawAmt), type });
    });

    return { transactions, rejected };
  }

  const preview = rows.slice(0, 5);
  const ready = colDate !== "" && colDesc !== "" && colAmt !== "" && rows.length > 0;

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Click to upload CSV / TSV / TXT</p>
        <p className="text-xs text-muted-foreground mt-1">Most bank export formats are supported. PDF not yet supported — download as CSV from your bank first.</p>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-600">{rows.length} rows detected — map columns below</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Date column", val: colDate, set: setColDate },
              { label: "Description column", val: colDesc, set: setColDesc },
              { label: "Amount column", val: colAmt, set: setColAmt },
              { label: "Type column (optional)", val: colType, set: setColType },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <Label className="text-xs">{label}</Label>
                <Select value={val} onValueChange={value => set(value === "none" ? "" : value)}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {colType === "" || label !== "Type column (optional)" ? null : null}
                    {label === "Type column (optional)" && <SelectItem value="none">— none —</SelectItem>}
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Col ${i + 1}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {colType === "" && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={negIsExpense} onChange={e => setNegIsExpense(e.target.checked)} className="rounded" />
              Negative amounts = expenses (standard bank format)
            </label>
          )}
          {preview.length > 0 && (
            <div className="overflow-x-auto rounded-lg border text-xs">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground">{h || `Col ${i+1}`}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((row, ri) => <tr key={ri} className="border-t">{row.map((c, ci) => <td key={ci} className="px-3 py-1.5 truncate max-w-[120px]">{c}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          )}
          <Button disabled={!ready || importing} onClick={() => onImport(buildImportPayload())} className="w-full">
            {importing ? "Importing…" : `Import ${rows.length} transactions`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Spending Insight Carousel ────────────────────────────────────────────────
function SpendingInsightCarousel({
  categoryData,
  categoryType,
  onCategoryTypeChange,
  insights,
  insightsLoading,
}: {
  categoryData: { name: string; value: number; key: string }[];
  categoryType: "income" | "expense";
  onCategoryTypeChange: (type: "income" | "expense") => void;
  insights: SpendingInsights | undefined;
  insightsLoading: boolean;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const slides = [
    { title: "By Category", icon: PieChartIcon },
    { title: "Subscriptions", icon: CreditCard },
    { title: "Need vs Want", icon: HeartHandshake },
  ];
  const subscriptionCount = Number(insights?.subscriptions.count ?? 0);
  const subscriptionTotal = Number(insights?.subscriptions.total ?? 0);
  const needsTotal = Number(insights?.needsWant.needs ?? 0);
  const wantsTotal = Number(insights?.needsWant.wants ?? 0);
  const unclassifiedTotal = Number(insights?.needsWant.unclassified ?? 0);
  const classifiedTotal = needsTotal + wantsTotal;
  const needsPercent = classifiedTotal ? (needsTotal / classifiedTotal) * 100 : 0;

  const goToSlide = (slide: number) => {
    setActiveSlide((slide + slides.length) % slides.length);
  };
  const goNext = () => goToSlide(activeSlide + 1);
  const goPrevious = () => goToSlide(activeSlide - 1);
  const handleTouchEnd = (x: number) => {
    if (touchStartX.current === null) return;
    const swipeDistance = x - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(swipeDistance) < 48) return;
    if (swipeDistance < 0) goNext();
    else goPrevious();
  };

  const ActiveIcon = slides[activeSlide].icon;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ActiveIcon className="h-4 w-4 text-violet-500" />
            {slides[activeSlide].title}
          </CardTitle>
          {activeSlide === 0 && (
            <div className="flex gap-1" aria-label="Category transaction type">
              {(["expense", "income"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => onCategoryTypeChange(type)}
                  aria-pressed={categoryType === type}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-all ${categoryType === type ? "bg-violet-600 text-white border-violet-600" : "border-slate-200 dark:border-slate-700 text-muted-foreground"}`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div
          className="touch-pan-y outline-none"
          role="group"
          aria-roledescription="carousel"
          aria-label="Spending insights"
          aria-live="polite"
          tabIndex={0}
          onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={event => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
          onTouchCancel={() => { touchStartX.current = null; }}
          onKeyDown={event => {
            if (event.key === "ArrowRight") { event.preventDefault(); goNext(); }
            if (event.key === "ArrowLeft") { event.preventDefault(); goPrevious(); }
          }}
        >
          {activeSlide === 0 && (
            categoryData.length === 0
              ? <div className="h-[244px] flex items-center justify-center text-muted-foreground text-sm">No {categoryType} data</div>
              : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={2}>
                        {categoryData.map(d => <Cell key={d.key} fill={CAT_COLORS[d.key] ?? "#94a3b8"} />)}
                      </Pie>
                      <Tooltip formatter={(value: any) => fmtFull(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2 max-h-36 overflow-y-auto pr-1">
                    {categoryData.map(d => (
                      <div key={d.key} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[d.key] ?? "#94a3b8" }} />
                          <span className="text-muted-foreground truncate">{d.name}</span>
                        </div>
                        <span className="font-medium tabular-nums ml-3">{fmt(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
          )}

          {activeSlide === 1 && (
            insightsLoading
              ? <div className="space-y-3 pt-1"><Skeleton className="h-16 w-full" /><Skeleton className="h-28 w-full" /></div>
              : subscriptionCount === 0
                ? <div className="h-[244px] flex flex-col items-center justify-center text-center px-5">
                    <CreditCard className="h-8 w-8 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-medium">No subscriptions identified</p>
                    <p className="text-xs text-muted-foreground mt-1">Mark a recurring transaction as a subscription to see it here.</p>
                  </div>
                : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Subscriptions</p>
                        <p className="mt-0.5 text-xl font-bold text-violet-700 dark:text-violet-300">{subscriptionCount}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Paid this period</p>
                        <p className="mt-0.5 text-xl font-bold tabular-nums">{fmt(subscriptionTotal)}</p>
                      </div>
                    </div>
                    <div className="max-h-[153px] overflow-y-auto rounded-lg border divide-y">
                      {insights?.subscriptions.items.map(item => (
                        <div key={item.name} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{item.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.charge_count} charge{Number(item.charge_count) === 1 ? "" : "s"} · {fmt(Number(item.total_paid))} paid
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold tabular-nums">{fmtFull(Number(item.latest_amount))}</p>
                            <p className="text-[10px] text-muted-foreground">latest charge</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
          )}

          {activeSlide === 2 && (
            insightsLoading
              ? <div className="space-y-3 pt-1"><Skeleton className="h-20 w-full" /><Skeleton className="h-24 w-full" /></div>
              : classifiedTotal === 0
                ? <div className="h-[244px] flex flex-col items-center justify-center text-center px-5">
                    <HeartHandshake className="h-8 w-8 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-medium">No classified spending</p>
                    <p className="text-xs text-muted-foreground mt-1">Tag expense transactions as Need or Want to see the breakdown.</p>
                  </div>
                : (
                  <div className="space-y-4 pt-1">
                    <p className="text-xs text-muted-foreground">Of your tagged expenses, here is where your spending went.</p>
                    <div className="h-4 rounded-full overflow-hidden bg-rose-100 dark:bg-rose-950/40 flex" aria-label={`${needsPercent.toFixed(0)}% needs and ${(100 - needsPercent).toFixed(0)}% wants`}>
                      <div className="bg-emerald-500 transition-all" style={{ width: `${needsPercent}%` }} />
                      <div className="bg-rose-500 transition-all" style={{ width: `${100 - needsPercent}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Needs
                        </div>
                        <p className="mt-1 text-xl font-bold tabular-nums">{fmt(needsTotal)}</p>
                        <p className="text-[11px] text-muted-foreground">{needsPercent.toFixed(0)}% of tagged spending</p>
                      </div>
                      <div className="rounded-lg border border-rose-100 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Wants
                        </div>
                        <p className="mt-1 text-xl font-bold tabular-nums">{fmt(wantsTotal)}</p>
                        <p className="text-[11px] text-muted-foreground">{(100 - needsPercent).toFixed(0)}% of tagged spending</p>
                      </div>
                    </div>
                    {unclassifiedTotal > 0 && (
                      <p className="text-[11px] text-muted-foreground text-center">{fmt(unclassifiedTotal)} in expenses is not tagged as Need or Want.</p>
                    )}
                  </div>
                )
          )}
        </div>

        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrevious} aria-label={`Show ${slides[(activeSlide + slides.length - 1) % slides.length].title}`}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5" aria-label={`Insight ${activeSlide + 1} of ${slides.length}`}>
            {slides.map((slide, index) => (
              <button
                key={slide.title}
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${index === activeSlide ? "w-5 bg-violet-600" : "w-2 bg-slate-300 dark:bg-slate-700"}`}
                aria-label={`Show ${slide.title}`}
                aria-current={index === activeSlide ? "true" : undefined}
              />
            ))}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext} aria-label={`Show ${slides[(activeSlide + 1) % slides.length].title}`}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FinanceTrackerPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dataIntakeOpen, setDataIntakeOpen] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [pendingMerchantUpdate, setPendingMerchantUpdate] = useState<PendingMerchantUpdate | null>(null);
  const [groupBy, setGroupBy] = useState("month");
  const [trendChartType, setTrendChartType] = useState<"bar" | "line">("bar");
  const [catChartType, setCatChartType] = useState<"income" | "expense">("expense");

  const { start, end } = getDateRange(period, customStart, customEnd);

  function buildQS(extra: Record<string, string> = {}) {
    const p: Record<string, string> = {};
    if (start) p.startDate = start;
    if (end) p.endDate = end;
    if (typeFilter !== "all") p.type = typeFilter;
    if (search) p.search = search;
    Object.assign(p, extra);
    return "?" + new URLSearchParams(p).toString();
  }

  const statsQK = ["/api/transactions/stats", start, end];
  const trendQK = ["/api/transactions/trend", start, end, groupBy];
  const catQK = ["/api/transactions/categories", start, end, catChartType];
  const insightsQK = ["/api/transactions/insights", start, end];
  const txnQK = ["/api/transactions", start, end, typeFilter, search];
  const insightParams = new URLSearchParams();
  if (start) insightParams.set("startDate", start);
  if (end) insightParams.set("endDate", end);

  const { data: stats, isLoading: statsL } = useQuery<Stats>({
    queryKey: statsQK,
    queryFn: () => apiRequest("GET", `/api/transactions/stats${buildQS()}`).then(r => r.json()).catch(() => null),
  });
  const { data: transactionsRaw, isLoading: txnL } = useQuery<Transaction[]>({
    queryKey: txnQK,
    queryFn: () => apiRequest("GET", `/api/transactions${buildQS()}`).then(r => r.json()).catch(() => []),
  });
  const transactions: Transaction[] = Array.isArray(transactionsRaw) ? transactionsRaw : [];
  const dateRangeLabel = period === "all"
    ? statsL
      ? "Loading…"
      : stats?.min_date && stats?.max_date
        ? `${fmtDate(stats.min_date)} – ${fmtDate(stats.max_date)}`
        : "No transactions yet"
    : start && end
      ? `${fmtDate(start)} – ${fmtDate(end)}`
      : "Select a start and end date";
  const { data: trendRaw } = useQuery<TrendRow[]>({
    queryKey: trendQK,
    queryFn: () => apiRequest("GET", `/api/transactions/trend${buildQS({ groupBy })}`).then(r => r.json()).catch(() => []),
  });
  const trendData: TrendRow[] = Array.isArray(trendRaw) ? trendRaw : [];

  const { data: catRaw } = useQuery<CatRow[]>({
    queryKey: catQK,
    queryFn: () => apiRequest("GET", `/api/transactions/categories${buildQS({ type: catChartType })}`).then(r => r.json()).catch(() => []),
  });
  const catData: CatRow[] = Array.isArray(catRaw) ? catRaw : [];
  const { data: insights, isLoading: insightsLoading } = useQuery<SpendingInsights>({
    queryKey: insightsQK,
    queryFn: () => apiRequest("GET", `/api/transactions/insights?${insightParams.toString()}`).then(r => r.json()).catch(() => undefined),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions/trend"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions/categories"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions/insights"] });
  }

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/transactions", data),
    onSuccess: () => { invalidateAll(); setAddOpen(false); setDataIntakeOpen(false); toast({ title: "Transaction added" }); },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/transactions/${id}`, data).then(response => response.json()),
    onSuccess: (result: { updatedCount?: number }) => {
      invalidateAll();
      setEditTxn(null);
      setPendingMerchantUpdate(null);
      const updatedCount = Number(result?.updatedCount ?? 1);
      toast({
        title: updatedCount > 1 ? `${updatedCount} transactions updated` : "Transaction updated",
        description: updatedCount > 1 ? "Category and recurring settings were applied to this merchant." : undefined,
      });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transactions/${id}`),
    onSuccess: () => { invalidateAll(); toast({ title: "Deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });
  const bulkMut = useMutation({
    mutationFn: (payload: { transactions: any[]; rejected: Record<string, number> }) =>
      apiRequest("POST", "/api/transactions/bulk", payload),
    onSuccess: (res: any) => res.json().then((d: any) => {
      const importResult: ImportResult = {
        inserted: Number(d.inserted ?? 0),
        skipped: Number(d.skipped ?? 0),
        skippedReasons: d.skippedReasons ?? {},
      };
      invalidateAll();
      setPeriod("all");
      setCustomStart("");
      setCustomEnd("");
      setPage(1);
      setDataIntakeOpen(false);
      setLastImportResult(importResult);
      toast({
        title: "CSV upload complete",
        description: [
          `${importResult.inserted} uploaded · ${importResult.skipped} not uploaded.`,
          "Showing All Time so uploaded dates are visible.",
          d.recurringMarked ? `${d.recurringMarked} marked as recurring` : "",
        ].filter(Boolean).join(" "),
      });
    }),
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });
  const recurringMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/transactions/detect-recurring"),
    onSuccess: (res: any) => res.json().then((d: any) => {
      invalidateAll();
      toast({ title: `Recurring detection complete`, description: `${d.updated} transactions flagged` });
    }),
  });

  const income = parseFloat(stats?.total_income ?? "0");
  const expenses = parseFloat(stats?.total_expenses ?? "0");
  const netFlow = income - expenses;
  const unassigned = parseInt(stats?.unassigned_count ?? "0");

  const trendChart = trendData.map(r => ({
    period: fmtPeriod(r.period, groupBy),
    Income: parseFloat(r.income),
    Expenses: parseFloat(r.expenses),
  }));

  const donutData = catData
    .filter(r => parseFloat(r.total) > 0)
    .map(r => ({ name: catLabel(r.subcategory), value: parseFloat(r.total), key: r.subcategory }));

  const sortedTransactions = useMemo(() => {
    const sortValue = (transaction: Transaction): string | number => {
      switch (sortKey) {
        case "amount":
          return parseFloat(transaction.amount) || 0;
        case "category":
          return catLabel(transaction.subcategory).toLocaleLowerCase();
        case "needsWant":
          return transaction.needs_want && transaction.needs_want !== "na" ? transaction.needs_want : "";
        case "recurring":
          return transaction.is_recurring ? 1 : 0;
        case "description":
          return transaction.description.toLocaleLowerCase();
        case "type":
          return transaction.type;
        case "date":
        default:
          return transaction.date.slice(0, 10);
      }
    };

    return [...transactions].sort((a, b) => {
      const aValue = sortValue(a);
      const bValue = sortValue(b);
      const aEmpty = aValue === "";
      const bEmpty = bValue === "";
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return 0;
        return aEmpty ? 1 : -1;
      }

      const comparison = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [transactions, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    setPage(1);
    if (key === sortKey) {
      setSortDirection(direction => direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function handleEditSave(data: Record<string, any>) {
    if (!editTxn) return;

    const changedFields: MerchantUpdateField[] = [];
    const typeOnlyCategoryReset = data.type !== editTxn.type && data.subcategory === "unassigned";
    if (data.subcategory !== editTxn.subcategory && !typeOnlyCategoryReset) changedFields.push("subcategory");
    if ((data.needsWant ?? null) !== (editTxn.needs_want ?? null)) changedFields.push("needsWant");

    const recurringChanged = data.isRecurring !== editTxn.is_recurring
      || (data.isRecurring && (data.recurringType ?? null) !== (editTxn.recurring_type ?? null));
    if (recurringChanged) changedFields.push("recurring");

    if (changedFields.length === 0) {
      updateMut.mutate({ id: editTxn.id, ...data });
      return;
    }

    setPendingMerchantUpdate({
      id: editTxn.id,
      merchantName: editTxn.merchant || editTxn.description,
      changedFields,
      data,
    });
    setEditTxn(null);
  }

  function submitMerchantUpdate(applyToMerchant: boolean) {
    if (!pendingMerchantUpdate) return;
    updateMut.mutate({
      id: pendingMerchantUpdate.id,
      ...pendingMerchantUpdate.data,
      ...(applyToMerchant
        ? { applyToMerchant: true, merchantFields: pendingMerchantUpdate.changedFields }
        : {}),
    });
  }

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const pageTxns = sortedTransactions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 page-header-gradient">
        <div>
          <h1 className="text-2xl font-bold">Finance Tracker</h1>
          <p className="text-muted-foreground text-sm">Track, categorize and analyze your income &amp; expenses</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => recurringMut.mutate()} disabled={recurringMut.isPending}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Detect Recurring
          </Button>
          <Button size="sm" onClick={() => setDataIntakeOpen(value => !value)}>
            {dataIntakeOpen ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            {dataIntakeOpen ? "Close Add Transactions" : "Add Transaction"}
          </Button>
        </div>
      </div>

      {/* ── Data Intake ── */}
      {dataIntakeOpen && (
        <Card className="border-blue-200 dark:border-blue-900/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" />Add Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual">
              <TabsList className="grid grid-cols-3 w-full max-w-xl">
                <TabsTrigger value="manual"><Plus className="h-3.5 w-3.5 mr-1.5" />Manual</TabsTrigger>
                <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1.5" />Upload CSV</TabsTrigger>
                <TabsTrigger value="import"><Landmark className="h-3.5 w-3.5 mr-1.5" />Connected</TabsTrigger>
              </TabsList>
              <TabsContent value="manual" className="mt-4">
                <p className="text-sm text-muted-foreground mb-3">Enter one transaction manually with the full transaction form.</p>
                <Button onClick={() => setAddOpen(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />Open Manual Entry Form
                </Button>
              </TabsContent>
              <TabsContent value="upload" className="mt-4">
                <CsvUploadPanel onImport={payload => bulkMut.mutate(payload)} importing={bulkMut.isPending} />
              </TabsContent>
              <TabsContent value="import" className="mt-4">
                <ConnectedAccountsImportPanel onImported={invalidateAll} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      {lastImportResult && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20" role="status">
          <div className="flex items-start gap-2.5">
            <Upload className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">CSV upload complete</p>
              <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">
                <strong>{lastImportResult.inserted}</strong> uploaded · <strong>{lastImportResult.skipped}</strong> not uploaded
              </p>
              {lastImportResult.skipped > 0 && (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  Not uploaded: {Object.entries(lastImportResult.skippedReasons)
                    .filter(([, count]) => count > 0)
                    .map(([reason, count]) => `${count} ${reason.toLowerCase()}`)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700 hover:text-emerald-900 dark:text-emerald-400" onClick={() => setLastImportResult(null)}>
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss upload summary</span>
          </Button>
        </div>
      )}

      {/* ── Period Selector ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {PERIOD_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => { setPeriod(o.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${period === o.value
              ? "bg-blue-600 text-white border-blue-600"
              : "border-slate-200 dark:border-slate-700 hover:border-blue-400 text-muted-foreground"}`}
          >
            {o.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 text-xs" />
            <span className="text-muted-foreground text-xs">→</span>
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
        <span>
          Showing transactions from <span className="font-medium text-foreground">{dateRangeLabel}</span>
        </span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Income", value: income, icon: ArrowUpCircle, color: "emerald", fmt: fmt },
          { label: "Total Expenses", value: expenses, icon: ArrowDownCircle, color: "red", fmt: fmt },
          { label: "Net Cash Flow", value: netFlow, icon: netFlow >= 0 ? TrendingUp : TrendingDown, color: netFlow >= 0 ? "emerald" : "red", fmt: fmt },
        ].map(({ label, value, icon: Icon, color, fmt: f }) => (
          <Card key={label} className={`border-t-4 ${color === "emerald" ? "border-t-emerald-500" : "border-t-red-500"}`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                  {statsL
                    ? <Skeleton className="h-9 w-32 mt-1" />
                    : <p className={`text-3xl font-bold mt-1 ${color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {label === "Net Cash Flow" && value > 0 ? "+" : ""}{f(value)}
                      </p>}
                  <p className="text-xs text-muted-foreground mt-1">{stats?.total_count ?? "—"} transactions</p>
                </div>
                <div className={`p-2.5 rounded-xl ${color === "emerald" ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/40"}`}>
                  <Icon className={`h-5 w-5 ${color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Unassigned Alert ── */}
      {unassigned > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>{unassigned} transaction{unassigned !== 1 ? "s" : ""}</strong> couldn't be auto-categorized.
            Filter by "Unassigned" to review and categorize them.
          </p>
        </div>
      )}

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />Income vs Expenses Trend
              </CardTitle>
              <div className="flex items-center gap-2.5 flex-wrap justify-end">
                <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 p-1">
                  <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Chart type</span>
                  <div className="flex gap-1" aria-label="Chart type">
                    {(["bar", "line"] as const).map(chartType => (
                      <button key={chartType} onClick={() => setTrendChartType(chartType)}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-all ${trendChartType === chartType ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 dark:border-slate-700 text-muted-foreground"}`}>
                        {chartType === "bar" ? "Bars" : "Line"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 p-1">
                  <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Time granularity</span>
                  <div className="flex gap-1" aria-label="Time granularity">
                    {["day","week","month","year"].map(g => (
                      <button key={g} onClick={() => setGroupBy(g)}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-all ${groupBy===g?"bg-blue-600 text-white border-blue-600":"border-slate-200 dark:border-slate-700 text-muted-foreground"}`}>
                        {g.charAt(0).toUpperCase()+g.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendChart.length === 0
              ? <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">No trend data for this period</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={trendChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => fmtFull(v)} />
                    <Legend />
                    {trendChartType === "bar" ? (
                      <>
                        <Bar dataKey="Income" fill="#22c55e" radius={[3,3,0,0]} maxBarSize={40} />
                        <Bar dataKey="Expenses" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={40} />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="Income" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
          </CardContent>
        </Card>

        <SpendingInsightCarousel
          categoryData={donutData}
          categoryType={catChartType}
          onCategoryTypeChange={setCatChartType}
          insights={insights}
          insightsLoading={insightsLoading}
        />
      </div>

      {/* ── Transaction Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-slate-500" />Transactions
              <Badge variant="secondary">{transactions.length}</Badge>
              {unassigned > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200">{unassigned} unassigned</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Page size */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={value => { setPageSize(Number(value)); setPage(1); }}
                >
                  <SelectTrigger className="h-8 w-[76px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Type filter */}
              <div className="flex rounded-lg border overflow-hidden text-xs">
                {[["all","All"],["income","Income"],["expense","Expense"]].map(([v,l]) => (
                  <button key={v} onClick={() => { setTypeFilter(v); setPage(1); }}
                    className={`px-3 py-1.5 transition-all ${typeFilter===v?"bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900":"hover:bg-muted"}`}>
                    {l}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="pl-8 h-8 w-44 text-xs" />
                {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {txnL
            ? <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            : pageTxns.length === 0
              ? <div className="p-10 text-center text-muted-foreground text-sm">No transactions found. Add one above or upload a CSV file.</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        {TRANSACTION_COLUMNS.map(column => (
                          <th
                            key={column.key}
                            aria-sort={sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                            className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                          >
                            <button
                              type="button"
                              onClick={() => handleSort(column.key)}
                              className={`inline-flex items-center gap-1 rounded hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${sortKey === column.key ? "text-foreground" : ""}`}
                              title={`Sort by ${column.label}`}
                            >
                              {column.label}
                              {sortKey === column.key
                                ? sortDirection === "asc"
                                  ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
                                  : <ArrowDown className="h-3 w-3" aria-hidden="true" />
                                : <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />}
                            </button>
                          </th>
                        ))}
                        <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pageTxns.map(t => (
                        <tr key={t.id} className={`hover:bg-muted/30 transition-colors ${t.subcategory === "unassigned" ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(t.date)}</td>
                          <td className="px-3 py-2.5 max-w-[180px]">
                            <p className="truncate font-medium text-xs">{t.description}</p>
                            {t.source !== "manual" && (
                              <span className="text-[10px] text-muted-foreground">
                                {t.source === "import"
                                  ? `Import · ${t.type === "income" ? "Income entry" : "Expense entry"}`
                                  : t.source === "plaid"
                                    ? ["Plaid", t.plaid_institution_name, t.plaid_account_name].filter(Boolean).join(" · ")
                                    : t.source}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge className={`text-[10px] ${t.type === "income" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                              {t.type === "income" ? "Income" : "Expense"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLORS[t.subcategory] ?? "#94a3b8" }} />
                              <span className={`text-xs ${t.subcategory === "unassigned" ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>{catLabel(t.subcategory)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {t.needs_want && t.needs_want !== "na"
                              ? <Badge variant="outline" className={`text-[10px] ${t.needs_want === "need" ? "border-blue-300 text-blue-600" : "border-orange-300 text-orange-600"}`}>{t.needs_want === "need" ? "Need" : "Want"}</Badge>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className={`px-3 py-2.5 font-semibold tabular-nums text-xs whitespace-nowrap ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                            {t.type === "income" ? "+" : "-"}{fmtFull(parseFloat(t.amount))}
                          </td>
                          <td className="px-3 py-2.5">
                            {t.is_recurring
                              ? <div className="flex items-center gap-1">
                                  <Repeat2 className="h-3.5 w-3.5 text-violet-500" />
                                  <span className="text-[10px] text-violet-600 dark:text-violet-400">{t.recurring_type === "subscription" ? "Sub" : "Bill"}</span>
                                </div>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTxn(t)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteMut.mutate(t.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {transactions.length} total · {pageSize} per page</span>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ── key forces full remount so state always resets to defaults/initial */}
      <TransactionDialog
        key={addOpen ? "add-open" : "add-closed"}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={data => createMut.mutate(data)}
        saving={createMut.isPending}
      />
      {editTxn && (
        <TransactionDialog
          key={`edit-${editTxn.id}`}
          open={!!editTxn}
          onOpenChange={v => { if (!v) setEditTxn(null); }}
          initial={editTxn}
          onSave={handleEditSave}
          saving={updateMut.isPending}
        />
      )}
      <Dialog
        open={!!pendingMerchantUpdate}
        onOpenChange={open => { if (!open && !updateMut.isPending) setPendingMerchantUpdate(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply this change to other transactions?</DialogTitle>
            <DialogDescription>
              You changed {pendingMerchantUpdate?.changedFields
                .map(field => field === "subcategory" ? "Category" : field === "needsWant" ? "Need / Want" : "Recurring settings")
                .join(", ")} for <span className="font-medium text-foreground">{pendingMerchantUpdate?.merchantName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            Choose whether to update only this transaction or every matching transaction for this merchant. Amounts, dates, notes, and account details will not be changed on the other transactions.
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => submitMerchantUpdate(false)}
              disabled={updateMut.isPending}
            >
              Only this transaction
            </Button>
            <Button
              onClick={() => submitMerchantUpdate(true)}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? "Updating…" : "All merchant transactions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
