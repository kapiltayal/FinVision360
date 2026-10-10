import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, CheckCircle2, FileCheck2, FileUp, Loader2,
  Plus, RefreshCw, ShieldAlert, Trash2, Upload, X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  TransactionImportEntry,
  TransactionImportPreview,
  TransactionImportResult,
  TransactionImportStage,
} from "@shared/transaction-import";
import { TransactionImportProgress, transactionImportStageLabel, type ImportProgressStage } from "./transaction-import-progress";
import { createImportRequestId, readTransactionImportStream } from "./transaction-import-stream";
import {
  createBlankTransactionImportEntry,
  validateTransactionImportEntry,
  type TransactionImportCategory,
  type TransactionImportReviewField,
} from "./transaction-file-import-validation";

type CanonicalCategory = TransactionImportCategory;
type ReviewField = TransactionImportReviewField;
type ImportStage = ImportProgressStage;

function DuplicateNotice({ entry }: { entry: TransactionImportEntry }) {
  const duplicate = entry.duplicate;
  if (!duplicate) return null;
  const stable = duplicate.kind === "stable";
  const label = stable ? "Already imported" : "Possible duplicate";
  const detailHeading = stable
    ? "Already imported · locked"
    : duplicate.kind === "exact" ? "Possible exact duplicate" : "Possible duplicate";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${label}. Hover or focus for match details.`}
          className={`inline-flex cursor-help items-center gap-1 rounded-full px-2 py-1 font-medium ring-1 ring-inset ${
            stable
              ? "bg-destructive/10 text-destructive ring-destructive/20"
              : "bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300"
          }`}
        >
          {stable ? <ShieldAlert className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-72 whitespace-normal text-xs leading-relaxed">
        <p className="font-semibold">{detailHeading}</p>
        <p className="mt-1">{duplicate.reason}</p>
        {entry.sourceAccount && <p className="mt-1">Account: {entry.sourceAccount}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function TransactionFileReview({
  fileName, entries, ignoredBlankRows, categories, categoriesLoading, categoriesError,
  saving, checking, checkError, stage, failedAt, errorMessage, onChange, onAdd, onRemove,
  onDiscard, onSave, onRecheck,
}: {
  fileName: string;
  entries: TransactionImportEntry[];
  ignoredBlankRows: number;
  categories: CanonicalCategory[];
  categoriesLoading: boolean;
  categoriesError: boolean;
  saving: boolean;
  checking: boolean;
  checkError: string | null;
  stage: ImportStage;
  failedAt?: TransactionImportStage;
  errorMessage: string | null;
  onChange: (id: number, field: ReviewField, value: string | boolean) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onDiscard: () => void;
  onSave: () => void;
  onRecheck: () => void;
}) {
  const errors = entries.map(entry => validateTransactionImportEntry(entry, categories));
  const selectedIndexes = entries.map((entry, index) => entry.include !== false && entry.duplicate?.kind !== "stable" ? index : -1).filter(index => index >= 0);
  const invalidCount = selectedIndexes.filter(index => Object.keys(errors[index]).length > 0).length;
  const stableCount = entries.filter(entry => entry.duplicate?.kind === "stable").length;
  const possibleCount = entries.filter(entry => entry.duplicate && entry.duplicate.kind !== "stable").length;
  const excludedCount = entries.filter(entry => entry.include === false || entry.duplicate?.kind === "stable").length;
  const allCategories = categories;
  const decisionDisabled = saving || checking;

  return (
    <div className="space-y-4" data-testid="transaction-file-review">
      <div className="w-full max-w-[70rem] space-y-4">
        <TransactionImportProgress current={stage} failedAt={failedAt} />
        <div className="relative w-full overflow-hidden rounded-xl border border-primary/10 bg-[linear-gradient(120deg,hsl(var(--card)),hsl(var(--muted)))] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-primary">Review before recording</p>
              <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2">
                <h2 className="text-lg font-semibold tracking-tight">Nothing is saved yet</h2>
                <p className="min-w-0 max-w-full truncate text-xs text-muted-foreground" title={fileName}>{fileName}</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Review charges; possible duplicates stay excluded until selected.</p>
            </div>
            <div className="flex gap-2 text-center">
              <div className="rounded-lg border bg-background/75 px-3 py-2"><strong className="block text-lg tabular-nums">{entries.length}</strong><span className="text-[10px] text-muted-foreground">rows</span></div>
              <div className="rounded-lg border bg-background/75 px-3 py-2"><strong className="block text-lg tabular-nums">{selectedIndexes.length}</strong><span className="text-[10px] text-muted-foreground">selected</span></div>
            </div>
          </div>
          {ignoredBlankRows > 0 && <p className="relative mt-3 text-xs text-amber-800 dark:text-amber-300">{ignoredBlankRows} completely blank {ignoredBlankRows === 1 ? "row was" : "rows were"} left out.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs" aria-label="Duplicate summary">
          <span className="font-semibold">Duplicate review</span>
          {possibleCount > 0 && <span className="text-amber-800 dark:text-amber-300">{possibleCount} similar {possibleCount === 1 ? "charge" : "charges"} · excluded by default</span>}
          {stableCount > 0 && <span className="text-destructive">{stableCount} already imported · cannot be kept</span>}
          <span className="text-muted-foreground">{excludedCount} excluded from save</span>
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={onRecheck} disabled={decisionDisabled}>
            {checking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Recheck matches
          </Button>
        </div>

      {categoriesError && <p className="text-sm text-destructive" role="alert">Categories could not be loaded. Please try again before saving.</p>}
      {categoriesLoading && <p className="text-sm text-muted-foreground">Loading categories…</p>}
      {invalidCount > 0 && <p className="flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-300" role="status"><AlertCircle className="h-4 w-4" /> {invalidCount} selected {invalidCount === 1 ? "row needs" : "rows need"} attention. Excluded rows will not block saving.</p>}
      {checking && <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming duplicate matches… Saving is paused until this finishes.</p>}
      {checkError && <p className="text-sm text-destructive" role="alert">{checkError} Recheck before saving.</p>}
      {stage === "failed" && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Import paused{failedAt ? ` during ${transactionImportStageLabel(failedAt).toLowerCase()}` : ""}</p><p className="mt-0.5">{errorMessage}</p><p className="mt-1 text-xs">Your review is still here. Correct the issue or retry when ready.</p></div></div>}

      <div className="max-h-[55vh] overflow-auto overscroll-contain rounded-xl border" aria-label="Editable transaction preview">
        <table className="w-full min-w-[2000px] text-left text-xs">
          <caption className="sr-only">Editable preview of transactions from {fileName}</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th scope="col" className="sticky left-0 z-20 w-12 min-w-12 border-b bg-muted px-2 py-2 text-center font-medium">#</th>
              <th scope="col" className="min-w-32 border-b px-2 py-2 font-medium">Save?</th>
              <th scope="col" className="min-w-56 border-b px-2 py-2 font-medium">Match check</th>
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
              const stable = entry.duplicate?.kind === "stable";
              const included = entry.include !== false && !stable;
              const matchingCategories = allCategories.filter(item => item.type.toLowerCase() === entry.type);
              const selectedCategory = matchingCategories.find(item => item.category === entry.subcategory);
              const input = (field: "date" | "description" | "merchant" | "amount" | "notes", placeholder = "") => (
                <td className="border-b px-2 py-1.5 align-top">
                  <Input type="text" inputMode={field === "date" ? "text" : field === "amount" ? "decimal" : undefined}
                    value={entry[field]} onChange={event => onChange(entry.id, field, event.target.value)}
                    placeholder={placeholder} aria-label={`Transaction ${index + 1} ${field}`} aria-invalid={!!error[field]}
                    disabled={saving} className={`h-8 px-2 text-xs ${error[field] ? "border-destructive" : ""}`} />
                  {error[field] && <p className="mt-1 max-w-40 text-[10px] leading-tight text-destructive">{error[field]}</p>}
                </td>
              );
              return (
                <tr key={entry.id} className={`${stable ? "bg-destructive/[0.035]" : included ? "" : "bg-muted/35"} ${Object.keys(error).length && included ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                  <th scope="row" className="sticky left-0 z-[1] border-b bg-background px-2 py-1.5 text-center font-normal">
                    <span className="block text-muted-foreground">{index + 1}</span>
                    {Object.keys(error).length > 0 && included && <AlertCircle className="mx-auto mt-1 h-3.5 w-3.5 text-amber-600" aria-label="Needs review" />}
                  </th>
                  <td className="border-b px-2 py-2 align-top">
                    <label className={`flex items-start gap-2 ${stable ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                      <input type="checkbox" checked={included} disabled={decisionDisabled || stable}
                        onChange={event => onChange(entry.id, "include", event.target.checked)}
                        aria-label={`Include transaction ${index + 1} in import`} className="mt-0.5 h-4 w-4 accent-primary" />
                      <span>
                        {included && <span className="block font-semibold">Selected</span>}
                        {stable && <span className="block font-semibold">Already imported</span>}
                        {stable ? (
                          <span className="block text-[10px] text-muted-foreground">Cannot be saved again.</span>
                        ) : !included ? (
                          <span className="block text-[10px] leading-tight text-muted-foreground">Excluded.<br />Select to save.</span>
                        ) : null}
                      </span>
                    </label>
                    {entry.sourceTransactionId && <p className="mt-1 max-w-32 truncate text-[10px] text-muted-foreground" title={`Source transaction ID: ${entry.sourceTransactionId}`}>Source ID: {entry.sourceTransactionId}</p>}
                  </td>
                  <td className="border-b px-2 py-1.5 align-top">{entry.duplicate ? <DuplicateNotice entry={entry} /> : <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary"><CheckCircle2 className="h-3 w-3" /> No match found</span>}</td>
                  {input("date", "YYYY-MM-DD")}
                  {input("description", "Description")}
                  {input("merchant", "Merchant")}
                  {input("amount", "0.00")}
                  <td className="border-b px-2 py-1.5 align-top">
                    <select value={entry.type} onChange={event => onChange(entry.id, "type", event.target.value)} aria-label={`Transaction ${index + 1} type`} disabled={saving} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                      <option value="expense">Expense</option><option value="income">Income</option>
                    </select>
                    {error.type && <p className="mt-1 text-[10px] leading-tight text-destructive">{error.type}</p>}
                  </td>
                  <td className="border-b px-2 py-1.5 align-top">
                    <select value={entry.subcategory} onChange={event => onChange(entry.id, "subcategory", event.target.value)} aria-label={`Transaction ${index + 1} category`} aria-invalid={!!error.subcategory} disabled={saving} className={`h-8 w-full min-w-52 rounded-md border bg-background px-2 text-xs ${error.subcategory ? "border-destructive" : "border-input"}`}>
                      <option value="">Unassigned (optional)</option>
                      {matchingCategories.map(category => <option key={`${category.parentCategory}-${category.category}`} value={category.category}>{category.parentCategory} · {category.category}</option>)}
                    </select>
                    {error.subcategory && <p className="mt-1 text-[10px] leading-tight text-destructive">{error.subcategory}</p>}
                  </td>
                  <td className="border-b px-2 py-1.5 align-top"><select value={entry.needsWant} onChange={event => onChange(entry.id, "needsWant", event.target.value)} aria-label={`Transaction ${index + 1} need or want`} disabled={saving} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="na">N/A</option><option value="need">Need</option><option value="want">Want</option></select>{error.needsWant && <p className="mt-1 text-[10px] text-destructive">{error.needsWant}</p>}</td>
                  <td className="border-b px-2 py-1.5 align-top"><label className="flex h-8 items-center gap-2"><input type="checkbox" checked={entry.isRecurring} onChange={event => onChange(entry.id, "isRecurring", event.target.checked)} aria-label={`Transaction ${index + 1} recurring`} disabled={saving} className="h-4 w-4 rounded border-input" /><span>{entry.isRecurring ? "Yes" : "No"}</span></label></td>
                  <td className="border-b px-2 py-1.5 align-top"><select value={entry.recurringType} onChange={event => onChange(entry.id, "recurringType", event.target.value)} aria-label={`Transaction ${index + 1} recurring type`} disabled={saving || !entry.isRecurring} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"><option value="">Choose type</option><option value="subscription">Subscription</option><option value="recurring_bill">Recurring bill</option></select>{error.recurringType && <p className="mt-1 text-[10px] text-destructive">{error.recurringType}</p>}</td>
                  {input("notes", "Notes")}
                  <td className="border-b px-2 py-1.5 align-top">{((entry.sourceCategory && entry.sourceCategory !== entry.subcategory) || (entry.subcategory && !selectedCategory)) ? <span className="block max-w-36 truncate text-xs text-muted-foreground" title={entry.sourceCategory || entry.subcategory}>{entry.sourceCategory || entry.subcategory}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="sticky right-0 border-b bg-background px-1 py-1.5 align-top"><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={`Remove transaction ${index + 1}`} onClick={() => onRemove(entry.id)} disabled={saving}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!entries.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No transactions remain. Add a row or discard this review.</p>}
      <div className="space-y-2 border-t pt-3">
        <p className="max-w-lg text-xs text-muted-foreground">Category is optional. {excludedCount > 0 ? `${excludedCount} excluded ${excludedCount === 1 ? "row is" : "rows are"} ignored during validation and save.` : "Only selected, valid rows will be saved."}</p>
        {entries.length >= 500 && <p className="text-xs text-muted-foreground">Maximum of 500 transaction rows reached.</p>}
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
          <Button type="button" variant="outline" className="shrink-0" onClick={onAdd} disabled={saving || entries.length >= 500}><Plus className="mr-2 h-4 w-4" /> Add transaction row</Button>
          <Button type="button" variant="ghost" className="shrink-0" onClick={onDiscard} disabled={saving}>Discard review & choose another file</Button>
          <Button type="button" className="ml-auto shrink-0" onClick={onSave} disabled={decisionDisabled || categoriesLoading || categoriesError || !selectedIndexes.length || invalidCount > 0 || !!checkError} data-testid="button-save-reviewed-transactions">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
            {saving ? "Saving selected…" : `Save ${selectedIndexes.length} selected ${selectedIndexes.length === 1 ? "transaction" : "transactions"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TransactionFileImportPanel({
  onImported, onReviewingChange, onBusyChange,
}: {
  onImported: (result: TransactionImportResult) => void;
  onReviewingChange?: (reviewing: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const reviewVersion = useRef(0);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<ImportStage>("validation");
  const requestRef = useRef<{ payload: string; id: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<TransactionImportEntry[] | null>(null);
  const [ignoredBlankRows, setIgnoredBlankRows] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [stage, setStage] = useState<ImportStage>("validation");
  const [failedAt, setFailedAt] = useState<TransactionImportStage>();
  const [operationError, setOperationError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkVersion, setCheckVersion] = useState(0);
  function setImportStage(next: ImportStage) {
    stageRef.current = next;
    setStage(next);
  }
  const { data: categoriesRaw, isLoading: categoriesLoading, isError: categoriesError } = useQuery<CanonicalCategory[] | { categories: CanonicalCategory[] }>({
    queryKey: ["/api/transaction-categories"],
    queryFn: () => apiRequest("GET", "/api/transaction-categories").then(response => response.json()),
  });
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : categoriesRaw?.categories ?? [];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      reviewVersion.current += 1;
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, []);
  useEffect(() => {
    onBusyChange?.(previewing || saving || checking);
  }, [onBusyChange, previewing, saving, checking]);

  function cancelDuplicateCheck() {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = null;
    reviewVersion.current += 1;
    setChecking(false);
  }

  async function performDuplicateCheck(list: TransactionImportEntry[], version: number) {
    if (!mountedRef.current || version !== reviewVersion.current) return;
    try {
      const response = await apiRequest("POST", "/api/transactions/import-reviewed/check", { entries: list });
      const result = await response.json() as { entries: TransactionImportEntry[] };
      if (!mountedRef.current || version !== reviewVersion.current) return;
      const findings = new Map(result.entries.map(entry => [entry.id, entry]));
      setEntries(current => {
        if (!current || version !== reviewVersion.current) return current;
        return current.map(prior => {
          const found = findings.get(prior.id);
          if (!found) return prior;
          const duplicate = found.duplicate;
          const stable = duplicate?.kind === "stable";
          const sameFinding = !!prior.duplicate && !!duplicate
            && prior.duplicate.kind === duplicate.kind
            && prior.duplicate.transactionId === duplicate.transactionId
            && prior.duplicate.rowId === duplicate.rowId;
          const wasConfirmed = prior.keepDuplicate === true && sameFinding;
          return {
            ...prior,
            duplicate,
            include: stable ? false : duplicate ? wasConfirmed : prior.include !== false,
            keepDuplicate: !stable && !!duplicate && wasConfirmed,
          };
        });
      });
      setCheckError(null);
      setOperationError(null);
      setFailedAt(undefined);
      setImportStage("review");
    } catch (error) {
      if (mountedRef.current && version === reviewVersion.current) {
        const message = error instanceof Error ? error.message : "Duplicate check failed.";
        setCheckError(message);
        setOperationError(message);
        setFailedAt("duplicates");
        setImportStage("failed");
      }
    } finally {
      if (mountedRef.current && version === reviewVersion.current) {
        checkTimerRef.current = null;
        setChecking(false);
      }
    }
  }

  function scheduleDuplicateCheck(list: TransactionImportEntry[], delay = 350) {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    const version = reviewVersion.current;
    setChecking(true);
    setCheckError(null);
    setFailedAt(undefined);
    setImportStage("duplicates");
    checkTimerRef.current = setTimeout(() => void performDuplicateCheck(list, version), delay);
  }

  useEffect(() => {
    if (!entries || checkVersion === 0) return;
    scheduleDuplicateCheck(entries);
    // The version is the intentional trigger; entries are captured for that edit revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkVersion]);

  async function previewFile() {
    if (!file) return;
    setFileError(null);
    setPreviewing(true);
    setImportStage("validation");
    setFailedAt(undefined);
    setOperationError(null);
    onBusyChange?.(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await apiRequest("POST", "/api/transactions/ingest/preview?progress=1", formData);
      let preview: TransactionImportPreview | null = null;
      let reviewStageSeen = false;
      await readTransactionImportStream(response, event => {
        if (!mountedRef.current) return;
        if ("stage" in event) {
          setImportStage(event.stage);
          if (event.stage === "review") reviewStageSeen = true;
        }
        else if ("preview" in event) {
          preview = event.preview;
          setEntries(event.preview.entries.map(entry => {
            if (entry.duplicate?.kind === "stable") return { ...entry, include: false, keepDuplicate: false };
            if (entry.duplicate) return { ...entry, include: entry.keepDuplicate === true, keepDuplicate: entry.keepDuplicate === true };
            return { ...entry, include: entry.include !== false, keepDuplicate: false };
          }));
          setIgnoredBlankRows(event.preview.ignoredBlankRows);
          onReviewingChange?.(true);
        }
      });
      if (!preview) throw new Error("The file preview did not include transaction rows. Please try again.");
      if (!reviewStageSeen) throw new Error("The preview ended before the review step was confirmed. Please retry.");
      if (!mountedRef.current) return;
      requestRef.current = null;
      reviewVersion.current += 1;
      setCheckError(null);
      setChecking(false);
    } catch (error) {
      if (!mountedRef.current) return;
      const observedStage = stageRef.current;
      const currentStage = observedStage === "failed" ? "validation" : observedStage;
      setFailedAt(currentStage);
      setImportStage("failed");
      setOperationError(error instanceof Error ? error.message : "Could not preview transaction file.");
      setFileError(error instanceof Error ? error.message : "Could not preview transaction file.");
    } finally {
      if (mountedRef.current) {
        setPreviewing(false);
        onBusyChange?.(false);
      }
    }
  }

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
    setImportStage("validation");
    setFailedAt(undefined);
    setOperationError(null);
  }

  function discardReview() {
    cancelDuplicateCheck();
    setEntries(null);
    setFile(null);
    setIgnoredBlankRows(0);
    setFileError(null);
    setCheckError(null);
    setChecking(false);
    setFailedAt(undefined);
    setOperationError(null);
    requestRef.current = null;
    onReviewingChange?.(false);
  }

  function changeEntry(id: number, field: ReviewField, value: string | boolean) {
    const relevant = ["date", "description", "merchant", "amount", "type", "sourceTransactionId", "sourceAccount", "include"].includes(field);
    setEntries(current => {
      if (!current) return null;
      return current.map(entry => {
        if (entry.id !== id) return entry;
        if (field === "type") {
          const type = value as "income" | "expense";
          return { ...entry, type, subcategory: "", parentCategory: "", ...(entry.duplicate ? { include: false, keepDuplicate: false } : {}) };
        }
        if (field === "subcategory") {
          const subcategory = value as string;
          const selected = categories.find(category => category.category === subcategory && category.type.toLowerCase() === entry.type);
          return { ...entry, subcategory, parentCategory: selected?.parentCategory ?? "" };
        }
        if (field === "isRecurring" && value === false) return { ...entry, isRecurring: false, recurringType: "" };
        if (field === "include") {
          if (entry.duplicate?.kind === "stable") return entry;
          const include = value === true;
          return { ...entry, include, keepDuplicate: entry.duplicate ? include : false };
        }
        if (["date", "description", "merchant", "amount", "type", "sourceTransactionId", "sourceAccount"].includes(field) && entry.duplicate) {
          return { ...entry, [field]: value, include: false, keepDuplicate: false };
        }
        return { ...entry, [field]: value };
      });
    });
    if (relevant) {
      cancelDuplicateCheck();
      setCheckError(null);
      setCheckVersion(version => version + 1);
    }
    setOperationError(null);
    setFailedAt(undefined);
    setImportStage("review");
  }

  async function saveReviewed() {
    if (!entries) return;
    const selected = entries.filter(entry => entry.include !== false && entry.duplicate?.kind !== "stable");
    const invalidSelected = selected.some(entry => Object.keys(validateTransactionImportEntry(entry, categories)).length > 0);
    if (!selected.length || invalidSelected || checking || checkError || categoriesLoading || categoriesError) return;
    const payloadEntries = entries.map(entry => {
      const category = categories.find(item => item.category === entry.subcategory && item.type.toLowerCase() === entry.type);
      return { ...entry, parentCategory: category?.parentCategory ?? "", recurringType: entry.isRecurring ? entry.recurringType : "" };
    });
    const payload = JSON.stringify(payloadEntries);
    if (!requestRef.current || requestRef.current.payload !== payload) requestRef.current = { payload, id: createImportRequestId() };
    const requestId = requestRef.current.id;
    setSaving(true);
    setImportStage("finalization");
    setFailedAt(undefined);
    setOperationError(null);
    onBusyChange?.(true);
    try {
      const response = await apiRequest("POST", "/api/transactions/import-reviewed", { entries: payloadEntries, requestId });
      const result = await response.json() as TransactionImportResult;
      if (!mountedRef.current) return;
      setImportStage("complete");
      toast({ title: "Transactions imported", description: `${result.inserted} saved${result.skipped ? ` · ${result.skipped} skipped` : ""}.` });
      onImported(result);
      setEntries(null);
      setFile(null);
      onReviewingChange?.(false);
    } catch (error) {
      if (!mountedRef.current) return;
      const failure = error as Error & { status?: number; code?: string };
      if (failure.status === 409 && failure.code === "DUPLICATES_CHANGED") {
        setImportStage("review");
        setFailedAt(undefined);
        setOperationError("New duplicate matches were found before saving. Review the updated rows, then save again.");
        toast({ title: "Duplicate matches changed", description: "Review refreshed matches before retrying.", variant: "destructive" });
        // Keep request ID so identical payload retries remain idempotent.
        cancelDuplicateCheck();
        setCheckVersion(version => version + 1);
      } else {
        setFailedAt("finalization");
        setImportStage("failed");
        setOperationError(failure.message || "Could not save reviewed transactions.");
      }
      toast({ title: "Could not save reviewed transactions", description: failure.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setSaving(false);
      onBusyChange?.(false);
    }
  }

  if (entries !== null) {
    return <TransactionFileReview
      fileName={file?.name ?? "Uploaded transaction file"} entries={entries} ignoredBlankRows={ignoredBlankRows}
      categories={categories} categoriesLoading={categoriesLoading} categoriesError={categoriesError}
      saving={saving} checking={checking || previewing} checkError={checkError} stage={stage} failedAt={failedAt}
      errorMessage={operationError} onChange={changeEntry}
      onAdd={() => {
        cancelDuplicateCheck();
        const nextId = Math.max(0, ...entries.map(entry => entry.id)) + 1;
        setEntries([...entries, createBlankTransactionImportEntry(nextId)]);
        setCheckVersion(version => version + 1);
      }}
      onRemove={id => {
        cancelDuplicateCheck();
        setCheckVersion(version => version + 1);
        setEntries(current => current?.filter(entry => entry.id !== id) ?? null);
      }}
      onDiscard={discardReview} onSave={() => void saveReviewed()}
      onRecheck={() => {
        cancelDuplicateCheck();
        setCheckVersion(version => version + 1);
      }}
    />;
  }

  return (
    <div className="space-y-4">
      {(previewing || stage === "failed") && <TransactionImportProgress current={stage} failedAt={failedAt} />}
      <div
        className={`cursor-pointer rounded-xl border-2 border-dashed p-7 text-center transition-colors hover:border-primary/60 ${previewing ? "cursor-wait opacity-70" : file ? "border-primary/40 bg-primary/[0.025]" : "border-border"}`}
        onClick={() => { if (!previewing) fileRef.current?.click(); }}
        role="button" tabIndex={0} aria-label="Choose a transaction file"
        onKeyDown={event => { if (!previewing && (event.key === "Enter" || event.key === " ")) fileRef.current?.click(); }}
      >
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          {previewing ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
        </span>
        <p className="text-sm font-semibold">{previewing ? "Reading your file" : "Step 1 · Choose a transaction file"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{previewing ? "Following the file through validation and duplicate checks. Nothing is saved." : "CSV, TSV, TXT, XLS, or XLSX · Maximum size 5 MiB"}</p>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" className="hidden" onChange={handleFile} onClick={event => event.stopPropagation()} disabled={previewing} />
      </div>
      {fileError && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{fileError}</span></div>}
      {file && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <p className="min-w-0 break-all"><span className="font-medium">{file.name}</span><span className="ml-2 text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KiB</span></p>
        {!previewing && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove selected file" onClick={() => { setFile(null); setFileError(null); }}><X className="h-4 w-4" /></Button>}
      </div>}
      <div className="rounded-xl border border-primary/10 bg-primary/[0.025] p-4 text-xs leading-relaxed">
        <p className="font-semibold text-primary">A careful import, row by row</p>
        <p className="mt-1 text-muted-foreground"><strong className="text-foreground">Required before saving:</strong> valid date, description, and amount greater than zero. Missing fields can be completed in review. Recognized date columns include Date, Transaction Date, or Posted Date; descriptions include Description, Merchant, Name, Memo, or Text; amounts include Amount, Value, Debit, or Credit.</p>
        <p className="mt-1 text-muted-foreground"><strong className="text-foreground">Optional:</strong> Type, Category or Subcategory, Parent Category, Merchant, Need/Want, recurring status/type, and Notes. Categories are suggestions; transactions may remain unassigned.</p>
        <p className="mt-1 text-muted-foreground">Include a header row. Columns can be in any order; use one transaction per row, up to 500 rows.</p>
      </div>
      <Button disabled={!file || previewing} onClick={() => void previewFile()} className="w-full">
        {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {previewing ? "Previewing file…" : "Preview transactions"}
      </Button>
    </div>
  );
}
