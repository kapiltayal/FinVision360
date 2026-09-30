import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

      <div className="max-h-[55vh] overflow-auto overscroll-contain rounded-lg border" aria-label="Editable file preview">
        <table className={`w-full text-left text-xs ${kind === "liability" ? "min-w-[1280px]" : "min-w-[1000px]"}`}>
          <caption className="sr-only">Editable preview of {entries.length} {kind} entries from {fileName}</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th scope="col" className="sticky left-0 z-20 w-12 min-w-12 border-b bg-muted px-2 py-2 text-center font-medium">#</th>
              <th scope="col" className="min-w-40 border-b px-2 py-2 font-medium">Name *</th>
              <th scope="col" className="min-w-48 border-b px-2 py-2 font-medium">Category *</th>
              <th scope="col" className="min-w-28 border-b px-2 py-2 font-medium">{kind === "asset" ? "Value *" : "Balance *"}</th>
              <th scope="col" className="min-w-28 border-b px-2 py-2 font-medium">Rate (%)</th>
              {kind === "liability" && (
                <>
                  <th scope="col" className="min-w-28 border-b px-2 py-2 font-medium">Min. payment</th>
                  <th scope="col" className="min-w-36 border-b px-2 py-2 font-medium">Maturity date</th>
                </>
              )}
              <th scope="col" className="min-w-36 border-b px-2 py-2 font-medium">Institution</th>
              <th scope="col" className="min-w-40 border-b px-2 py-2 font-medium">Notes</th>
              <th scope="col" className="sticky right-0 z-20 w-10 min-w-10 border-b bg-muted px-1 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
        {entries.map((entry, index) => {
          const error = errors[index];
          const input = (field: ReviewField, placeholder = "", inputMode?: "decimal") => (
            <td className="border-b px-2 py-1.5 align-top">
              <Input
                id={`review-${entry.id}-${field}`}
                aria-label={`${entry.name || `Entry ${index + 1}`} ${field === amountField ? kind === "asset" ? "value" : "balance" : field}`}
                value={entry[field]}
                onChange={(event) => onChange(entry.id, field, event.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
                aria-invalid={!!error[field]}
                className={`h-8 px-2 text-xs ${error[field] ? "border-destructive" : ""}`}
              />
              {error[field] && <p className="mt-1 max-w-40 text-[10px] leading-tight text-destructive">{error[field]}</p>}
            </td>
          );
          return (
            <tr key={entry.id} data-testid={`review-row-${entry.id}`} className={error && Object.keys(error).length ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}>
              <th scope="row" className="sticky left-0 z-[1] border-b bg-background px-2 py-1.5 text-center font-normal">
                <span className="block text-muted-foreground">{index + 1}</span>
                {error && Object.keys(error).length > 0 && <AlertCircle className="mx-auto mt-1 h-3.5 w-3.5 text-amber-600" aria-label="Needs review" />}
              </th>
              {input("name", "Account name")}
              <td className="border-b px-2 py-1.5 align-top">
                <select
                  id={`review-${entry.id}-category`}
                  value={entry.category}
                  onChange={(event) => onChange(entry.id, "category", event.target.value)}
                  aria-label={`${entry.name || `Entry ${index + 1}`} category`}
                  aria-invalid={!!error.category}
                  className={`h-8 w-full min-w-44 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring ${error.category ? "border-destructive" : "border-input"}`}
                >
                  <option value="">Choose category</option>
                  {categories.map((item) => <option key={item.category} value={item.category}>{item.parentCategory} · {item.category}</option>)}
                </select>
                {entry.sourceCategory && entry.sourceCategory !== entry.category && (
                  <p className="mt-1 max-w-48 truncate text-[10px] text-muted-foreground" title={`File category: ${entry.sourceCategory}`}>
                    File: {entry.sourceCategory}
                  </p>
                )}
                {error.category && <p className="mt-1 text-[10px] leading-tight text-destructive">{error.category}</p>}
              </td>
              {input(amountField, "0.00", "decimal")}
              {input("interestRate", "0.00", "decimal")}
              {kind === "liability" && (
                <>
                  {input("minimumPayment", "0.00", "decimal")}
                  {input("maturityDate", "YYYY-MM-DD")}
                </>
              )}
              {input("institution", "Institution")}
              {input("notes", "Notes")}
              <td className="sticky right-0 border-b bg-background px-1 py-1.5 align-top">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  aria-label={`Remove entry ${index + 1}`}
                  title="Remove entry"
                  onClick={() => onRemove(entry.id)}
                  disabled={saving}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          );
        })}
          </tbody>
        </table>
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