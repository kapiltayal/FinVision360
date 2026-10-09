import { useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle2, FileCheck2, LoaderCircle, Plus, RefreshCw,
  ShieldAlert, Trash2, Upload, Landmark, Database, ChevronDown,
} from "lucide-react";
import "./_group.css";

type Duplicate = { kind: "possible" | "exact" | "stable"; reason: string; account?: string };
type Entry = {
  id: number;
  include: boolean;
  duplicate?: Duplicate;
  date: string;
  description: string;
  merchant: string;
  amount: string;
  type: "expense" | "income";
  category: string;
  needsWant: "na" | "need" | "want";
  recurring: boolean;
  recurringType: string;
  notes: string;
  sourceCategory: string;
  sourceId?: string;
};

const startingEntries: Entry[] = [
  { id: 1, include: true, date: "2025-02-18", description: "Market Street Grocers", merchant: "Market Street Grocers", amount: "84.36", type: "expense", category: "Groceries", needsWant: "need", recurring: false, recurringType: "", notes: "", sourceCategory: "Food & Dining", sourceId: "TXN-410882" },
  { id: 2, include: false, duplicate: { kind: "exact", reason: "Same amount and merchant on the same day as a recorded transaction.", account: "Everyday Checking · •• 4821" }, date: "2025-02-17", description: "AMZN Mktp US*4D8K2", merchant: "Amazon", amount: "62.40", type: "expense", category: "Shopping", needsWant: "want", recurring: false, recurringType: "", notes: "Household storage bins", sourceCategory: "Online retail", sourceId: "TXN-410879" },
  { id: 3, include: false, duplicate: { kind: "stable", reason: "This transaction is already in your FinVision360 history.", account: "Everyday Checking · •• 4821" }, date: "2025-02-16", description: "NORTHLIGHT ENERGY AUTOPAY", merchant: "Northlight Energy", amount: "118.72", type: "expense", category: "Utilities", needsWant: "need", recurring: true, recurringType: "recurring_bill", notes: "", sourceCategory: "Utilities", sourceId: "TXN-410861" },
  { id: 4, include: true, date: "2025-02-15", description: "Payroll deposit — February", merchant: "Cedar & Stone Studio", amount: "2,840.00", type: "income", category: "Salary", needsWant: "na", recurring: true, recurringType: "recurring_bill", notes: "Biweekly pay", sourceCategory: "Direct deposit" },
];
const categories: Record<Entry["type"], { parent: string; values: string[] }> = {
  expense: { parent: "Living", values: ["Groceries", "Utilities", "Housing", "Dining", "Transportation", "Shopping"] },
  income: { parent: "Income", values: ["Salary", "Interest", "Other income"] },
};
type Field = Exclude<keyof Entry, "id" | "duplicate" | "sourceId" | "include">;
type RowErrors = Partial<Record<"date" | "description" | "amount" | "type" | "category" | "needsWant" | "recurringType", string>>;

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateEntry(entry: Entry): RowErrors {
  const errors: RowErrors = {};
  if (!validCalendarDate(entry.date.trim())) errors.date = "Enter a valid date (YYYY-MM-DD).";
  if (!entry.description.trim()) errors.description = "Description is required.";
  const amountText = entry.amount.trim();
  const amount = Number(amountText);
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(amountText) || !Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99) {
    errors.amount = "Enter an amount greater than zero, up to $9,999,999,999.99, with no more than two decimal places.";
  }
  if (entry.category && !categories[entry.type].values.includes(entry.category)) errors.category = "Choose a category for this transaction type.";
  if (entry.needsWant !== "need" && entry.needsWant !== "want" && entry.needsWant !== "na") errors.needsWant = "Choose need, want, or N/A.";
  if (entry.recurring && entry.recurringType !== "subscription" && entry.recurringType !== "recurring_bill") errors.recurringType = "Choose a recurring type.";
  return errors;
}

function MatchNotice({ entry, index }: { entry: Entry; index: number }) {
  if (!entry.duplicate) return <span className="tr-status tr-status-good"><CheckCircle2 aria-hidden="true" />No match found</span>;
  const locked = entry.duplicate.kind === "stable";
  const label = locked ? "Already imported" : "Possible duplicate";
  const title = locked ? "Already imported · locked" : entry.duplicate.kind === "exact" ? "Possible exact duplicate" : "Possible duplicate";
  return (
    <span className="tr-match">
      <button type="button" className={`tr-status ${locked ? "tr-status-locked" : "tr-status-warn"}`} aria-describedby={`improved-match-${index}`}>
        {locked ? <ShieldAlert aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}{label}
      </button>
      <span className="tr-tooltip" role="tooltip" id={`improved-match-${index}`}>
        <strong>{title}</strong><span>{entry.duplicate.reason}</span>
        {entry.duplicate.account && <span>Account: {entry.duplicate.account}</span>}
      </span>
    </span>
  );
}

function FieldControl({ label, value, onChange, placeholder, inputMode, invalid, errorText, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string;
  inputMode?: "decimal"; invalid?: boolean; errorText?: string; disabled?: boolean;
}) {
  return (
    <label className="tr-field">
      <span className="tr-field-label">{label}</span>
      <input className={`tr-input ${invalid ? "tr-invalid" : ""}`} type="text" inputMode={inputMode} value={value} placeholder={placeholder} aria-invalid={!!invalid} disabled={disabled} onChange={event => onChange(event.target.value)} />
      {invalid && <span className="tr-error-text">{errorText}</span>}
    </label>
  );
}

export function Improved() {
  const [entries, setEntries] = useState<Entry[]>(startingEntries);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = useMemo(() => entries.filter(entry => entry.include && entry.duplicate?.kind !== "stable"), [entries]);
  const invalidCount = selected.filter(entry => Object.keys(validateEntry(entry)).length > 0).length;
  const excluded = entries.length - selected.length;
  const possible = entries.filter(entry => entry.duplicate && entry.duplicate.kind !== "stable").length;
  const stable = entries.filter(entry => entry.duplicate?.kind === "stable").length;
  const update = (id: number, field: Field | "include", value: string | boolean) => {
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, [field]: value } as Entry : entry));
    setNotice("");
  };
  const add = () => setEntries(current => current.length >= 500 ? current : [...current, {
    id: Math.max(0, ...current.map(entry => entry.id)) + 1, include: true, date: "", description: "",
    merchant: "", amount: "", type: "expense", category: "", needsWant: "na", recurring: false,
    recurringType: "", notes: "", sourceCategory: "",
  }]);
  const remove = (id: number) => setEntries(current => current.filter(entry => entry.id !== id));
  const recheck = () => {
    setChecking(true);
    setNotice("");
    window.setTimeout(() => { setChecking(false); setNotice("Match check complete. Review any flagged rows before saving."); }, 650);
  };

  return (
    <main className="tr-sandbox tr-modal tr-improved" data-testid="transaction-file-review">
      <div className="tr-dialog-heading">
        <div className="tr-heading-icon"><Database size={17} aria-hidden="true" /></div>
        <div><h1>Add Transactions</h1><p>Enter a transaction, upload a file, or import activity from a connected account.</p></div>
        <button className="tr-close" type="button" aria-label="Close transaction dialog" onClick={() => setNotice("Review remains open in this static preview.")}>×</button>
      </div>
      <nav className="tr-tabs" aria-label="Transaction entry method">
        <button type="button" onClick={() => setNotice("Manual entry is outside this uploaded-file review.")}><Plus size={14} aria-hidden="true" />Manual</button>
        <button type="button" className="tr-tab-active" aria-current="page" onClick={() => setNotice("Reviewing checking_activity_feb_2025.csv.")}><Upload size={14} aria-hidden="true" />Upload File</button>
        <button type="button" onClick={() => setNotice("Connected-account import is outside this uploaded-file review.")}><Landmark size={14} aria-hidden="true" />Connected</button>
      </nav>
      <section className="tr-progress" aria-label="Import progress">
        <span className="tr-progress-step tr-progress-done"><i>1</i>Choose file</span><span className="tr-progress-line" />
        <span className="tr-progress-step tr-progress-active"><i>2</i>Review transactions</span><span className="tr-progress-line" />
        <span className="tr-progress-step"><i>3</i>Record activity</span>
      </section>

      <section className="tr-info-panel tr-info-compact">
        <div className="tr-info-copy">
          <p className="tr-eyebrow">Review before recording</p>
          <h2>Nothing is saved yet</h2>
          <p className="tr-file-name">checking_activity_feb_2025.csv</p>
          <p className="tr-guidance">Similar charges start excluded. Keep one only when you recognize it as a separate transaction.</p>
        </div>
        <div className="tr-summary-counts" aria-label="Transaction counts">
          <div><strong>{entries.length}</strong><span>rows</span></div><div><strong>{selected.length}</strong><span>selected</span></div>
        </div>
        <p className="tr-blank-note">1 completely blank row was left out.</p>
      </section>

      <section className="tr-duplicate-summary tr-summary-compact" aria-label="Duplicate summary">
        <div className="tr-summary-label"><strong>Duplicate review</strong><span>{excluded} excluded from save</span></div>
        <div className="tr-summary-statuses">
          <span className="tr-summary-warn">{possible} similar charges · excluded by default</span>
          <span className="tr-summary-locked">{stable} already imported · cannot be kept</span>
        </div>
        <button type="button" className="tr-quiet-button tr-recheck" onClick={recheck} disabled={checking}>
          {checking ? <LoaderCircle className="tr-spin" size={14} /> : <RefreshCw size={14} />} Recheck matches
        </button>
      </section>
      {invalidCount > 0 && <p className="tr-inline-alert tr-alert-warn" role="status"><AlertCircle size={16} />{invalidCount} selected {invalidCount === 1 ? "row needs" : "rows need"} attention. Excluded rows will not block saving.</p>}
      {checking && <p className="tr-inline-alert tr-alert-muted" role="status"><LoaderCircle className="tr-spin" size={14} />Confirming duplicate matches… Saving is paused until this finishes.</p>}
      {notice && <p className="tr-inline-alert tr-alert-muted" role="status">{notice}</p>}

      <section className="tr-record-list" aria-label="Editable transaction review">
        {entries.map((entry, index) => {
          const locked = entry.duplicate?.kind === "stable";
          const included = entry.include && !locked;
          const error = validateEntry(entry);
          const invalidDate = !!error.date;
          const invalidDescription = !!error.description;
          const invalidAmount = !!error.amount;
          const available = categories[entry.type];
          const sourceCategory = (entry.sourceCategory && entry.sourceCategory !== entry.category) || (entry.category && !available.values.includes(entry.category)) ? entry.sourceCategory || entry.category : "—";
          return (
            <article className={`tr-record-card ${locked ? "tr-record-locked" : !included ? "tr-record-excluded" : ""}`} key={entry.id}>
              <header className="tr-record-head">
                <div className="tr-record-ident">
                  <span className="tr-record-number">{String(index + 1).padStart(2, "0")}</span>
                  <label className={`tr-save-toggle ${locked ? "tr-disabled" : ""}`}>
                    <input type="checkbox" checked={included} disabled={locked || checking} aria-label={`Include transaction ${index + 1} in import`} onChange={event => update(entry.id, "include", event.target.checked)} />
                    <span><strong>{locked ? "Already imported" : included ? "Selected for save" : "Excluded from save"}</strong><small>{locked ? "Cannot be saved again" : included ? "Included in this import" : "Select to save this record"}</small></span>
                  </label>
                  <MatchNotice entry={entry} index={index} />
                </div>
                <button type="button" className="tr-icon-button tr-remove-improved" aria-label={`Remove transaction ${index + 1}`} onClick={() => remove(entry.id)}><Trash2 size={15} /><span>Remove</span></button>
              </header>
              {entry.sourceId && <p className="tr-record-source-id" title={`Source transaction ID: ${entry.sourceId}`}>Source transaction ID <span>{entry.sourceId}</span></p>}
              <div className="tr-fields-main">
                <FieldControl label="Date *" value={entry.date} placeholder="YYYY-MM-DD" invalid={invalidDate && included} errorText={error.date} onChange={value => update(entry.id, "date", value)} />
                <FieldControl label="Description *" value={entry.description} placeholder="Transaction description" invalid={invalidDescription && included} errorText={error.description} onChange={value => update(entry.id, "description", value)} />
                <FieldControl label="Merchant" value={entry.merchant} placeholder="Merchant" onChange={value => update(entry.id, "merchant", value)} />
                <FieldControl label="Amount *" value={entry.amount} placeholder="0.00" inputMode="decimal" invalid={invalidAmount && included} errorText={error.amount} onChange={value => update(entry.id, "amount", value)} />
              </div>
              <details className="tr-details">
                <summary><span>More transaction details</span><ChevronDown size={15} aria-hidden="true" /></summary>
                <div className="tr-fields-details">
                  <label className="tr-field"><span className="tr-field-label">Type *</span><select className={`tr-input ${error.type ? "tr-invalid" : ""}`} value={entry.type} aria-label={`Transaction ${index + 1} type`} aria-invalid={!!error.type} onChange={event => update(entry.id, "type", event.target.value as Entry["type"])}><option value="expense">Expense</option><option value="income">Income</option></select>{error.type && <span className="tr-error-text">{error.type}</span>}</label>
                  <label className="tr-field"><span className="tr-field-label">Category</span><select className={`tr-input ${error.category ? "tr-invalid" : ""}`} value={entry.category} aria-label={`Transaction ${index + 1} category`} aria-invalid={!!error.category} onChange={event => update(entry.id, "category", event.target.value)}><option value="">Unassigned (optional)</option>{available.values.map(value => <option key={value} value={value}>{available.parent} · {value}</option>)}</select><span className="tr-field-helper">{error.category || (entry.category && available.values.includes(entry.category) ? `Parent: ${available.parent}` : "Optional category")}</span></label>
                  <label className="tr-field"><span className="tr-field-label">Need / Want</span><select className={`tr-input ${error.needsWant ? "tr-invalid" : ""}`} value={entry.needsWant} aria-label={`Transaction ${index + 1} need or want`} aria-invalid={!!error.needsWant} onChange={event => update(entry.id, "needsWant", event.target.value as Entry["needsWant"])}><option value="na">N/A</option><option value="need">Need</option><option value="want">Want</option></select>{error.needsWant && <span className="tr-error-text">{error.needsWant}</span>}</label>
                  <label className="tr-field tr-recurring-field"><span className="tr-field-label">Recurring</span><span className="tr-check-control"><input type="checkbox" checked={entry.recurring} aria-label={`Transaction ${index + 1} recurring`} onChange={event => update(entry.id, "recurring", event.target.checked)} /><span>{entry.recurring ? "Yes" : "No"}</span></span></label>
                  <label className="tr-field"><span className="tr-field-label">Recurring type</span><select className={`tr-input ${error.recurringType ? "tr-invalid" : ""}`} value={entry.recurringType} aria-label={`Transaction ${index + 1} recurring type`} aria-invalid={!!error.recurringType} disabled={!entry.recurring} onChange={event => update(entry.id, "recurringType", event.target.value)}><option value="">Choose type</option><option value="subscription">Subscription</option><option value="recurring_bill">Recurring bill</option></select><span className={error.recurringType ? "tr-error-text" : "tr-field-helper"}>{error.recurringType || (entry.recurring ? "Choose the matching schedule" : "Enable recurring first")}</span></label>
                  <FieldControl label="Notes" value={entry.notes} placeholder="Add a note" onChange={value => update(entry.id, "notes", value)} />
                  <div className="tr-field tr-source-field"><span className="tr-field-label">Source category</span><span className="tr-source-category" title={sourceCategory}>{sourceCategory}</span></div>
                </div>
              </details>
            </article>
          );
        })}
      </section>
      {!entries.length && <p className="tr-empty">No transactions remain. Add a row or discard this review.</p>}
      {entries.length >= 500 && <p className="tr-limit-note">Maximum of 500 transaction rows reached.</p>}
      <div className="tr-row-actions tr-row-actions-improved">
        <button type="button" className="tr-outline-button" onClick={add} disabled={entries.length >= 500}><Plus size={16} />Add transaction row</button>
        <button type="button" className="tr-quiet-button" onClick={() => setNotice("Review discarded. Choose another file to continue.")}>Discard review &amp; choose another file</button>
      </div>
      <footer className="tr-save-footer tr-save-footer-improved">
        <p>Category is optional. {excluded > 0 ? `${excluded} excluded ${excluded === 1 ? "row is" : "rows are"} ignored during validation and save.` : "Only selected, valid rows will be saved."}</p>
        <button type="button" className="tr-primary-button" disabled={checking || !selected.length || invalidCount > 0} onClick={() => setNotice(`Ready to save ${selected.length} selected ${selected.length === 1 ? "transaction" : "transactions"} in this preview.`)}>
          <FileCheck2 size={16} />Save {selected.length} selected {selected.length === 1 ? "transaction" : "transactions"}
        </button>
      </footer>
      <p className="tr-demo-note">Static preview · imported data is not transmitted or recorded.</p>
    </main>
  );
}
