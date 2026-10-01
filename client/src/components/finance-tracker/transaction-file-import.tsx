import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  TransactionImportEntry,
  TransactionImportPreview,
  TransactionImportResult,
} from "@shared/transaction-import";
import {
  createBlankTransactionImportEntry,
  validateTransactionImportEntry,
  type TransactionImportCategory,
  type TransactionImportReviewField,
} from "./transaction-file-import-validation";

type CanonicalCategory = TransactionImportCategory;
type ReviewField = TransactionImportReviewField;

function TransactionFileReview({
  fileName,
  entries,
  ignoredBlankRows,
  categories,
  categoriesLoading,
  categoriesError,
  saving,
  onChange,
  onAdd,
  onRemove,
  onDiscard,
  onSave,
}: {
  fileName: string;
  entries: TransactionImportEntry[];
  ignoredBlankRows: number;
  categories: CanonicalCategory[];
  categoriesLoading: boolean;
  categoriesError: boolean;
  saving: boolean;
  onChange: (id: number, field: ReviewField, value: string | boolean) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const errors = entries.map(entry => validateTransactionImportEntry(entry, categories));
  const invalidCount = errors.filter(error => Object.keys(error).length > 0).length;
  const allCategories = categories;

  return (
    <div className="space-y-4" data-testid="transaction-file-review">
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-sm font-semibold">Step 2 of 2 · Review {entries.length} transaction{entries.length === 1 ? "" : "s"}</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">{fileName}</p>
        <p className="mt-1 text-xs text-muted-foreground">Nothing has been saved yet. Complete any missing required fields, edit suggestions, remove unwanted rows, then save.</p>
        {ignoredBlankRows > 0 && (
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            {ignoredBlankRows} completely blank {ignoredBlankRows === 1 ? "row was" : "rows were"} excluded.
          </p>
        )}
      </div>

      {categoriesError && <p className="text-sm text-destructive">Categories could not be loaded. Please try again before saving.</p>}
      {categoriesLoading && <p className="text-sm text-muted-foreground">Loading categories…</p>}
      {!categoriesLoading && invalidCount > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-300" role="status">
          <AlertCircle className="h-4 w-4" /> {invalidCount} {invalidCount === 1 ? "entry needs" : "entries need"} attention before saving.
        </p>
      )}

      <div className="max-h-[55vh] overflow-auto overscroll-contain rounded-lg border" aria-label="Editable transaction preview">
        <table className="w-full min-w-[1720px] text-left text-xs">
          <caption className="sr-only">Editable preview of transactions from {fileName}</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th scope="col" className="sticky left-0 z-20 w-12 min-w-12 border-b bg-muted px-2 py-2 text-center font-medium">#</th>
              <th scope="col" className="min-w-36 border-b px-2 py-2 font-medium">Date *</th>
              <th scope="col" className="min-w-48 border-b px-2 py-2 font-medium">Description *</th>
              <th scope="col" className="min-w-36 border-b px-2 py-2 font-medium">Merchant</th>
              <th scope="col" className="min-w-28 border-b px-2 py-2 font-medium">Amount *</th>
              <th scope="col" className="min-w-28 border-b px-2 py-2 font-medium">Type *</th>
              <th scope="col" className="min-w-56 border-b px-2 py-2 font-medium">Category</th>
              <th scope="col" className="min-w-28 border-b px-2 py-2 font-medium">Need / Want</th>
              <th scope="col" className="min-w-28 border-b px-2 py-2 font-medium">Recurring</th>
              <th scope="col" className="min-w-40 border-b px-2 py-2 font-medium">Recurring type</th>
              <th scope="col" className="min-w-40 border-b px-2 py-2 font-medium">Notes</th>
              <th scope="col" className="min-w-36 border-b px-2 py-2 font-medium">Source category</th>
              <th scope="col" className="sticky right-0 z-20 w-10 min-w-10 border-b bg-muted px-1 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const error = errors[index];
              const matchingCategories = allCategories.filter(item => item.type.toLowerCase() === entry.type);
              const selectedCategory = matchingCategories.find(item => item.category === entry.subcategory);
              const categoryError = error.subcategory;
              const input = (field: "date" | "description" | "merchant" | "amount" | "notes", placeholder = "") => (
                <td className="border-b px-2 py-1.5 align-top">
                  <Input
                    type="text"
                    inputMode={field === "date" ? "text" : field === "amount" ? "decimal" : undefined}
                    value={entry[field]}
                    onChange={event => onChange(entry.id, field, event.target.value)}
                    placeholder={placeholder}
                    aria-label={`Transaction ${index + 1} ${field}`}
                    aria-invalid={!!error[field]}
                    disabled={saving}
                    className={`h-8 px-2 text-xs ${error[field] ? "border-destructive" : ""}`}
                  />
                  {error[field] && <p className="mt-1 max-w-40 text-[10px] leading-tight text-destructive">{error[field]}</p>}
                </td>
              );
              return (
                <tr key={entry.id} className={Object.keys(error).length ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}>
                  <th scope="row" className="sticky left-0 z-[1] border-b bg-background px-2 py-1.5 text-center font-normal">
                    <span className="block text-muted-foreground">{index + 1}</span>
                    {Object.keys(error).length > 0 && <AlertCircle className="mx-auto mt-1 h-3.5 w-3.5 text-amber-600" aria-label="Needs review" />}
                  </th>
                  {input("date", "YYYY-MM-DD")}
                  {input("description", "Description")}
                  {input("merchant", "Merchant")}
                  {input("amount", "0.00")}
                  <td className="border-b px-2 py-1.5 align-top">
                    <select
                      value={entry.type}
                      onChange={event => onChange(entry.id, "type", event.target.value)}
                      aria-label={`Transaction ${index + 1} type`}
                      disabled={saving}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                    {error.type && <p className="mt-1 text-[10px] leading-tight text-destructive">{error.type}</p>}
                  </td>
                  <td className="border-b px-2 py-1.5 align-top">
                    <select
                      value={entry.subcategory}
                      onChange={event => onChange(entry.id, "subcategory", event.target.value)}
                      aria-label={`Transaction ${index + 1} category`}
                      aria-invalid={!!categoryError}
                      disabled={saving}
                      className={`h-8 w-full min-w-52 rounded-md border bg-background px-2 text-xs ${categoryError ? "border-destructive" : "border-input"}`}
                    >
                      <option value="">Unassigned (optional)</option>
                      {matchingCategories.map(category => (
                        <option key={`${category.parentCategory}-${category.category}`} value={category.category}>
                          {category.parentCategory} · {category.category}
                        </option>
                      ))}
                    </select>
                    {selectedCategory && (
                      <p className="mt-1 max-w-56 truncate text-[10px] text-muted-foreground" title={`Parent category: ${selectedCategory.parentCategory}`}>
                        Parent: {selectedCategory.parentCategory}
                      </p>
                    )}
                    {categoryError && <p className="mt-1 text-[10px] leading-tight text-destructive">{categoryError}</p>}
                  </td>
                  <td className="border-b px-2 py-1.5 align-top">
                    <select
                      value={entry.needsWant}
                      onChange={event => onChange(entry.id, "needsWant", event.target.value)}
                      aria-label={`Transaction ${index + 1} need or want`}
                      disabled={saving}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="na">N/A</option>
                      <option value="need">Need</option>
                      <option value="want">Want</option>
                    </select>
                    {error.needsWant && <p className="mt-1 text-[10px] text-destructive">{error.needsWant}</p>}
                  </td>
                  <td className="border-b px-2 py-1.5 align-top">
                    <label className="flex h-8 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={entry.isRecurring}
                        onChange={event => onChange(entry.id, "isRecurring", event.target.checked)}
                        aria-label={`Transaction ${index + 1} recurring`}
                        disabled={saving}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span>{entry.isRecurring ? "Yes" : "No"}</span>
                    </label>
                  </td>
                  <td className="border-b px-2 py-1.5 align-top">
                    <select
                      value={entry.recurringType}
                      onChange={event => onChange(entry.id, "recurringType", event.target.value)}
                      aria-label={`Transaction ${index + 1} recurring type`}
                      disabled={saving || !entry.isRecurring}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"
                    >
                      <option value="">Choose type</option>
                      <option value="subscription">Subscription</option>
                      <option value="recurring_bill">Recurring bill</option>
                    </select>
                    {error.recurringType && <p className="mt-1 text-[10px] text-destructive">{error.recurringType}</p>}
                  </td>
                  {input("notes", "Notes")}
                  <td className="border-b px-2 py-1.5 align-top">
                    {((entry.sourceCategory && entry.sourceCategory !== entry.subcategory)
                      || (entry.subcategory && !selectedCategory)) ? (
                      <span
                        className="block max-w-36 truncate text-xs text-muted-foreground"
                        title={entry.sourceCategory || entry.subcategory}
                      >
                        {entry.sourceCategory || entry.subcategory}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="sticky right-0 border-b bg-background px-1 py-1.5 align-top">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      aria-label={`Remove transaction ${index + 1}`}
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
      {!entries.length && <p className="text-sm text-muted-foreground">No transactions remain. Add a row or discard this review.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={onAdd} disabled={saving || entries.length >= 500}>
          <Plus className="mr-2 h-4 w-4" /> Add transaction row
        </Button>
        {entries.length >= 500 && <p className="text-xs text-muted-foreground">The maximum of 500 transaction rows has been reached.</p>}
        <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>Discard review & choose another file</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">Category is optional; transactions can be saved as unassigned.</p>
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || categoriesLoading || categoriesError || !entries.length || invalidCount > 0}
          data-testid="button-save-reviewed-transactions"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : `Save ${entries.length} ${entries.length === 1 ? "Transaction" : "Transactions"}`}
        </Button>
      </div>
    </div>
  );
}

export function TransactionFileImportPanel({
  onImported,
  onReviewingChange,
  onBusyChange,
}: {
  onImported: (result: TransactionImportResult) => void;
  onReviewingChange?: (reviewing: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<TransactionImportEntry[] | null>(null);
  const [ignoredBlankRows, setIgnoredBlankRows] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const {
    data: categoriesRaw,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useQuery<CanonicalCategory[] | { categories: CanonicalCategory[] }>({
    queryKey: ["/api/transaction-categories"],
    queryFn: () => apiRequest("GET", "/api/transaction-categories").then(response => response.json()),
  });
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : categoriesRaw?.categories ?? [];

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const previewMutation = useMutation({
    mutationFn: (selectedFile: File) => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      return apiRequest("POST", "/api/transactions/ingest/preview", formData)
        .then(response => response.json() as Promise<TransactionImportPreview>);
    },
    onMutate: () => onBusyChange?.(true),
    onSuccess: result => {
      if (!mountedRef.current) return;
      setEntries(result.entries);
      setIgnoredBlankRows(result.ignoredBlankRows);
      onReviewingChange?.(true);
    },
    onError: (error: Error) => {
      if (!mountedRef.current) return;
      toast({ title: "Could not preview transaction file", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      if (mountedRef.current) onBusyChange?.(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (reviewedEntries: TransactionImportEntry[]) =>
      apiRequest("POST", "/api/transactions/import-reviewed", {
        entries: reviewedEntries.map(entry => {
          const category = categories.find(item =>
            item.category === entry.subcategory && item.type.toLowerCase() === entry.type,
          );
          return {
            ...entry,
            parentCategory: category?.parentCategory ?? "",
            recurringType: entry.isRecurring ? entry.recurringType : "",
          };
        }),
      })
        .then(response => response.json() as Promise<TransactionImportResult>),
    onMutate: () => onBusyChange?.(true),
    onSuccess: result => {
      if (!mountedRef.current) return;
      setEntries(null);
      setFile(null);
      onReviewingChange?.(false);
      onImported(result);
    },
    onError: (error: Error) => {
      if (!mountedRef.current) return;
      toast({
        title: "Could not save reviewed transactions",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      if (mountedRef.current) onBusyChange?.(false);
    },
  });
  useEffect(() => {
    onBusyChange?.(previewMutation.isPending || saveMutation.isPending);
  }, [onBusyChange, previewMutation.isPending, saveMutation.isPending]);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;
    const extension = `.${selectedFile.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (![".csv", ".tsv", ".txt", ".xls", ".xlsx"].includes(extension)) {
      setFileError("Unsupported file type. Choose a CSV, TSV, TXT, XLS, or XLSX transaction file.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setFileError("This transaction file is larger than 5 MiB. Choose a file at or below 5 MiB.");
      return;
    }
    setFileError(null);
    setFile(selectedFile);
    setEntries(null);
    setIgnoredBlankRows(0);
  }

  function previewFile() {
    if (!file) return;
    setFileError(null);
    previewMutation.mutate(file);
  }

  function discardReview() {
    setEntries(null);
    setFile(null);
    setIgnoredBlankRows(0);
    setFileError(null);
    onReviewingChange?.(false);
  }

  function changeEntry(id: number, field: ReviewField, value: string | boolean) {
    setEntries(current => current?.map(entry => {
      if (entry.id !== id) return entry;
      if (field === "type") {
        const type = value as "income" | "expense";
        return { ...entry, type, subcategory: "", parentCategory: "" };
      }
      if (field === "subcategory") {
        const subcategory = value as string;
        const selected = categories.find(category =>
          category.category === subcategory && category.type.toLowerCase() === entry.type,
        );
        return { ...entry, subcategory, parentCategory: selected?.parentCategory ?? "" };
      }
      if (field === "isRecurring" && value === false) {
        return { ...entry, isRecurring: false, recurringType: "" };
      }
      return { ...entry, [field]: value };
    }) ?? null);
  }

  if (entries !== null) {
    return (
      <TransactionFileReview
        fileName={file?.name ?? "Uploaded transaction file"}
        entries={entries}
        ignoredBlankRows={ignoredBlankRows}
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        saving={saveMutation.isPending}
        onChange={changeEntry}
        onAdd={() => setEntries(current => {
          const nextId = Math.max(0, ...(current ?? []).map(entry => entry.id)) + 1;
          return [...(current ?? []), createBlankTransactionImportEntry(nextId)];
        })}
        onRemove={id => setEntries(current => current?.filter(entry => entry.id !== id) ?? null)}
        onDiscard={discardReview}
        onSave={() => saveMutation.mutate(entries)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={`cursor-pointer rounded-xl border-2 border-dashed p-7 text-center transition-colors hover:border-blue-400 ${previewMutation.isPending ? "cursor-wait opacity-70" : "border-slate-200 dark:border-slate-700"}`}
        onClick={() => { if (!previewMutation.isPending) fileRef.current?.click(); }}
        role="button"
        tabIndex={0}
        onKeyDown={event => {
          if (!previewMutation.isPending && (event.key === "Enter" || event.key === " ")) fileRef.current?.click();
        }}
      >
        <Upload className="mx-auto mb-2 h-8 w-8 text-blue-500" />
        <p className="text-sm font-medium">Step 1 of 2 · Choose a transaction file to preview</p>
        <p className="mt-1 text-xs text-muted-foreground">CSV, TSV, TXT, XLS, or XLSX · Maximum size 5 MiB</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,.xls,.xlsx"
          className="hidden"
          onChange={handleFile}
          onClick={event => event.stopPropagation()}
          disabled={previewMutation.isPending}
        />
      </div>
      {fileError && <p className="text-sm text-destructive" role="alert">{fileError}</p>}
      {file && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Selected: {file.name} ({(file.size / 1024).toFixed(1)} KiB)
        </p>
      )}
      {previewMutation.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Previewing {file?.name}… Nothing has been saved.
        </p>
      )}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs leading-relaxed text-slate-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-slate-200">
        <p className="font-semibold text-blue-900 dark:text-blue-200">What to include in your transaction file</p>
        <p className="mt-1">
          <strong>Required before saving:</strong> a valid date, description, and amount greater than zero.
          Missing or invalid fields can be completed during review. Recognized date columns include Date,
          Transaction Date, or Posted Date; descriptions include Description, Merchant, Name, Memo, or Text;
          amounts include Amount, Value, Debit, or Credit.
        </p>
        <p className="mt-1">
          <strong>Optional fields:</strong> Type, Category or Subcategory, Parent Category, Merchant, Need/Want,
          recurring status/type, and Notes. Categories are suggestions; choose a canonical category if wanted,
          or leave a transaction unassigned.
        </p>
        <p className="mt-1">Include a header row; columns can be in any order. Use one transaction per row, up to 500 rows.</p>
      </div>
      <Button
        disabled={!file || previewMutation.isPending}
        onClick={previewFile}
        className="w-full"
      >
        {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {previewMutation.isPending ? "Previewing…" : "Preview File"}
      </Button>
    </div>
  );
}