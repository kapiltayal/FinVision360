import { useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle2, FileCheck2, LoaderCircle, Plus, RefreshCw,
  ShieldAlert, Trash2, Upload, Landmark, Database,
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
  {
    id: 1, include: true, date: "2025-02-18", description: "Market Street Grocers",
    merchant: "Market Street Grocers", amount: "84.36", type: "expense",
    category: "Groceries", needsWant: "need", recurring: false, recurringType: "",
    notes: "", sourceCategory: "Food & Dining", sourceId: "TXN-410882",
  },
  {
    id: 2, include: false, duplicate: { kind: "exact", reason: "Same amount and merchant on the same day as a recorded transaction.", account: "Everyday Checking · •• 4821" },
    date: "2025-02-17", description: "AMZN Mktp US*4D8K2", merchant: "Amazon", amount: "62.40",
    type: "expense", category: "Shopping", needsWant: "want", recurring: false, recurringType: "",
    notes: "Household storage bins", sourceCategory: "Online retail", sourceId: "TXN-410879",
  },
  {
    id: 3, include: false, duplicate: { kind: "stable", reason: "This transaction is already in your FinVision360 history.", account: "Everyday Checking · •• 4821" },
    date: "2025-02-16", description: "NORTHLIGHT ENERGY AUTOPAY", merchant: "Northlight Energy", amount: "118.72",
    type: "expense", category: "Utilities", needsWant: "need", recurring: true, recurringType: "recurring_bill",
    notes: "", sourceCategory: "Utilities", sourceId: "TXN-410861",
  },
  {
    id: 4, include: true, date: "2025-02-15", description: "Payroll deposit — February", merchant: "Cedar & Stone Studio",
    amount: "2,840.00", type: "income", category: "Salary", needsWant: "na", recurring: true,
    recurringType: "recurring_bill", notes: "Biweekly pay", sourceCategory: "Direct deposit",
  },
];

const categoryOptions: Record<Entry["type"], { parent: string; values: string[] }> = {
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
  if (entry.category && !categoryOptions[entry.type].values.includes(entry.category)) errors.category = "Choose a category for this transaction type.";
  if (entry.needsWant !== "need" && entry.needsWant !== "want" && entry.needsWant !== "na") errors.needsWant = "Choose need, want, or N/A.";
  if (entry.recurring && entry.recurringType !== "subscription" && entry.recurringType !== "recurring_bill") errors.recurringType = "Choose a recurring type.";
  return errors;
}

function DuplicateNotice({ entry, index }: { entry: Entry; index: number }) {
  if (!entry.duplicate) {
    return <span className="tr-status tr-status-good"><CheckCircle2 aria-hidden="true" />No match found</span>;
  }
  const stable = entry.duplicate.kind === "stable";
  const label = stable ? "Already imported" : "Possible duplicate";
  const heading = stable ? "Already imported · locked" : entry.duplicate.kind === "exact" ? "Possible exact duplicate" : "Possible duplicate";
  return (
    <span className="tr-match">
      <button type="button" className={`tr-status ${stable ? "tr-status-locked" : "tr-status-warn"}`} aria-describedby={`current-match-${index}`}>
        {stable ? <ShieldAlert aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}{label}
      </button>
      <span className="tr-tooltip" role="tooltip" id={`current-match-${index}`}>
        <strong>{heading}</strong><span>{entry.duplicate.reason}</span>
        {entry.duplicate.account && <span>Account: {entry.duplicate.account}</span>}
      </span>
    </span>
  );
}

export function Current() {
  const [entries, setEntries] = useState<Entry[]>(startingEntries);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = useMemo(() => entries.filter(entry => entry.include && entry.duplicate?.kind !== "stable"), [entries]);
  const invalidCount = selected.filter(entry => Object.keys(validateEntry(entry)).length > 0).length;
  const excluded = entries.length - selected.length;
  const possibleCount = entries.filter(entry => entry.duplicate && entry.duplicate.kind !== "stable").length;
  const stableCount = entries.filter(entry => entry.duplicate?.kind === "stable").length;

  const change = (id: number, field: Field | "include", value: string | boolean) => {
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, [field]: value } as Entry : entry));
    setNotice("");
  };
  const addEntry = () => setEntries(current => current.length >= 500 ? current : [...current, {
    id: Math.max(0, ...current.map(entry => entry.id)) + 1, include: true, date: "", description: "",
    merchant: "", amount: "", type: "expense", category: "", needsWant: "na", recurring: false,
    recurringType: "", notes: "", sourceCategory: "",
  }]);
  const removeEntry = (id: number) => setEntries(current => current.filter(entry => entry.id !== id));
  const recheck = () => {
    setChecking(true);
    setNotice("");
    window.setTimeout(() => { setChecking(false); setNotice("Match check complete. Review any flagged rows before saving."); }, 650);
  };

  const fieldInput = (entry: Entry, index: number, field: "date" | "description" | "merchant" | "amount" | "notes", placeholder: string) => {
      const error = validateEntry(entry)[field as "date" | "description" | "amount"];
      const invalid = !!error;
    return (
      <td className="tr-cell tr-edit-cell" key={field}>
        <input
          type="text"
          inputMode={field === "amount" ? "decimal" : undefined}
          className={`tr-input ${invalid && entry.include ? "tr-invalid" : ""}`}
          value={entry[field]}
          placeholder={placeholder}
          aria-label={`Transaction ${index + 1} ${field}`}
          aria-invalid={invalid && entry.include}
          onChange={event => change(entry.id, field, event.target.value)}
        />
        {invalid && entry.include && <span className="tr-error-text">{error}</span>}
      </td>
    );
  };

  return (
    <main className="tr-sandbox tr-modal tr-current" data-testid="transaction-file-review">
      <div className="tr-dialog-heading">
        <div className="tr-heading-icon"><Database size={17} aria-hidden="true" /></div>
        <div>
          <h1>Add Transactions</h1>
          <p>Enter a transaction, upload a file, or import activity from a connected account.</p>
        </div>
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

      <section className="tr-info-panel">
        <div className="tr-info-copy">
          <p className="tr-eyebrow">Review before recording</p>
          <h2>Nothing is saved yet</h2>
          <p className="tr-file-name">checking_activity_feb_2025.csv</p>
          <p className="tr-guidance">Check every movement before it enters your cash flow. Similar charges start excluded; keep one only when you recognize it as a separate real transaction.</p>
          <p className="tr-blank-note">1 completely blank row was left out.</p>
        </div>
        <div className="tr-summary-counts" aria-label="Transaction counts">
          <div><strong>{entries.length}</strong><span>rows</span></div><div><strong>{selected.length}</strong><span>selected</span></div>
        </div>
      </section>

      <section className="tr-duplicate-summary" aria-label="Duplicate summary">
        <strong>Duplicate review</strong>
        <span className="tr-summary-warn">{possibleCount} similar charges · excluded by default</span>
        <span className="tr-summary-locked">{stableCount} already imported · cannot be kept</span>
        <span className="tr-summary-muted">{excluded} excluded from save</span>
        <button type="button" className="tr-quiet-button tr-recheck" onClick={recheck} disabled={checking}>
          {checking ? <LoaderCircle className="tr-spin" size={14} /> : <RefreshCw size={14} />} Recheck matches
        </button>
      </section>

      {invalidCount > 0 && <p className="tr-inline-alert tr-alert-warn" role="status"><AlertCircle size={16} />{invalidCount} selected {invalidCount === 1 ? "row needs" : "rows need"} attention. Excluded rows will not block saving.</p>}
      {checking && <p className="tr-inline-alert tr-alert-muted" role="status"><LoaderCircle className="tr-spin" size={14} />Confirming duplicate matches… Saving is paused until this finishes.</p>}
      {notice && <p className="tr-inline-alert tr-alert-muted" role="status">{notice}</p>}

      <div className="tr-table-scroll" aria-label="Editable transaction preview">
        <table className="tr-wide-table">
          <caption className="tr-sr-only">Editable preview of transactions from checking_activity_feb_2025.csv</caption>
          <thead>
            <tr>
              <th scope="col" className="tr-sticky-left tr-number-col">#</th><th scope="col">Save?</th><th scope="col">Match check</th>
              <th scope="col">Date *</th><th scope="col">Description *</th><th scope="col">Merchant</th><th scope="col">Amount *</th>
              <th scope="col">Type *</th><th scope="col">Category</th><th scope="col">Need / Want</th><th scope="col">Recurring</th>
              <th scope="col">Recurring type</th><th scope="col">Notes</th><th scope="col">Source category</th>
              <th scope="col" className="tr-sticky-right tr-remove-col"><span className="tr-sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const locked = entry.duplicate?.kind === "stable";
              const included = entry.include && !locked;
              const error = validateEntry(entry);
              const parent = categoryOptions[entry.type].parent;
              const categoryList = categoryOptions[entry.type].values;
              const sourceCategory = (entry.sourceCategory && entry.sourceCategory !== entry.category) || (entry.category && !categoryList.includes(entry.category)) ? entry.sourceCategory || entry.category : "—";
              return (
                <tr key={entry.id} className={`${locked ? "tr-row-locked" : included ? "" : "tr-row-excluded"} ${included && Object.keys(error).length > 0 ? "tr-row-invalid" : ""}`}>
                  <th scope="row" className="tr-sticky-left tr-row-number">{index + 1}{included && Object.keys(error).length > 0 && <AlertCircle size={13} aria-label="Needs review" />}</th>
                  <td className="tr-cell">
                    <label className={`tr-include ${locked ? "tr-disabled" : ""}`}>
                      <input type="checkbox" checked={included} disabled={locked || checking} aria-label={`Include transaction ${index + 1} in import`} onChange={event => change(entry.id, "include", event.target.checked)} />
                      <span><strong>{locked ? "Already imported" : included ? "Selected" : "Excluded"}</strong>
                      {(locked || !included) && <small>{locked ? "Cannot be saved again." : "Select to save this record."}</small>}</span>
                    </label>
                    {entry.sourceId && <small className="tr-source-id" title={`Source transaction ID: ${entry.sourceId}`}>Source ID: {entry.sourceId}</small>}
                  </td>
                  <td className="tr-cell"><DuplicateNotice entry={entry} index={index} /></td>
                  {fieldInput(entry, index, "date", "YYYY-MM-DD")}
                  {fieldInput(entry, index, "description", "Description")}
                  {fieldInput(entry, index, "merchant", "Merchant")}
                  {fieldInput(entry, index, "amount", "0.00")}
                  <td className="tr-cell">
                    <select className={`tr-input ${error.type ? "tr-invalid" : ""}`} value={entry.type} aria-label={`Transaction ${index + 1} type`} aria-invalid={!!error.type} onChange={event => change(entry.id, "type", event.target.value as Entry["type"])}>
                      <option value="expense">Expense</option><option value="income">Income</option>
                    </select>
                    {error.type && <span className="tr-error-text">{error.type}</span>}
                  </td>
                  <td className="tr-cell">
                    <select className={`tr-input tr-category-select ${error.category ? "tr-invalid" : ""}`} value={entry.category} aria-label={`Transaction ${index + 1} category`} aria-invalid={!!error.category} onChange={event => change(entry.id, "category", event.target.value)}>
                      <option value="">Unassigned (optional)</option>{categoryList.map(category => <option key={category} value={category}>{parent} · {category}</option>)}
                    </select>
                    {entry.category && categoryList.includes(entry.category) && <small className="tr-helper-text">Parent: {parent}</small>}
                    {error.category && <span className="tr-error-text">{error.category}</span>}
                  </td>
                  <td className="tr-cell"><select className={`tr-input ${error.needsWant ? "tr-invalid" : ""}`} value={entry.needsWant} aria-label={`Transaction ${index + 1} need or want`} aria-invalid={!!error.needsWant} onChange={event => change(entry.id, "needsWant", event.target.value as Entry["needsWant"])}><option value="na">N/A</option><option value="need">Need</option><option value="want">Want</option></select>{error.needsWant && <span className="tr-error-text">{error.needsWant}</span>}</td>
                  <td className="tr-cell"><label className="tr-recurring"><input type="checkbox" checked={entry.recurring} aria-label={`Transaction ${index + 1} recurring`} onChange={event => change(entry.id, "recurring", event.target.checked)} /><span>{entry.recurring ? "Yes" : "No"}</span></label></td>
                  <td className="tr-cell"><select className={`tr-input ${error.recurringType ? "tr-invalid" : ""}`} value={entry.recurringType} aria-label={`Transaction ${index + 1} recurring type`} aria-invalid={!!error.recurringType} disabled={!entry.recurring} onChange={event => change(entry.id, "recurringType", event.target.value)}><option value="">Choose type</option><option value="subscription">Subscription</option><option value="recurring_bill">Recurring bill</option></select>{error.recurringType && <span className="tr-error-text">{error.recurringType}</span>}</td>
                  {fieldInput(entry, index, "notes", "Notes")}
                  <td className="tr-cell"><span className="tr-source-category" title={sourceCategory}>{sourceCategory}</span></td>
                  <td className="tr-sticky-right tr-remove-cell"><button type="button" className="tr-icon-button" aria-label={`Remove transaction ${index + 1}`} onClick={() => removeEntry(entry.id)}><Trash2 size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!entries.length && <p className="tr-empty">No transactions remain. Add a row or discard this review.</p>}
      {entries.length >= 500 && <p className="tr-limit-note">Maximum of 500 transaction rows reached.</p>}

      <div className="tr-row-actions">
        <button type="button" className="tr-outline-button" onClick={addEntry} disabled={entries.length >= 500}><Plus size={16} />Add transaction row</button>
        <button type="button" className="tr-quiet-button" onClick={() => setNotice("Review discarded. Choose another file to continue.")}>Discard review &amp; choose another file</button>
      </div>
      <footer className="tr-save-footer">
        <p>Category is optional. {excluded > 0 ? `${excluded} excluded ${excluded === 1 ? "row is" : "rows are"} ignored during validation and save.` : "Only selected, valid rows will be saved."}</p>
        <button type="button" className="tr-primary-button" disabled={checking || !selected.length || invalidCount > 0} onClick={() => setNotice(`Ready to save ${selected.length} selected ${selected.length === 1 ? "transaction" : "transactions"} in this preview.`)}>
          <FileCheck2 size={16} />Save {selected.length} selected {selected.length === 1 ? "transaction" : "transactions"}
        </button>
      </footer>
      <p className="tr-demo-note">Static preview · imported data is not transmitted or recorded.</p>
    </main>
  );
}
