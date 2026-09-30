import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BookEntryKind } from "./book-entry-import";

export type PreviewEntry = {
  name: string;
  category: string;
  sourceCategory: string;
  value: string;
  balance: string;
  interestRate: string;
  minimumPayment: string;
  maturityDate: string;
  institution: string;
  notes: string;
};

export type ReviewEntry = PreviewEntry & { id: number };
export type ReviewField = Exclude<keyof PreviewEntry, "sourceCategory">;
export type ReviewCategory = { category: string; parentCategory: string };

function rowErrors(entry: ReviewEntry, kind: BookEntryKind, categories: ReviewCategory[]): Partial<Record<ReviewField, string>> {
  const errors: Partial<Record<ReviewField, string>> = {};
  const amountField = kind === "asset" ? "value" : "balance";
  if (!entry.name.trim()) errors.name = "Name is required.";
  if (!categories.some((item) => item.category === entry.category)) errors.category = "Choose a category.";
  const amount = entry[amountField].trim();
  if (!amount || !Number.isFinite(Number(amount)) || (kind === "asset" && Number(amount) < 0)) {
    errors[amountField] = `Enter a valid ${kind === "asset" ? "value" : "balance"}.`;
  }
  if (entry.interestRate.trim() && (!Number.isFinite(Number(entry.interestRate)) || Number(entry.interestRate) < 0)) {
    errors.interestRate = "Enter a non-negative number.";
  }
  if (kind === "liability") {
    if (entry.minimumPayment.trim() && (!Number.isFinite(Number(entry.minimumPayment)) || Number(entry.minimumPayment) < 0)) {
      errors.minimumPayment = "Enter a non-negative number.";
    }
    if (entry.maturityDate.trim()) {
      const date = entry.maturityDate.trim();
      const parsed = new Date(`${date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        errors.maturityDate = "Use a valid date in YYYY-MM-DD format.";
      }
    }
  }
  return errors;
}

export function BookEntryFileReview({
  kind, fileName, entries, ignoredBlankRows, categories, categoriesLoading, categoriesError, saving,
  onChange, onRemove, onDiscard, onSave,
}: {
  kind: BookEntryKind;
  fileName: string;
  entries: ReviewEntry[];
  ignoredBlankRows: number;
  categories: ReviewCategory[];
  categoriesLoading: boolean;
  categoriesError: boolean;
  saving: boolean;
  onChange: (id: number, field: ReviewField, value: string) => void;
  onRemove: (id: number) => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const errors = entries.map((entry) => rowErrors(entry, kind, categories));
  const invalidCount = errors.filter((item) => Object.keys(item).length > 0).length;
  const amountField = kind === "asset" ? "value" : "balance";

  return (
    <div className="space-y-4" data-testid="book-file-review">
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-sm font-semibold">Step 2 of 2 · Review {entries.length} {entries.length === 1 ? kind : kind === "liability" ? "liabilities" : "assets"}</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">{fileName}</p>
        <p className="mt-1 text-xs text-muted-foreground">Nothing has been saved yet. Correct any fields below, remove unwanted rows, then save.</p>
        {ignoredBlankRows > 0 && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{ignoredBlankRows} completely blank {ignoredBlankRows === 1 ? "row was" : "rows were"} excluded. Blank lines in text files are also ignored.</p>}
      </div>

      {categoriesError && <p className="text-sm text-destructive">Categories could not be loaded. Please try again before saving.</p>}
      {categoriesLoading && <p className="text-sm text-muted-foreground">Loading categories…</p>}
      {!categoriesLoading && invalidCount > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-300" role="status">
          <AlertCircle className="h-4 w-4" /> {invalidCount} {invalidCount === 1 ? "entry needs" : "entries need"} attention before saving.
        </p>
      )}

      <div className="max-h-[55vh] space-y-3 overflow-y-auto overscroll-contain pr-1" aria-label="Editable file preview">
        {entries.map((entry, index) => {
          const error = errors[index];
          const input = (field: ReviewField, label: string, placeholder = "", inputMode?: "decimal") => (
            <div className="space-y-1">
              <label htmlFor={`review-${entry.id}-${field}`} className="text-xs font-medium">{label}</label>
              <Input
                id={`review-${entry.id}-${field}`}
                value={entry[field]}
                onChange={(event) => onChange(entry.id, field, event.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
                aria-invalid={!!error[field]}
                className={error[field] ? "border-destructive" : ""}
              />
              {error[field] && <p className="text-xs text-destructive">{error[field]}</p>}
            </div>
          );
          return (
            <div key={entry.id} className="rounded-lg border bg-card" data-testid={`review-row-${entry.id}`}>
              <div className="px-3 py-3 text-sm">
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{index + 1}. {entry.name || "Unnamed entry"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {error && Object.keys(error).length ? "Needs review" : entry[amountField] || "No amount"}
                  </span>
                </span>
              </div>
              <div className="space-y-3 border-t p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {input("name", "Name *", "Account name")}
                  <div className="space-y-1">
                    <label htmlFor={`review-${entry.id}-category`} className="text-xs font-medium">Category *</label>
                    <select
                      id={`review-${entry.id}-category`}
                      value={entry.category}
                      onChange={(event) => onChange(entry.id, "category", event.target.value)}
                      aria-invalid={!!error.category}
                      className={`flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${error.category ? "border-destructive" : "border-input"}`}
                    >
                      <option value="">Choose category</option>
                      {categories.map((item) => <option key={item.category} value={item.category}>{item.parentCategory} · {item.category}</option>)}
                    </select>
                    {entry.sourceCategory && entry.sourceCategory !== entry.category && (
                      <p className="text-xs text-muted-foreground">File category: {entry.sourceCategory}. Check the suggested category before saving.</p>
                    )}
                    {error.category && <p className="text-xs text-destructive">{error.category}</p>}
                  </div>
                  {input(amountField, kind === "asset" ? "Value *" : "Balance *", "0.00", "decimal")}
                  {input("interestRate", "Interest rate (%)", "0.00", "decimal")}
                  {kind === "liability" && (
                    <>
                      {input("minimumPayment", "Minimum payment", "0.00", "decimal")}
                      {input("maturityDate", "Maturity date", "YYYY-MM-DD")}
                    </>
                  )}
                  {input("institution", "Institution", "Optional")}
                </div>
                <div className="space-y-1">
                  <label htmlFor={`review-${entry.id}-notes`} className="text-xs font-medium">Notes</label>
                  <Textarea
                    id={`review-${entry.id}-notes`}
                    value={entry.notes}
                    onChange={(event) => onChange(entry.id, "notes", event.target.value)}
                    rows={2}
                    placeholder="Optional"
                  />
                </div>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onRemove(entry.id)} disabled={saving}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove entry
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {!entries.length && <p className="text-sm text-muted-foreground">No entries remain. Choose another file to continue.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>Discard review & choose another file</Button>
        <Button type="button" onClick={onSave} disabled={saving || categoriesLoading || categoriesError || !categories.length || !entries.length || invalidCount > 0} data-testid="button-save-reviewed-file">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : `Save ${entries.length} ${entries.length === 1 ? kind : kind === "liability" ? "liabilities" : "assets"}`}
        </Button>
      </div>
    </div>
  );
}