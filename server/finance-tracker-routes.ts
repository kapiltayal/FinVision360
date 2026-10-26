import { pool } from "./db";
import { requireAuth } from "./auth";
import type { Express } from "express";
import type { Transaction as PlaidTransaction } from "plaid";
import { getPlaidClient } from "./plaid";
import { storage } from "./storage";
import { isHistoricalBudgetMonth, normalizeBudgetCategory } from "../shared/budget-period";
import { budgetEntityMetadata, legacyBudgetClose, preserveSavedEntityRows, type BudgetSnapshot } from "./budget-history";
import multer from "multer";
import { parseTransactionUpload } from "./asset-liability-ingestion";
import type { TransactionImportPreview, TransactionImportResult } from "../shared/transaction-import";
import {
  isBlankTransactionSourceRow,
  knownMerchantCategory,
  transactionEntryFromSource,
  validateReviewedTransactionEntries,
  type CategoryMerchant,
} from "./transaction-import";
import { buildMerchantCatalog } from "./merchant-matching";
import { identifyTransactionBatch, loadIdentificationContext, matchSourceCategory } from "./transaction-identification";
import { checkUserTransactionDuplicates, ImportConflict, saveDuplicateSafeImport, validDuplicateReview } from "./transaction-duplicates";
import { detectAndMarkRecurring, detectPreviewRecurrence } from "./recurrence-ingestion";
import { plaidRecurrenceSignal, plaidStreamSignals } from "./plaid-recurrence";
import type { RecurrenceTags } from "./recurring-transactions";
import { formatSafeApiError, getSafeApiRoutePath } from "./api-logging";
import { RECURRING_FREQUENCIES, type RecurringFrequency } from "@shared/schema";

const transactionUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const CORRUPT_TRANSACTION_FILE = "File content could not be read or appears corrupted.";
const INVALID_TRANSACTION_FILE_TYPE = "File type is not supported or does not match its contents.";
const UNASSIGNED_TRANSACTION_CATEGORY = "unassigned";
function isRecurringFrequency(value: unknown): value is RecurringFrequency {
  return typeof value === "string" && (RECURRING_FREQUENCIES as readonly string[]).includes(value);
}
type CanonicalTransactionCategory = {
  id: number;
  type: string; parentCategory: string; category: string; needVsWant: string | null; description: string;
  storedCategory: string; storedParentCategory: string;
};

function categoryKey(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") : "";
}
async function canonicalTransactionCategories(): Promise<CanonicalTransactionCategory[]> {
  const { rows } = await pool.query(
    `SELECT id, type, parent_category, category, need_vs_want, description FROM transaction_type_list ORDER BY type, parent_category, category`,
  );
  return rows.map((row) => ({
    id: Number(row.id), type: String(row.type), parentCategory: String(row.parent_category), category: String(row.category),
    needVsWant: row.need_vs_want ? String(row.need_vs_want) : null, description: String(row.description),
    // Values persisted to transactions are the authoritative DB labels.
    // categoryKey is strictly an input compatibility/matching concern.
    storedCategory: String(row.category), storedParentCategory: String(row.parent_category),
  }));
}
async function knownCategoryMerchants() {
  const { rows } = await pool.query<CategoryMerchant>("SELECT id, name, category_id FROM merchants");
  return buildMerchantCatalog(rows);
}
function supportedTransactionFile(file: Express.Multer.File): boolean {
  const ext = file.originalname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const allowed: Record<string, string[]> = {
    csv: ["text/csv", "application/csv", "text/plain"], tsv: ["text/tab-separated-values", "text/tsv", "text/plain"],
    txt: ["text/plain", "text/csv", "text/tab-separated-values"], xls: ["application/vnd.ms-excel"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  };
  if (!ext || !allowed[ext]?.includes(file.mimetype.toLowerCase())) return false;
  if (ext === "xls") return file.buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
  if (ext === "xlsx") return file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  return file.buffer.length > 0 && !file.buffer.includes(0);
}
function transactionUploadFile(req: any, res: any, next: any) {
  transactionUpload.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "File is too large. Maximum file size is 5 MiB." });
    if (error) return res.status(400).json({ message: CORRUPT_TRANSACTION_FILE });
    next();
  });
}

function categoryForInput(
  categories: CanonicalTransactionCategory[], type: "income" | "expense", value: unknown, parentValue?: unknown,
): CanonicalTransactionCategory | undefined {
  const key = categoryKey(value);
  const parent = categoryKey(parentValue);
  if (!key) return undefined;
  return categories.find((item) => item.type.toLowerCase() === type &&
    categoryKey(item.category) === key &&
    (!parent || categoryKey(item.parentCategory) === parent));
}
function isNeedWant(value: unknown): value is "need" | "want" | "na" {
  return value === "need" || value === "want" || value === "na";
}
const legacyCategoryAliases: Record<string, string> = {
  salary: "salary_wages", business: "business_income", bonus: "bonuses_commissions",
  freelance: "freelance_consulting", dividend: "dividends", rental: "rental_income",
  capital_gains: "capital_gains", refund: "refunds", gift: "gifts", housing: "housing_rent",
  dining_out: "dining_out", debt_payment: "debt_payment", other_expense: "other_expense",
};
function deterministicTransactionCategory(
  categories: CanonicalTransactionCategory[], description: string, type: "income" | "expense",
): CanonicalTransactionCategory | undefined {
  const automatic = autoCategorizeFn(description, type);
  return categoryForInput(categories, type, legacyCategoryAliases[automatic.subcategory] || automatic.subcategory);
}
type MerchantCategoryPreferences = Map<string, CanonicalTransactionCategory>;

function merchantCategoryKey(type: unknown, merchant: unknown, description: unknown): string {
  if (type !== "income" && type !== "expense") return "";
  const normalized = normalizeMerchant(String(merchant || description || ""));
  return normalized ? `${type}:${normalized}` : "";
}

async function userMerchantCategoryPreferences(
  userId: string,
  categories: CanonicalTransactionCategory[],
): Promise<MerchantCategoryPreferences> {
  const { rows } = await pool.query(
    `SELECT t.merchant, t.description, t.type, t.parent_category, t.subcategory,
            t.source, t.updated_at,
            EXISTS (
              SELECT 1
              FROM transaction_change_history h
              WHERE h.user_id = t.user_id
                AND h.transaction_id = t.id
                AND h.field IN ('subcategory', 'parent_category')
            ) AS category_was_edited
     FROM transactions t
     WHERE t.user_id = $1
       AND t.subcategory IS NOT NULL
       AND t.subcategory <> $2
       AND (
         t.source = 'manual'
         OR EXISTS (
           SELECT 1
           FROM transaction_change_history h
           WHERE h.user_id = t.user_id
             AND h.transaction_id = t.id
             AND h.field IN ('subcategory', 'parent_category')
         )
       )
     ORDER BY category_was_edited DESC, (t.source = 'manual') DESC, t.updated_at DESC, t.id DESC`,
    [userId, UNASSIGNED_TRANSACTION_CATEGORY],
  );
  const preferences: MerchantCategoryPreferences = new Map();
  for (const row of rows) {
    const type = row.type === "income" || row.type === "expense" ? row.type : undefined;
    if (!type) continue;
    const key = merchantCategoryKey(type, row.merchant, row.description);
    if (!key || preferences.has(key)) continue;
    const selected = categoryForInput(categories, type, row.subcategory, row.parent_category);
    if (selected) preferences.set(key, selected);
  }
  return preferences;
}

function categoryFromMerchantPreference(
  preferences: MerchantCategoryPreferences,
  row: { type?: unknown; merchant?: unknown; description?: unknown },
): CanonicalTransactionCategory | undefined {
  const key = merchantCategoryKey(row.type, row.merchant, row.description);
  return key ? preferences.get(key) : undefined;
}

function normalizeTransactionDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
  const us = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T].*)?$/);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] :
    us ? [Number(us[3]), Number(us[1]), Number(us[2])] : null;
  if (!parts) return null;
  const [year, month, day] = parts;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
    ? `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}` : null;
}

function normalizeDateValue(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return null;
}

function startOfPeriod(dateValue: string, groupBy: string): Date {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (groupBy === "day") return date;
  if (groupBy === "week") {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return date;
  }
  if (groupBy === "year") {
    return new Date(Date.UTC(year, 0, 1));
  }
  return new Date(Date.UTC(year, month - 1, 1));
}

function advancePeriod(date: Date, groupBy: string): Date {
  const next = new Date(date);
  if (groupBy === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (groupBy === "week") next.setUTCDate(next.getUTCDate() + 7);
  else if (groupBy === "year") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ─── AUTO-CATEGORIZATION ENGINE ──────────────────────────────────────────────
function autoCategorizeFn(
  description: string,
  type: "income" | "expense"
): { subcategory: string; needsWant: "need" | "want" | "na" | null } {
  const d = description.toLowerCase();

  if (type === "income") {
    if (/salary|payroll|direct dep|wage(s)?|pay stub/.test(d)) return { subcategory: "salary", needsWant: "na" };
    if (/bonus/.test(d)) return { subcategory: "bonus", needsWant: "na" };
    if (/freelance|consulting|contract work|upwork|fiverr/.test(d)) return { subcategory: "freelance", needsWant: "na" };
    if (/dividend|distribution/.test(d)) return { subcategory: "dividend", needsWant: "na" };
    if (/\binterest\b|apy|savings yield/.test(d)) return { subcategory: "interest", needsWant: "na" };
    if (/rental income|rent received|tenant/.test(d)) return { subcategory: "rental", needsWant: "na" };
    if (/capital gain|stock sale|security sold/.test(d)) return { subcategory: "capital_gains", needsWant: "na" };
    if (/refund|cash ?back|rebate/.test(d)) return { subcategory: "refund", needsWant: "na" };
    if (/business income|revenue|invoice/.test(d)) return { subcategory: "business", needsWant: "na" };
    if (/gift|zelle|venmo|cash ?app|paypal/.test(d)) return { subcategory: "gift", needsWant: "na" };
    return { subcategory: "unassigned", needsWant: "na" };
  }

  // expense rules (ordered by specificity)
  if (/mortgage|rent(?! received)|hoa fee|property tax|homeowners|\bhouse\b/.test(d)) return { subcategory: "housing", needsWant: "need" };
  if (/electric|gas bill|water bill|internet|broadband|at&t|verizon|t-mobile|comcast|xfinity|spectrum|pge|con ?ed|energy/.test(d)) return { subcategory: "utilities", needsWant: "need" };
  if (/grocery|groceries|whole foods|trader joe|costco|kroger|safeway|aldi|publix|wegmans|food lion|sprouts|supermarket/.test(d)) return { subcategory: "groceries", needsWant: "need" };
  if (/^uber$|lyft|gas station|shell |chevron|bp |exxon|mobil |sunoco|marathon gas|parking|transit|metro |mta |bart|caltrain|auto loan|car payment/.test(d)) return { subcategory: "transportation", needsWant: "need" };
  if (/restaurant|doordash|grubhub|uber eats|ubereats|mcdonald|starbucks|chipotle|pizza|taco |burger|diner|cafe |bistro|sushi|thai food|chinese food/.test(d)) return { subcategory: "dining_out", needsWant: "want" };
  if (/netflix|hulu|disney[\+ ]|hbo |max\b|peacock|paramount\+|showtime|amc\+|movie theater|cinema|concert|ticketmaster|live nation|apple music|tidal|pandora|\bfun\b/.test(d)) return { subcategory: "entertainment", needsWant: "want" };
  if (/pharmacy|cvs |walgreens|rite aid|hospital|clinic |doctor|dental|vision care|healthcare|medical |urgent care|labcorp|quest diag/.test(d)) return { subcategory: "healthcare", needsWant: "need" };
  if (/insurance|geico|progressive|allstate|state farm|nationwide|aaa |usaa/.test(d)) return { subcategory: "insurance", needsWant: "need" };
  if (/tuition|university|college|udemy|coursera|skillshare|student loan|khan academy/.test(d)) return { subcategory: "education", needsWant: "need" };
  if (/\bamazon\b(?! web)|ebay|\btarget\b|best buy|nordstrom|macy|gap\b|zara|h&m|etsy|wayfair|ikea|home depot|lowe's|costco/.test(d)) return { subcategory: "shopping", needsWant: "want" };
  if (/spotify|icloud|google one|adobe |microsoft 365|office 365|dropbox|gym membership|planet fitness|equinox|crunch fitness|prime membership|subscription/.test(d)) return { subcategory: "subscriptions", needsWant: "want" };
  if (/salon|barber|spa |beauty supply|nail |hair cut|hair salon/.test(d)) return { subcategory: "personal_care", needsWant: "want" };
  if (/airline|hotel|airbnb|expedia|marriott|hilton|hyatt|delta air|southwest air|united air|american air|jetblue|booking\.com|vrbo/.test(d)) return { subcategory: "travel", needsWant: "want" };
  if (/credit card payment|card payment|loan payment|student loan payment/.test(d)) return { subcategory: "debt_payment", needsWant: "need" };
  if (/\bvanguard\b|fidelity\b|schwab\b|etf purchase|mutual fund|stock purchase|robinhood|coinbase|amazon web services|aws /.test(d)) return { subcategory: "investment", needsWant: "na" };
  if (/\birs\b|income tax|state tax|property tax|tax payment|tax withholding/.test(d)) return { subcategory: "taxes", needsWant: "need" };
  if (/transfer to savings|savings deposit|savings transfer|high yield savings/.test(d)) return { subcategory: "savings_transfer", needsWant: "need" };

  return { subcategory: "unassigned", needsWant: null };
}

function categorizePlaidTransaction(
  transaction: PlaidTransaction,
  description: string,
  type: "income" | "expense"
): { subcategory: string; needsWant: "need" | "want" | "na" | null } {
  // Only provider-supplied category information belongs at the source-category step.
  // Descriptor guesses must not bypass the common AI fallback.
  const fallback = { subcategory: "unassigned", needsWant: "na" as const };
  const primary = transaction.personal_finance_category?.primary?.toUpperCase() ?? "";
  const detailed = transaction.personal_finance_category?.detailed?.toUpperCase() ?? "";

  if (type === "income") {
    if (detailed.includes("WAGES")) return { subcategory: "salary", needsWant: "na" };
    if (detailed.includes("DIVIDEND")) return { subcategory: "dividend", needsWant: "na" };
    if (detailed.includes("INTEREST_EARNED")) return { subcategory: "interest", needsWant: "na" };
    if (detailed.includes("TAX_REFUND") || detailed.includes("REFUND")) return { subcategory: "refund", needsWant: "na" };
    if (primary === "INCOME") {
      return { subcategory: "other_income", needsWant: "na" };
    }
    return fallback;
  }

  if (primary === "RENT_AND_UTILITIES") {
    return detailed.includes("RENT") || detailed.includes("MORTGAGE")
      ? { subcategory: "housing", needsWant: "need" }
      : { subcategory: "utilities", needsWant: "need" };
  }
  if (primary === "FOOD_AND_DRINK") {
    return detailed.includes("GROCER")
      ? { subcategory: "groceries", needsWant: "need" }
      : { subcategory: "dining_out", needsWant: "want" };
  }

  const primaryMap: Record<string, { subcategory: string; needsWant: "need" | "want" | "na" | null }> = {
    ENTERTAINMENT: { subcategory: "entertainment", needsWant: "want" },
    TRANSPORTATION: { subcategory: "transportation", needsWant: "need" },
    MEDICAL: { subcategory: "healthcare", needsWant: "need" },
    PERSONAL_CARE: { subcategory: "personal_care", needsWant: "want" },
    TRAVEL: { subcategory: "travel", needsWant: "want" },
    GENERAL_MERCHANDISE: { subcategory: "shopping", needsWant: "want" },
    HOME_IMPROVEMENT: { subcategory: "housing", needsWant: "need" },
    LOAN_PAYMENTS: { subcategory: "debt_payment", needsWant: "need" },
    BANK_FEES: { subcategory: "other_expense", needsWant: "need" },
  };

  if (primaryMap[primary]) return primaryMap[primary];
  if (primary === "GOVERNMENT_AND_NON_PROFIT" && detailed.includes("TAX")) {
    return { subcategory: "taxes", needsWant: "need" };
  }

  return fallback;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}-01T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 7) === value;
}

function monthBounds(month: string): { startDate: string; endDate: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    startDate: `${month}-01`,
    endDate: isoDate(new Date(Date.UTC(year, monthNumber, 0))),
  };
}

function budgetPlanMonthRange(): { firstMonth: string; lastMonth: string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 11, 1));
  return {
    firstMonth: isoDate(first).slice(0, 7),
    lastMonth: isoDate(last).slice(0, 7),
  };
}

function isAllowedBudgetPlanMonth(value: unknown): value is string {
  if (!isValidMonth(value)) return false;
  const { firstMonth, lastMonth } = budgetPlanMonthRange();
  return value >= firstMonth && value <= lastMonth;
}

function isPlaidTransfer(transaction: PlaidTransaction): boolean {
  const primary = transaction.personal_finance_category?.primary?.toUpperCase() ?? "";
  const detailed = transaction.personal_finance_category?.detailed?.toUpperCase() ?? "";
  return primary === "TRANSFER_IN"
    || primary === "TRANSFER_OUT"
    || detailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT";
}

// ─── RECURRING DETECTION ENGINE ──────────────────────────────────────────────
function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/\*+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

// ─── ROUTE REGISTRATION ───────────────────────────────────────────────────────
export function registerFinanceTrackerRoutes(app: Express) {
  const logRouteFailure = (req: any, error: unknown) => {
    console.error(formatSafeApiError(getSafeApiRoutePath(req?.route?.path), error));
  };

  // Canonical selectable categories.  Display labels remain DB-owned while the
  // storage keys are deliberately lowercase to match existing transactions.
  app.get("/api/transaction-categories", requireAuth, async (_req, res) => {
    try {
      res.json(await canonicalTransactionCategories());
    } catch (error) {
      logRouteFailure(_req, error);
      res.status(500).json({ message: "Failed to fetch transaction categories" });
    }
  });
  // GET /api/budget-plan — saved plan plus source data for one calendar month
  app.get("/api/budget-plan", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const month = req.query.month;
      if (!isAllowedBudgetPlanMonth(month)) {
        return res.status(400).json({ message: "Budget month must be within the previous 12 months or next 11 months" });
      }

      const { startDate, endDate } = monthBounds(month);
      const [
        { rows: planRows },
        { rows: actualRows },
      ] = await Promise.all([
        pool.query(
          `SELECT plan_key, planned_amount, entity_metadata
           FROM budget_plans
           WHERE user_id = $1 AND month = $2::date
           ORDER BY plan_key`,
          [userId, startDate],
        ),
        pool.query(
          `SELECT type, COALESCE(NULLIF(subcategory, ''), 'unassigned') AS subcategory,
                  COALESCE(SUM(amount), 0) AS actual_amount
           FROM transactions
           WHERE user_id = $1 AND date >= $2::date AND date <= $3::date
           GROUP BY type, COALESCE(NULLIF(subcategory, ''), 'unassigned')
           ORDER BY type, subcategory`,
          [userId, startDate, endDate],
        ),
      ]);
      const plans = planRows.map((row) => ({
        planKey: row.plan_key, plannedAmount: Number(row.planned_amount), entityMetadata: row.entity_metadata,
      }));
      if (isHistoricalBudgetMonth(month)) {
        const actualsByKey = new Map<string, { type: string; category: string; amount: number }>();
        for (const row of actualRows) {
          const category = normalizeBudgetCategory(row.subcategory);
          const key = `${row.type}:${category}`;
          const previous = actualsByKey.get(key);
          actualsByKey.set(key, {
            type: row.type, category, amount: (previous?.amount ?? 0) + Number(row.actual_amount),
          });
        }
        const actuals = Array.from(actualsByKey.values());
        const normalizedSavedPlans = new Map<string, (typeof plans)[number]>();
        for (const row of plans) {
          const key = row.planKey.startsWith("income:") || row.planKey.startsWith("expense:")
            ? `${row.planKey.slice(0, row.planKey.indexOf(":"))}:${normalizeBudgetCategory(row.planKey.slice(row.planKey.indexOf(":") + 1))}`
            : row.planKey;
          const previous = normalizedSavedPlans.get(key);
          normalizedSavedPlans.set(key, {
            planKey: key,
            plannedAmount: (previous?.plannedAmount ?? 0) + row.plannedAmount,
            entityMetadata: row.entityMetadata,
          });
        }
        const historicalPlans = Array.from(normalizedSavedPlans.values());
        const { rows: closes } = await pool.query(
          "SELECT snapshot_at, payload FROM budget_month_closes WHERE user_id=$1 AND period_month=$2::date",
          [userId, startDate],
        );
        const close = closes[0];
        const legacy = close ? null : await legacyBudgetClose(pool, userId, month);
        const historical = close
          ? preserveSavedEntityRows(close.payload as BudgetSnapshot)
          : legacy?.payload ?? preserveSavedEntityRows({ plans: historicalPlans, liabilities: [], goals: [] });
        return res.json({
          month, readOnly: true, ...historical, actuals,
          snapshot: {
            status: close
              ? close.payload?.source === "legacy_reconstructed" ? "legacy" : "complete"
              : legacy ? "legacy" : "unavailable",
            periodMonth: month,
            capturedAt: close?.snapshot_at ?? legacy?.capturedAt ?? null,
          },
        });
      }
      const actuals = actualRows.map((row) => ({
        type: row.type, category: row.subcategory, amount: Number(row.actual_amount),
      }));
      const [{ rows: liabilityRows }, { rows: goalRows }] = await Promise.all([
        pool.query(
          `SELECT id, name, category, balance, minimum_payment
           FROM liabilities
           WHERE user_id = $1
           ORDER BY balance::numeric DESC, name`,
          [userId],
        ),
        pool.query(
          `SELECT id, title, category, target_amount, current_amount, target_date
           FROM goal_funding
           WHERE user_id = $1
           ORDER BY target_date NULLS LAST, title`,
          [userId],
        ),
      ]);

      return res.json({
        month,
        readOnly: false,
        snapshot: null,
        plans: planRows.map((row) => ({
          planKey: row.plan_key,
          plannedAmount: Number(row.planned_amount),
        })),
        actuals: actualRows.map((row) => ({
          type: row.type,
          category: row.subcategory,
          amount: Number(row.actual_amount),
        })),
        liabilities: liabilityRows.map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          balance: Number(row.balance),
          minimumPayment: Number(row.minimum_payment ?? 0),
        })),
        goals: goalRows.map((row) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          targetAmount: Number(row.target_amount),
          currentAmount: Number(row.current_amount),
          targetDate: normalizeDateValue(row.target_date),
        })),
      });
    } catch (error) {
      logRouteFailure(req, error);
      return res.status(500).json({ message: "Failed to load the monthly budget plan" });
    }
  });

  // PUT /api/budget-plan/bulk — atomically create or update multiple monthly plan lines
  app.put("/api/budget-plan/bulk", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { month, plans } = req.body ?? {};
      if (!isAllowedBudgetPlanMonth(month)) {
        return res.status(400).json({ message: "Budget month must be within the previous 12 months or next 11 months" });
      }
      if (isHistoricalBudgetMonth(month)) return res.status(403).json({ message: "Historical budget plans are read-only" });
      if (!Array.isArray(plans) || plans.length === 0 || plans.length > 100) {
        return res.status(400).json({ message: "Provide between 1 and 100 plan lines" });
      }

      const normalizedPlans = plans.map((plan) => ({
        plan_key: typeof plan?.planKey === "string" ? plan.planKey.trim() : "",
        planned_amount: Number(plan?.plannedAmount),
      }));
      const keys = new Set(normalizedPlans.map((plan) => plan.plan_key));
      const hasInvalidPlan = normalizedPlans.some(
        (plan) =>
          !plan.plan_key ||
          plan.plan_key.length > 250 ||
          !Number.isFinite(plan.planned_amount) ||
          plan.planned_amount < 0 ||
          plan.planned_amount > 999_999_999_999.99,
      );
      if (hasInvalidPlan || keys.size !== normalizedPlans.length) {
        return res.status(400).json({ message: "Every plan line must have a unique valid category and non-negative amount" });
      }
      const withMetadata = await Promise.all(normalizedPlans.map(async (plan) => ({
        ...plan, entity_metadata: await budgetEntityMetadata(pool, userId, plan.plan_key),
      })));

      const { rows } = await pool.query(
        `INSERT INTO budget_plans (user_id, month, plan_key, planned_amount, entity_metadata)
         SELECT $1, $2::date, item.plan_key, item.planned_amount, item.entity_metadata
         FROM jsonb_to_recordset($3::jsonb)
           AS item(plan_key text, planned_amount numeric, entity_metadata jsonb)
         ON CONFLICT (user_id, month, plan_key)
         DO UPDATE SET planned_amount = EXCLUDED.planned_amount,
           entity_metadata = COALESCE(EXCLUDED.entity_metadata, budget_plans.entity_metadata), updated_at = NOW()
         RETURNING plan_key, planned_amount`,
        [userId, `${month}-01`, JSON.stringify(withMetadata)],
      );

      return res.json({
        plans: rows.map((row) => ({
          planKey: row.plan_key,
          plannedAmount: Number(row.planned_amount),
        })),
      });
    } catch (error) {
      logRouteFailure(req, error);
      return res.status(500).json({ message: "Failed to copy monthly averages to the budget plan" });
    }
  });

  // PUT /api/budget-plan — create or update one monthly plan line
  app.put("/api/budget-plan", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { month, planKey, plannedAmount } = req.body ?? {};
      if (!isAllowedBudgetPlanMonth(month)) {
        return res.status(400).json({ message: "Budget month must be within the previous 12 months or next 11 months" });
      }
      if (isHistoricalBudgetMonth(month)) return res.status(403).json({ message: "Historical budget plans are read-only" });
      const normalizedKey = typeof planKey === "string" ? planKey.trim() : "";
      const amount = Number(plannedAmount);
      if (!normalizedKey || normalizedKey.length > 250) {
        return res.status(400).json({ message: "A valid plan category is required" });
      }
      if (!Number.isFinite(amount) || amount < 0 || amount > 999_999_999_999.99) {
        return res.status(400).json({ message: "Planned amount must be a valid non-negative number" });
      }

      const { rows } = await pool.query(
        `INSERT INTO budget_plans (user_id, month, plan_key, planned_amount, entity_metadata)
         VALUES ($1, $2::date, $3, $4, $5::jsonb)
         ON CONFLICT (user_id, month, plan_key)
         DO UPDATE SET planned_amount = EXCLUDED.planned_amount,
           entity_metadata = COALESCE(EXCLUDED.entity_metadata, budget_plans.entity_metadata), updated_at = NOW()
         RETURNING plan_key, planned_amount`,
        [userId, `${month}-01`, normalizedKey, amount.toFixed(2), JSON.stringify(await budgetEntityMetadata(pool, userId, normalizedKey))],
      );

      return res.json({
        planKey: rows[0].plan_key,
        plannedAmount: Number(rows[0].planned_amount),
      });
    } catch (error) {
      logRouteFailure(req, error);
      return res.status(500).json({ message: "Failed to save the monthly budget plan" });
    }
  });

  // DELETE /api/budget-plan — remove one custom/saved line from a month
  app.delete("/api/budget-plan", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { month, planKey } = req.query;
      if (!isAllowedBudgetPlanMonth(month) || typeof planKey !== "string" || !planKey.trim()) {
        return res.status(400).json({ message: "A valid budget month and planKey are required" });
      }
      if (isHistoricalBudgetMonth(month)) return res.status(403).json({ message: "Historical budget plans are read-only" });
      const { rowCount } = await pool.query(
        `DELETE FROM budget_plans
         WHERE user_id = $1 AND month = $2::date AND plan_key = $3`,
        [userId, `${month}-01`, planKey.trim()],
      );
      if (!rowCount) return res.status(404).json({ message: "Budget plan not found" });
      return res.status(204).send();
    } catch (error) {
      logRouteFailure(req, error);
      return res.status(500).json({ message: "Failed to remove the budget plan line" });
    }
  });

  // GET /api/transactions/accounts — linked accounts represented in this user's transaction history
  app.get("/api/transactions/accounts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { rows } = await pool.query(
        `SELECT
           plaid_account_id,
           MAX(NULLIF(BTRIM(plaid_account_name), '')) AS plaid_account_name,
           MAX(NULLIF(BTRIM(plaid_institution_name), '')) AS plaid_institution_name
         FROM transactions
         WHERE user_id = $1 AND NULLIF(BTRIM(plaid_account_id), '') IS NOT NULL
         GROUP BY plaid_account_id
         ORDER BY
           MAX(NULLIF(BTRIM(plaid_institution_name), '')) NULLS LAST,
           MAX(NULLIF(BTRIM(plaid_account_name), '')) NULLS LAST`,
        [userId],
      );
      res.json(rows);
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to fetch transaction accounts" });
    }
  });

  // GET /api/transactions/filter-categories — this user's categories, regardless of current date/page filters
  app.get("/api/transactions/filter-categories", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { rows } = await pool.query(
        `SELECT type, parent_category, subcategory
         FROM (
           SELECT DISTINCT lower(type) AS type,
             NULLIF(BTRIM(parent_category), '') AS parent_category,
             subcategory
           FROM transactions
           WHERE user_id = $1 AND lower(type) IN ('income', 'expense')
         ) categories
         ORDER BY CASE type WHEN 'income' THEN 0 ELSE 1 END,
           parent_category NULLS FIRST, subcategory`,
        [userId],
      );
      res.json(rows);
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to fetch transaction filter categories" });
    }
  });

  // GET /api/transactions — list with optional filters
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const {
        startDate, endDate, type, subcategory, source, recurring, search, plaidAccountId,
        categoryType, categoryParent, categoryName,
      } = req.query as Record<string, string>;

      let sql = `SELECT * FROM transactions WHERE user_id = $1`;
      const params: any[] = [userId];
      let idx = 2;

      if (startDate) { sql += ` AND date >= $${idx++}`; params.push(startDate); }
      if (endDate) { sql += ` AND date <= $${idx++}`; params.push(endDate); }
      if (type) { sql += ` AND type = $${idx++}`; params.push(type); }
      if (subcategory) { sql += ` AND subcategory = $${idx++}`; params.push(subcategory); }
      if (categoryType && categoryName) {
        sql += ` AND type = $${idx++}`;
        params.push(categoryType);
        sql += ` AND subcategory = $${idx++}`;
        params.push(categoryName);
        if (categoryParent !== undefined) {
          sql += ` AND COALESCE(BTRIM(parent_category), '') = $${idx++}`;
          params.push(categoryParent);
        }
      }
      if (source) { sql += ` AND source = $${idx++}`; params.push(source); }
      if (recurring === "true") sql += ` AND is_recurring = TRUE`;
      if (search) { sql += ` AND description ILIKE $${idx++}`; params.push(`%${search}%`); }
      if (plaidAccountId) { sql += ` AND plaid_account_id = $${idx++}`; params.push(plaidAccountId); }

      sql += ` ORDER BY date DESC, created_at DESC`;

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // GET /api/transactions/stats
  app.get("/api/transactions/stats", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { startDate, endDate } = req.query as Record<string, string>;

      let where = `WHERE user_id = $1`;
      const params: any[] = [userId];
      let idx = 2;
      if (startDate) { where += ` AND date >= $${idx++}`; params.push(startDate); }
      if (endDate) { where += ` AND date <= $${idx++}`; params.push(endDate); }

      const { rows } = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0)  AS total_income,
           COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS total_expenses,
           COUNT(CASE WHEN subcategory='unassigned' THEN 1 END)             AS unassigned_count,
           COUNT(*)                                                          AS total_count,
           MIN(date)::DATE                                                   AS min_date,
           MAX(date)::DATE                                                   AS max_date
         FROM transactions ${where}`,
        params
      );
      res.json(rows[0]);
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // GET /api/transactions/monthly-averages — latest 12 complete calendar months
  app.get("/api/transactions/monthly-averages", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { rows: boundaryRows } = await pool.query(
        `SELECT
           MIN(DATE_TRUNC('month', date)::DATE) AS first_month,
           (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE AS end_month
         FROM transactions
         WHERE user_id = $1
           AND date < DATE_TRUNC('month', CURRENT_DATE)::DATE`,
        [userId],
      );

      const firstMonth = normalizeDateValue(boundaryRows[0]?.first_month);
      const endMonth = normalizeDateValue(boundaryRows[0]?.end_month);
      if (!firstMonth || !endMonth) {
        res.json({
          period: { startMonth: null, endMonth: null, months: 0 },
          averages: { income: 0, expenses: 0, net: 0, savingsRate: 0 },
          categories: [],
        });
        return;
      }

      const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
      const twelveMonthsAgo = new Date(Date.UTC(endYear, endMonthNumber - 12, 1));
      const twelveMonthStart = isoDate(twelveMonthsAgo);
      const startMonth = firstMonth > twelveMonthStart ? firstMonth : twelveMonthStart;
      const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
      const monthCount = (endYear - startYear) * 12 + (endMonthNumber - startMonthNumber) + 1;
      const endDate = isoDate(new Date(Date.UTC(endYear, endMonthNumber, 0)));

      const [{ rows }, { rows: monthlyRows }] = await Promise.all([
        pool.query(
          `SELECT
             type,
             COALESCE(NULLIF(subcategory, ''), 'unassigned') AS subcategory,
             COALESCE(SUM(amount), 0) AS total,
             COUNT(*) AS transaction_count
           FROM transactions
           WHERE user_id = $1
             AND date >= $2
             AND date <= $3
           GROUP BY type, COALESCE(NULLIF(subcategory, ''), 'unassigned')
           ORDER BY type, total DESC, subcategory ASC`,
          [userId, startMonth, endDate],
        ),
        pool.query(
          `SELECT
             DATE_TRUNC('month', date)::DATE AS month,
             type,
             COALESCE(NULLIF(subcategory, ''), 'unassigned') AS subcategory,
             COALESCE(SUM(amount), 0) AS amount
           FROM transactions
           WHERE user_id = $1
             AND date >= $2
             AND date <= $3
           GROUP BY month, type, COALESCE(NULLIF(subcategory, ''), 'unassigned')
           ORDER BY month ASC`,
          [userId, startMonth, endDate],
        ),
      ]);

      const periodMonths: string[] = [];
      for (
        let cursor = new Date(Date.UTC(startYear, startMonthNumber - 1, 1));
        cursor <= new Date(Date.UTC(endYear, endMonthNumber - 1, 1));
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
      ) {
        periodMonths.push(isoDate(cursor).slice(0, 7));
      }
      const monthlyAmounts = new Map(
        monthlyRows.map((row) => [
          `${row.type}:${row.subcategory || "unassigned"}:${normalizeDateValue(row.month)?.slice(0, 7)}`,
          Number(row.amount),
        ]),
      );

      const categories = rows.map((row) => ({
        type: row.type,
        subcategory: row.subcategory || "unassigned",
        total: Number(row.total),
        average: Number(row.total) / monthCount,
        transactionCount: Number(row.transaction_count),
        history: periodMonths.map((month) => ({
          month,
          amount: monthlyAmounts.get(`${row.type}:${row.subcategory || "unassigned"}:${month}`) ?? 0,
        })),
      }));
      const income = categories
        .filter((category) => category.type === "income")
        .reduce((sum, category) => sum + category.average, 0);
      const expenses = categories
        .filter((category) => category.type === "expense")
        .reduce((sum, category) => sum + category.average, 0);
      const net = income - expenses;

      res.json({
        period: { startMonth, endMonth, months: monthCount },
        averages: {
          income,
          expenses,
          net,
          savingsRate: income > 0 ? (net / income) * 100 : 0,
        },
        categories,
      });
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to calculate monthly transaction averages" });
    }
  });

  // GET /api/transactions/trend
  app.get("/api/transactions/trend", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { startDate, endDate, groupBy = "month" } = req.query as Record<string, string>;

      const allowed = ["day", "week", "month", "year"];
      const trunc = allowed.includes(groupBy) ? groupBy : "month";

      let where = `WHERE user_id = $1`;
      const params: any[] = [userId];
      let idx = 2;
      if (startDate) { where += ` AND date >= $${idx++}`; params.push(startDate); }
      if (endDate) { where += ` AND date <= $${idx++}`; params.push(endDate); }

      const [{ rows }, { rows: boundaryRows }] = await Promise.all([
        pool.query(
        `SELECT DATE_TRUNC('${trunc}', date)::DATE AS period,
                COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) AS income,
                COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses
         FROM transactions ${where}
         GROUP BY period ORDER BY period ASC`,
          params
        ),
        pool.query(
          `SELECT MIN(date)::DATE AS min_date, MAX(date)::DATE AS max_date
           FROM transactions ${where}`,
          params
        ),
      ]);

      const minDate = startDate || normalizeDateValue(boundaryRows[0]?.min_date);
      const maxDate = endDate || normalizeDateValue(boundaryRows[0]?.max_date);
      if (!minDate || !maxDate || minDate > maxDate) {
        res.json([]);
        return;
      }

      const firstPeriod = startOfPeriod(minDate, trunc);
      const lastPeriod = startOfPeriod(maxDate, trunc);
      const rowsByPeriod = new Map(
        rows.map(row => [normalizeDateValue(row.period), row])
      );
      const completeSeries = [];

      for (
        let cursor = firstPeriod;
        cursor <= lastPeriod;
        cursor = advancePeriod(cursor, trunc)
      ) {
        const period = isoDate(cursor);
        const row = rowsByPeriod.get(period);
        completeSeries.push({
          period,
          income: row?.income ?? "0",
          expenses: row?.expenses ?? "0",
        });
      }

      res.json(completeSeries);
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to fetch trend" });
    }
  });

  // GET /api/transactions/categories
  app.get("/api/transactions/categories", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { startDate, endDate, type } = req.query as Record<string, string>;

      let where = `WHERE user_id = $1`;
      const params: any[] = [userId];
      let idx = 2;
      if (startDate) { where += ` AND date >= $${idx++}`; params.push(startDate); }
      if (endDate) { where += ` AND date <= $${idx++}`; params.push(endDate); }
      if (type) { where += ` AND type = $${idx++}`; params.push(type); }

      const { rows } = await pool.query(
        `SELECT subcategory, SUM(amount) AS total, COUNT(*) AS count
         FROM transactions ${where}
         GROUP BY subcategory ORDER BY total DESC`,
        params
      );
      res.json(rows);
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // GET /api/transactions/insights — subscriptions, recurring bills, and Need/Want summaries
  app.get("/api/transactions/insights", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { startDate, endDate } = req.query as Record<string, string>;

      let expenseWhere = `WHERE user_id = $1 AND type = 'expense'`;
      const params: any[] = [userId];
      let idx = 2;
      if (startDate) { expenseWhere += ` AND date >= $${idx++}`; params.push(startDate); }
      if (endDate) { expenseWhere += ` AND date <= $${idx++}`; params.push(endDate); }
      const subscriptionWhere = `${expenseWhere} AND is_recurring = TRUE AND recurring_type = 'subscription'`;
      const recurringBillWhere = `${expenseWhere} AND is_recurring = TRUE AND recurring_type = 'recurring_bill'`;

      const [
        { rows: subscriptionSummaryRows },
        { rows: recurringBillSummaryRows },
        { rows: recurringBillRows },
        { rows: subscriptionRows },
        { rows: recurringBillChargeRows },
        { rows: subscriptionChargeRows },
        { rows: needsWantRows },
      ] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(DISTINCT COALESCE(NULLIF(TRIM(merchant), ''), description)) AS count,
             COALESCE(SUM(amount), 0) AS total
           FROM transactions ${subscriptionWhere}`,
          params,
        ),
        pool.query(
          `SELECT
             COUNT(DISTINCT COALESCE(NULLIF(TRIM(merchant), ''), description)) AS count,
             COALESCE(SUM(amount), 0) AS total
           FROM transactions ${recurringBillWhere}`,
          params,
        ),
        pool.query(
          `SELECT
             COALESCE(NULLIF(TRIM(merchant), ''), description) AS name,
             COUNT(*) AS charge_count,
             COALESCE(SUM(amount), 0) AS total_paid,
             COALESCE(AVG(amount), 0) AS average_amount,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT recurring_freq ORDER BY recurring_freq), NULL) AS recurring_frequencies
           FROM transactions ${recurringBillWhere}
           GROUP BY COALESCE(NULLIF(TRIM(merchant), ''), description)
           ORDER BY total_paid DESC, name ASC`,
          params,
        ),
        pool.query(
          `SELECT
             COALESCE(NULLIF(TRIM(merchant), ''), description) AS name,
             COUNT(*) AS charge_count,
             COALESCE(SUM(amount), 0) AS total_paid,
             (ARRAY_AGG(amount ORDER BY date DESC, created_at DESC))[1] AS latest_amount,
             MAX(date)::DATE AS latest_charge_date,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT recurring_freq ORDER BY recurring_freq), NULL) AS recurring_frequencies
           FROM transactions ${subscriptionWhere}
           GROUP BY COALESCE(NULLIF(TRIM(merchant), ''), description)
           ORDER BY total_paid DESC, name ASC`,
          params,
        ),
        pool.query(
          `SELECT
             COALESCE(NULLIF(TRIM(merchant), ''), description) AS name,
             TO_CHAR(date, 'YYYY-MM-DD') AS charge_date,
             COUNT(*) AS charge_count,
             COALESCE(SUM(amount), 0) AS amount
           FROM transactions ${recurringBillWhere}
           GROUP BY COALESCE(NULLIF(TRIM(merchant), ''), description), date
           ORDER BY name ASC, date ASC`,
          params,
        ),
        pool.query(
          `SELECT
             COALESCE(NULLIF(TRIM(merchant), ''), description) AS name,
             TO_CHAR(date, 'YYYY-MM-DD') AS charge_date,
             COUNT(*) AS charge_count,
             COALESCE(SUM(amount), 0) AS amount
           FROM transactions ${subscriptionWhere}
           GROUP BY COALESCE(NULLIF(TRIM(merchant), ''), description), date
           ORDER BY name ASC, date ASC`,
          params,
        ),
        pool.query(
          `SELECT
             COALESCE(SUM(CASE WHEN needs_want = 'need' THEN amount ELSE 0 END), 0) AS needs,
             COALESCE(SUM(CASE WHEN needs_want = 'want' THEN amount ELSE 0 END), 0) AS wants,
             COALESCE(SUM(CASE WHEN needs_want IS NULL OR needs_want = 'na' THEN amount ELSE 0 END), 0) AS unclassified
           FROM transactions ${expenseWhere}`,
          params,
        ),
      ]);

      const groupChargeHistory = (rows: Array<{ name: string; charge_date: string; charge_count: string; amount: string }>) => {
        const byMerchant = new Map<string, Array<{ date: string; charge_count: string; amount: string }>>();
        for (const row of rows) {
          const history = byMerchant.get(row.name) ?? [];
          history.push({ date: row.charge_date, charge_count: row.charge_count, amount: row.amount });
          byMerchant.set(row.name, history);
        }
        return byMerchant;
      };
      const recurringBillHistory = groupChargeHistory(recurringBillChargeRows);
      const subscriptionHistory = groupChargeHistory(subscriptionChargeRows);

      res.json({
        subscriptions: {
          count: subscriptionSummaryRows[0]?.count ?? "0",
          total: subscriptionSummaryRows[0]?.total ?? "0",
          items: subscriptionRows.map(item => ({
            ...item,
            charge_history: subscriptionHistory.get(item.name) ?? [],
          })),
        },
        recurringBills: {
          count: recurringBillSummaryRows[0]?.count ?? "0",
          total: recurringBillSummaryRows[0]?.total ?? "0",
          items: recurringBillRows.map(item => ({
            ...item,
            charge_history: recurringBillHistory.get(item.name) ?? [],
          })),
        },
        needsWant: needsWantRows[0] ?? { needs: "0", wants: "0", unclassified: "0" },
      });
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to fetch spending insights" });
    }
  });

  // POST /api/transactions — create single
  app.post("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { date, description, amount, type, subcategory, category, parentCategory, needsWant, isRecurring, recurringType, recurringFreq, notes, source = "manual" } = req.body;
      if (source === "upload") return res.status(409).json({
        code: "REVIEW_REQUIRED", message: "File imports must use the preview and reviewed-save workflow.",
      });

      if (!date || !description || amount === undefined || !type)
        return res.status(400).json({ message: "date, description, amount, type are required" });
      const normalizedDate = normalizeTransactionDate(date);
      if (!normalizedDate) return res.status(400).json({ message: "Invalid transaction date" });

      if (type !== "income" && type !== "expense") return res.status(400).json({ message: "Invalid transaction type" });
      if (recurringFreq !== undefined && recurringFreq !== null && !isRecurringFrequency(recurringFreq)) {
        return res.status(400).json({ message: "Invalid recurrence frequency" });
      }
      if (recurringFreq != null && !Boolean(isRecurring)) {
        return res.status(400).json({ message: "Recurrence frequency requires a recurring transaction" });
      }
      const categories = await canonicalTransactionCategories();
      const supplied = subcategory ?? category;
      if (parentCategory !== undefined && supplied === undefined) return res.status(400).json({ message: "Invalid category" });
      let selected: CanonicalTransactionCategory | undefined;
      let categorySource: string;
      if (supplied !== undefined) {
        selected = categoryForInput(categories, type, supplied, parentCategory);
        categorySource = "user_selected";
      } else {
        const preference = categoryFromMerchantPreference(
          await userMerchantCategoryPreferences(userId, categories), { type, description },
        );
        const known = preference ? undefined
          : knownMerchantCategory({ type, description }, await knownCategoryMerchants(), categories);
        selected = preference || known || deterministicTransactionCategory(categories, description, type);
        categorySource = preference ? "user_preference" : known ? "merchant_profile"
          : selected ? "description_rule" : "unassigned";
      }
      if (!selected) return res.status(400).json({ message: "Invalid category" });
      if (needsWant !== undefined && !isNeedWant(needsWant)) return res.status(400).json({ message: "Invalid Need / Want value" });
      const finalNW = needsWant ?? selected.needVsWant?.toLowerCase() ?? "na";

      const { rows } = await pool.query(
        `INSERT INTO transactions (user_id, date, description, merchant, merchant_source, amount, type, parent_category,
          subcategory, category_source, needs_want, is_recurring, recurring_type, recurring_freq, source, notes)
         VALUES ($1,$2,$3,$4,'manual_entry',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [userId, normalizedDate, description, description, Math.abs(parseFloat(amount)), type,
         selected.storedParentCategory, selected.storedCategory, categorySource, finalNW,
         isRecurring ?? false, isRecurring && recurringType ? recurringType : null, isRecurring ? recurringFreq ?? null : null, source, notes || null]
      );

      res.status(201).json(rows[0]);
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // Legacy CSV/JSON direct imports now require the same editable review.
  app.post("/api/transactions/bulk", requireAuth, (_req, res) => {
    res.status(409).json({ code: "REVIEW_REQUIRED",
      message: "Preview the file and confirm its reviewed transactions before saving." });
  });

  // No-write multipart preview. Parsing, archive bounds,
  // UTF-8 checks, and spreadsheet handling are shared with the other imports.
  app.post("/api/transactions/ingest/preview", requireAuth, transactionUploadFile, async (req: any, res) => {
    const streaming = req.query.progress === "1";
    if (streaming) {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
    }
    const event = (value: unknown) => { if (streaming && !res.writableEnded) res.write(JSON.stringify(value) + "\n"); };
    const fail = (status: number, message: string) => {
      if (streaming) { event({ error: message }); return res.end(); }
      return res.status(status).json({ message });
    };
    try {
      event({ stage: "validation" });
      if (!req.file || !supportedTransactionFile(req.file)) {
        return fail(400, INVALID_TRANSACTION_FILE_TYPE);
      }
      event({ stage: "processing" });
      const parsed = await parseTransactionUpload(req.file);
      if (!parsed) {
        return fail(400, CORRUPT_TRANSACTION_FILE);
      }
      if (parsed.overflow) return fail(400, "Imports are limited to 500 entries at a time");
      const rows = parsed.rows;
      const sourceRows = rows.filter((row) => !isBlankTransactionSourceRow(row));
      if (sourceRows.length > 500) return fail(400, "Imports are limited to 500 entries at a time");
      if (!sourceRows.length) return fail(400, CORRUPT_TRANSACTION_FILE);
      const userId = (req.user as any).id;
      const categories = await canonicalTransactionCategories();
      const context = await loadIdentificationContext(pool, userId, categories);
      const entries = sourceRows.map((row, index) => transactionEntryFromSource(row, index + 1));
      const identified = await identifyTransactionBatch(entries, sourceRows, context);

      const preview: TransactionImportPreview = {
        entries: identified.entries,
        ignoredBlankRows: parsed.ignoredBlankRows,
      };
      event({ stage: "duplicates" });
      preview.entries = await checkUserTransactionDuplicates(pool, userId, preview.entries);
      preview.entries = await detectPreviewRecurrence(pool, userId, preview.entries);
      if (streaming) {
        event({ preview });
        event({ stage: "review" });
        return res.end();
      }
      return res.json(preview);
    } catch (error) {
      logRouteFailure(req, error);
      return fail(500, "Failed to preview transaction import");
    }
  });

  app.post("/api/transactions/import-reviewed/check", requireAuth, async (req, res) => {
    if (!validDuplicateReview(req.body?.entries)) {
      return res.status(400).json({ message: "Provide at most 500 valid review rows with unique row IDs" });
    }
    try {
      const entries = await checkUserTransactionDuplicates(pool, (req.user as any).id, req.body.entries);
      return res.json({ entries });
    } catch (error) {
      logRouteFailure(req, error);
      return res.status(500).json({ message: "Could not check duplicates. Your review has not been saved." });
    }
  });

  // Save a user-reviewed file import atomically. Validation completes before
  // acquiring a transaction connection, so a rejected review remains intact.
  app.post("/api/transactions/import-reviewed", requireAuth, async (req, res) => {
    let importClient: any;
    try {
      const entries = req.body?.entries;
      if (!validDuplicateReview(entries) || entries.length === 0) {
        return res.status(400).json({ message: "Provide between 1 and 500 reviewed transactions" });
      }
      const requestId = req.body.requestId;
      if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
        return res.status(400).json({ message: "A valid unique save request ID is required" });
      }
      const selected = entries.filter(entry => entry.include !== false);
      if (!selected.length) return res.status(400).json({ message: "Select at least one transaction to save" });
      const categories = await canonicalTransactionCategories();
      const validation = validateReviewedTransactionEntries(selected, categories);
      if (validation.errors.length) {
        return res.status(422).json({
          message: "Please correct invalid transactions before saving",
          errors: validation.errors,
        });
      }

      importClient = await pool.connect();
      const result = await saveDuplicateSafeImport(importClient, (req.user as any).id, requestId, entries, validation.transactions);
      return res.json(result);
    } catch (error) {
      if (error instanceof ImportConflict) return res.status(409).json({ message: error.message, code: error.code });
      logRouteFailure(req, error);
      return res.status(500).json({ message: "Failed to save reviewed transactions" });
    } finally {
      if (importClient) {
        try {
          importClient.release();
        } catch {
          // A release failure after a successful commit must not turn the
          // completed save into an apparent failed import.
        }
      }
    }
  });

  // Retired direct-write file API: review and duplicate protection cannot be bypassed.
  app.post("/api/transactions/ingest", requireAuth, (_req, res) => {
    res.status(409).json({ code: "REVIEW_REQUIRED",
      message: "Preview the file and confirm its reviewed transactions before saving." });
  });

  // POST /api/transactions/import-from-plaid — import a date range from connected accounts
  app.post("/api/transactions/import-from-plaid", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { itemId, accountId, startDate, endDate } = req.body as {
        itemId?: number;
        accountId?: string;
        startDate?: string;
        endDate?: string;
      };

      if (!startDate || !endDate || !isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
        return res.status(400).json({ message: "A valid start and end date are required" });
      }

      const start = new Date(`${startDate}T12:00:00Z`);
      const end = new Date(`${endDate}T12:00:00Z`);
      const today = new Date().toISOString().slice(0, 10);
      if (endDate > today) {
        return res.status(400).json({ message: "End date cannot be in the future" });
      }
      const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
      if (Number.isNaN(days) || days < 0) {
        return res.status(400).json({ message: "Start date must be before end date" });
      }
      if (days > 730) {
        return res.status(400).json({ message: "Choose a date range of two years or less" });
      }

      const allItems = await storage.getPlaidItems(userId);
      const allAccounts = await storage.getPlaidAccounts(userId);
      if (allItems.length === 0) {
        return res.status(400).json({ message: "Connect a financial account before importing transactions" });
      }

      const numericItemId = itemId === undefined ? undefined : Number(itemId);
      let selectedItems = allItems;
      if (numericItemId !== undefined) {
        const selectedItem = allItems.find((item) => item.id === numericItemId);
        if (!selectedItem) return res.status(404).json({ message: "Connected institution not found" });
        selectedItems = [selectedItem];
      }

      if (accountId) {
        const selectedAccount = allAccounts.find((account) => account.plaidAccountId === accountId);
        if (!selectedAccount) return res.status(404).json({ message: "Connected account not found" });
        if (numericItemId !== undefined && selectedAccount.plaidItemId !== numericItemId) {
          return res.status(400).json({ message: "Account does not belong to the selected institution" });
        }
        const owningItem = allItems.find((item) => item.id === selectedAccount.plaidItemId);
        if (!owningItem) return res.status(404).json({ message: "Connected institution not found" });
        selectedItems = [owningItem];
      }

      const plaid = getPlaidClient();
      const canonicalCategories = await canonicalTransactionCategories();
      const context = await loadIdentificationContext(pool, userId, canonicalCategories);
      const accountByPlaidId = new Map(allAccounts.map((account) => [account.plaidAccountId, account]));

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let skippedPending = 0;
      let skippedTransfers = 0;
      let skippedUnsupportedCurrency = 0;
      let skippedInvalid = 0;
      let uncategorized = 0;
      const unavailableInstitutions: string[] = [];
      const recurrenceSignalsUnavailableInstitutions: string[] = [];
      const recurrenceTargetIds: number[] = [];
      const providerSignals = new Map<number, RecurrenceTags>();

      for (const item of selectedItems) {
        let offset = 0;
        let totalTransactions = 0;
        let streamSignals = new Map<string, RecurrenceTags>();
        try {
          const recurring = await plaid.transactionsRecurringGet({
            access_token: item.accessToken,
            ...(accountId ? { account_ids: [accountId] } : {}),
          });
          streamSignals = plaidStreamSignals(recurring.data.outflow_streams,
            new Set(allAccounts.filter(account => account.plaidItemId === item.id &&
              (!accountId || account.plaidAccountId === accountId)).map(account => account.plaidAccountId)));
        } catch (error) {
          // Not every institution/Item has the optional recurring product.
          // Continue with user history, catalog and heuristics, and report the limitation.
          logRouteFailure(req, error);
          recurrenceSignalsUnavailableInstitutions.push(item.institutionName || "Connected Institution");
        }

        do {
          let response;
          try {
            response = await plaid.transactionsGet({
              access_token: item.accessToken,
              start_date: startDate,
              end_date: endDate,
              options: {
                count: 500,
                offset,
                include_original_description: true,
                ...(accountId ? { account_ids: [accountId] } : {}),
              },
            });
          } catch (error: any) {
            logRouteFailure(req, error);
            unavailableInstitutions.push(item.institutionName || "Connected Institution");
            break;
          }

          const plaidTransactions = response.data.transactions;
          totalTransactions = response.data.total_transactions;

          const eligible: Array<{ transaction: PlaidTransaction; account: (typeof allAccounts)[number];
            entry: ReturnType<typeof transactionEntryFromSource> }> = [];
          for (const transaction of plaidTransactions) {
            const amount = Number(transaction.amount);
            const account = accountByPlaidId.get(transaction.account_id);
            const currency = transaction.iso_currency_code;

            if (transaction.pending) {
              skipped++;
              skippedPending++;
              continue;
            }
            if (isPlaidTransfer(transaction)) {
              skipped++;
              skippedTransfers++;
              continue;
            }
            if (currency !== "USD") {
              skipped++;
              skippedUnsupportedCurrency++;
              continue;
            }
            if (!account || account.plaidItemId !== item.id || (accountId && transaction.account_id !== accountId) ||
                !Number.isFinite(amount) || amount === 0 || !isValidIsoDate(transaction.date) ||
                !transaction.transaction_id?.trim()) {
              skipped++;
              skippedInvalid++;
              continue;
            }

            const description = (transaction.original_description || transaction.name || transaction.merchant_name || "Bank transaction").trim();
            const merchant = (transaction.merchant_name || transaction.name || description).trim();
            const type: "income" | "expense" = amount < 0 ? "income" : "expense";
            const category = categorizePlaidTransaction(transaction, description, type);
            const sourceCandidates = [transaction.personal_finance_category?.detailed,
              ...(transaction.category || []).slice().reverse(), transaction.personal_finance_category?.primary,
              legacyCategoryAliases[category.subcategory] || category.subcategory];
            const sourceCategory = sourceCandidates.map(value => value
              ? matchSourceCategory(canonicalCategories, type, value) : undefined).find(Boolean);
            eligible.push({ transaction, account, entry: transactionEntryFromSource({
              date: transaction.date, description, merchant, type, amount: Math.abs(amount),
              category: sourceCategory?.category || "", parentcategory: sourceCategory?.parentCategory || "",
            }, eligible.length + 1) });
          }
          // Shared identification completes before stable-ID upserts and recurrence detection.
          const identified = await identifyTransactionBatch(eligible.map(row => row.entry),
            eligible.map(row => row.transaction as unknown as Record<string, unknown>), context);
          for (let index = 0; index < eligible.length; index++) {
            const { transaction, account } = eligible[index];
            const entry = identified.entries[index];
            const institutionName = item.institutionName || "Connected Institution";
            const { rows } = await pool.query(
              `INSERT INTO transactions (
                 user_id, date, description, merchant, merchant_source, amount, type, parent_category,
                 subcategory, category_source, needs_want,
                 recurring_freq, source, plaid_transaction_id, plaid_account_id, plaid_account_name, plaid_institution_name
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL,'plaid',$12,$13,$14,$15)
               ON CONFLICT (user_id, plaid_transaction_id)
                 WHERE plaid_transaction_id IS NOT NULL
               DO UPDATE SET
                 date=EXCLUDED.date,
                  description=CASE WHEN EXISTS (
                    SELECT 1 FROM transaction_change_history h WHERE h.user_id=transactions.user_id
                    AND h.transaction_id=transactions.id AND h.field IN ('merchant','description')
                  ) THEN transactions.description ELSE EXCLUDED.description END,
                  merchant=CASE WHEN EXISTS (
                    SELECT 1 FROM transaction_change_history h WHERE h.user_id=transactions.user_id
                    AND h.transaction_id=transactions.id AND h.field IN ('merchant','description')
                  ) THEN transactions.merchant ELSE EXCLUDED.merchant END,
                  merchant_source=CASE WHEN EXISTS (
                    SELECT 1 FROM transaction_change_history h WHERE h.user_id=transactions.user_id
                    AND h.transaction_id=transactions.id AND h.field IN ('merchant','description')
                  ) THEN transactions.merchant_source ELSE EXCLUDED.merchant_source END,
                 amount=EXCLUDED.amount,
                 type=EXCLUDED.type,
                  parent_category=CASE WHEN transactions.is_user_modified OR
                    (EXCLUDED.subcategory='unassigned' AND transactions.type=EXCLUDED.type)
                    THEN transactions.parent_category ELSE EXCLUDED.parent_category END,
                  subcategory=CASE WHEN transactions.is_user_modified OR
                    (EXCLUDED.subcategory='unassigned' AND transactions.type=EXCLUDED.type)
                    THEN transactions.subcategory ELSE EXCLUDED.subcategory END,
                   category_source=CASE WHEN transactions.is_user_modified OR
                     (EXCLUDED.subcategory='unassigned' AND transactions.type=EXCLUDED.type)
                     THEN transactions.category_source ELSE EXCLUDED.category_source END,
                  needs_want=CASE WHEN transactions.is_user_modified OR
                    (EXCLUDED.subcategory='unassigned' AND transactions.type=EXCLUDED.type)
                    THEN transactions.needs_want ELSE EXCLUDED.needs_want END,
                 source='plaid',
                 plaid_account_id=EXCLUDED.plaid_account_id,
                 plaid_account_name=EXCLUDED.plaid_account_name,
                 plaid_institution_name=EXCLUDED.plaid_institution_name,
                 updated_at=NOW()
                RETURNING id, subcategory, (xmax = 0) AS was_inserted`,
              [
                userId,
                transaction.date,
                entry.description,
                entry.merchant,
                 entry.merchantSource,
                entry.amount,
                entry.type,
                entry.parentCategory || null,
                entry.subcategory || UNASSIGNED_TRANSACTION_CATEGORY,
                 entry.categorySource,
                entry.needsWant,
                transaction.transaction_id,
                transaction.account_id,
                account.name,
                institutionName,
              ]
            );

            if (rows[0]?.was_inserted) inserted++;
            else updated++;
            if (rows[0]?.subcategory === UNASSIGNED_TRANSACTION_CATEGORY) uncategorized++;
            if (rows[0]?.id) {
              recurrenceTargetIds.push(rows[0].id);
              const signal = plaidRecurrenceSignal(transaction) || streamSignals.get(transaction.transaction_id);
              if (signal) providerSignals.set(rows[0].id, signal);
            }
          }

          offset += plaidTransactions.length;
          if (plaidTransactions.length === 0) break;
        } while (offset < totalTransactions);
      }

      const recurringMarked = recurrenceTargetIds.length
        ? await detectAndMarkRecurring(pool, userId, { targetIds: recurrenceTargetIds, providerSignals }) : 0;
      res.json({
        inserted,
        updated,
        skipped,
        skippedReasons: {
          pending: skippedPending,
          transfers: skippedTransfers,
          unsupportedCurrency: skippedUnsupportedCurrency,
          invalid: skippedInvalid,
        },
        unavailable: unavailableInstitutions.length,
        unavailableInstitutions,
        recurrenceSignalsUnavailableInstitutions,
        recurringMarked,
        uncategorized,
      });
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to import connected account transactions" });
    }
  });

  // POST /api/transactions/detect-recurring
  app.post("/api/transactions/detect-recurring", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const updated = await detectAndMarkRecurring(pool, userId);
      res.json({ updated });
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to detect recurring" });
    }
  });

  // PATCH /api/transactions/:id
  app.patch("/api/transactions/:id", requireAuth, async (req, res) => {
    let editClient: any;
    try {
      const userId = (req.user as any).id;
      const id = parseInt(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid transaction id" });
      editClient = await pool.connect();
      await editClient.query("BEGIN");
      const abortEdit = async (status: number, message: string) => {
        await editClient.query("ROLLBACK");
        editClient.release();
        editClient = null;
        return res.status(status).json({ message });
      };

      const {
        date, description, amount, type, subcategory, category, parentCategory, needsWant, isRecurring, recurringType, recurringFreq, notes,
        applyToMerchant = false, merchantFields = [],
      } = req.body;
      const { rows: existingRows } = await editClient.query(
        `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, userId],
      );
      const existing = existingRows[0];
      if (!existing) return abortEdit(404, "Not found");
      const categories = await canonicalTransactionCategories();
      if (type !== undefined && type !== "income" && type !== "expense") return abortEdit(400, "Invalid transaction type");
      const requestedType = type === "income" || type === "expense" ? type : existing.type;
      const requestedCategory = subcategory ?? category;
      const selectedCategory = requestedCategory !== undefined
        ? categoryForInput(categories, requestedType, requestedCategory, parentCategory)
        : undefined;
      if (requestedCategory !== undefined && !selectedCategory) return abortEdit(400, "Invalid category");
      if (type !== undefined && type !== existing.type && !selectedCategory) {
        return abortEdit(400, "A valid category is required when changing transaction type");
      }
      if (needsWant !== undefined && !isNeedWant(needsWant)) return abortEdit(400, "Invalid Need / Want value");
      if (recurringFreq !== undefined && recurringFreq !== null && !isRecurringFrequency(recurringFreq)) {
        return abortEdit(400, "Invalid recurrence frequency");
      }
      const effectiveIsRecurring = isRecurring === undefined ? Boolean(existing.is_recurring) : Boolean(isRecurring);
      if (recurringFreq != null && !effectiveIsRecurring) {
        return abortEdit(400, "Recurrence frequency requires a recurring transaction");
      }
      if (parentCategory !== undefined && requestedCategory === undefined) {
        return abortEdit(400, "A category is required when setting a parent category");
      }

      const updates: string[] = [];
      const params: any[] = [];
      const addUpdate = (column: string, value: unknown) => {
        params.push(value);
        updates.push(`${column} = $${params.length}`);
      };

      if (date !== undefined && date !== normalizeDateValue(existing.date)) addUpdate("date", date);
      if (description !== undefined && description !== existing.description) {
        addUpdate("description", description);
        addUpdate("merchant", description);
        addUpdate("merchant_source", "user_edit");
      }
      if (amount !== undefined && Number.isFinite(Number(amount)) && Number(amount) !== Number(existing.amount)) {
        addUpdate("amount", Math.abs(Number(amount)));
      }
      if (type !== undefined && type !== existing.type) {
        addUpdate("type", type);
        addUpdate("category_source", "user_edit");
      }
      if (selectedCategory && selectedCategory.storedCategory !== existing.subcategory) {
        addUpdate("subcategory", selectedCategory.storedCategory);
        addUpdate("category_source", "user_edit");
      }
      if (selectedCategory && selectedCategory.storedParentCategory !== existing.parent_category) {
        addUpdate("parent_category", selectedCategory.storedParentCategory);
        addUpdate("category_source", "user_edit");
      }
      if (selectedCategory && needsWant === undefined && (selectedCategory.needVsWant?.toLowerCase() || "na") !== existing.needs_want) addUpdate("needs_want", selectedCategory.needVsWant?.toLowerCase() || "na");
      if (needsWant !== undefined && needsWant !== existing.needs_want) addUpdate("needs_want", needsWant);
      if (isRecurring !== undefined && Boolean(isRecurring) !== Boolean(existing.is_recurring)) {
        addUpdate("is_recurring", Boolean(isRecurring));
      }
      if (isRecurring === false && existing.recurring_type !== null) {
        addUpdate("recurring_type", null);
      } else if (isRecurring !== false && recurringType !== undefined && recurringType !== existing.recurring_type) {
        addUpdate("recurring_type", recurringType);
      }
      if (isRecurring === false && existing.recurring_freq !== null) {
        addUpdate("recurring_freq", null);
      } else if (isRecurring !== false && recurringFreq !== undefined && (recurringFreq ?? null) !== existing.recurring_freq) {
        addUpdate("recurring_freq", recurringFreq ?? null);
      }
      if (notes !== undefined && notes !== existing.notes) addUpdate("notes", notes || null);

      let transaction = existing;
      let primaryChanged = false;
      if (updates.length > 0) {
        const modifiesClassification = updates.some((update) =>
          /^(parent_category|subcategory|needs_want|is_recurring|recurring_type|recurring_freq)\s*=/.test(update),
        );
        if (modifiesClassification) updates.push("is_user_modified = TRUE");
        params.push(id, userId);
        const { rows } = await editClient.query(
          `UPDATE transactions
           SET ${updates.join(", ")}, updated_at = NOW()
           WHERE id = $${params.length - 1} AND user_id = $${params.length}
           RETURNING *`,
          params,
        );
        transaction = rows[0];
        primaryChanged = true;
        const audited = [
          ["merchant", existing.merchant, transaction.merchant],
          ["description", existing.description, transaction.description],
          ["parent_category", existing.parent_category, transaction.parent_category],
          ["subcategory", existing.subcategory, transaction.subcategory],
          ["needs_want", existing.needs_want, transaction.needs_want],
          ["is_recurring", existing.is_recurring, transaction.is_recurring],
          ["recurring_type", existing.recurring_type, transaction.recurring_type],
          ["recurring_freq", existing.recurring_freq, transaction.recurring_freq],
        ].filter(([, oldValue, newValue]) => String(oldValue ?? "") !== String(newValue ?? ""));
        for (const [field, oldValue, newValue] of audited) {
          await editClient.query(
            `INSERT INTO transaction_change_history (user_id, transaction_id, field, old_value, new_value) VALUES ($1,$2,$3,$4,$5)`,
            [userId, id, field, oldValue == null ? null : String(oldValue), newValue == null ? null : String(newValue)],
          );
        }
      }

      const allowedMerchantFields = new Set(["subcategory", "needsWant", "recurring"]);
      const scopedFields = Array.isArray(merchantFields)
        ? merchantFields.filter((field): field is string => allowedMerchantFields.has(field))
        : [];
       let updatedCount = 1;

      if (applyToMerchant === true && scopedFields.length > 0) {
        if (scopedFields.includes("subcategory") && requestedCategory === undefined) {
          return abortEdit(400, "A category is required for a merchant-wide category update");
        }
        if (scopedFields.includes("needsWant") && needsWant === undefined) {
          return abortEdit(400, "A Need / Want value is required for a merchant-wide update");
        }
        if (scopedFields.includes("recurring") && typeof isRecurring !== "boolean") {
          return abortEdit(400, "A recurring value is required for a merchant-wide update");
        }

        const merchantKey = normalizeMerchant(existing.merchant || existing.description);
        const { rows: candidateRows } = await editClient.query(
          `SELECT id, merchant, description, parent_category, subcategory, needs_want, is_recurring, recurring_type FROM transactions WHERE user_id = $1`,
          [userId],
        );
        const expectedNeedWant = scopedFields.includes("needsWant")
          ? needsWant
          : selectedCategory?.needVsWant?.toLowerCase() || "na";
        const matchingRows = candidateRows.filter((row: any) => {
          if (row.id === id || normalizeMerchant(row.merchant || row.description) !== merchantKey) return false;
          return (scopedFields.includes("subcategory") && selectedCategory &&
              (row.subcategory !== selectedCategory.storedCategory ||
               row.parent_category !== selectedCategory.storedParentCategory ||
               row.needs_want !== expectedNeedWant)) ||
            (scopedFields.includes("needsWant") && row.needs_want !== needsWant) ||
            (scopedFields.includes("recurring") &&
              (Boolean(row.is_recurring) !== Boolean(isRecurring) ||
               (row.recurring_type ?? null) !== (isRecurring ? (recurringType || null) : null)));
        });
        const matchingIds = matchingRows.map((row: any) => row.id);

        if (matchingIds.length > 0) {
          const merchantUpdates: string[] = [];
          const merchantParams: any[] = [];
          const addMerchantUpdate = (column: string, value: unknown) => {
            merchantParams.push(value);
            merchantUpdates.push(`${column} = $${merchantParams.length}`);
          };

          if (scopedFields.includes("subcategory") && selectedCategory) {
            addMerchantUpdate("subcategory", selectedCategory.storedCategory);
            addMerchantUpdate("parent_category", selectedCategory.storedParentCategory);
            addMerchantUpdate("category_source", "user_edit");
            if (!scopedFields.includes("needsWant")) addMerchantUpdate("needs_want", selectedCategory.needVsWant?.toLowerCase() || "na");
          }
          if (scopedFields.includes("needsWant")) addMerchantUpdate("needs_want", needsWant);
          if (scopedFields.includes("recurring")) {
            addMerchantUpdate("is_recurring", Boolean(isRecurring));
            addMerchantUpdate("recurring_type", isRecurring ? (recurringType || null) : null);
          }

          merchantUpdates.push("is_user_modified = TRUE");
          merchantParams.push(userId, matchingIds);
          const { rowCount } = await editClient.query(
            `UPDATE transactions
             SET ${merchantUpdates.join(", ")}, updated_at = NOW()
             WHERE user_id = $${merchantParams.length - 1}
               AND id = ANY($${merchantParams.length}::int[])`,
            merchantParams,
          );
          updatedCount = (primaryChanged ? 1 : 0) + (rowCount ?? 0);
          const fieldsToAudit = scopedFields.includes("subcategory")
            ? ["parent_category", "subcategory", "needs_want"] : scopedFields.includes("needsWant") ? ["needs_want"] : [];
          if (scopedFields.includes("recurring")) fieldsToAudit.push("is_recurring", "recurring_type");
          for (const row of matchingRows) {
            for (const auditField of fieldsToAudit) {
              const newValue = auditField === "subcategory" ? selectedCategory?.storedCategory
                : auditField === "parent_category" ? selectedCategory?.storedParentCategory
                : auditField === "needs_want" ? (scopedFields.includes("needsWant") ? needsWant : selectedCategory?.needVsWant?.toLowerCase())
                : auditField === "is_recurring" ? Boolean(isRecurring) : isRecurring ? (recurringType || null) : null;
              if (String(row[auditField] ?? "") === String(newValue ?? "")) continue;
              await editClient.query(`INSERT INTO transaction_change_history (user_id, transaction_id, field, old_value, new_value) VALUES ($1,$2,$3,$4,$5)`,
                [userId, row.id, auditField, row[auditField], newValue == null ? null : String(newValue)]);
            }
          }
        }
      }

      await editClient.query("COMMIT");
      editClient.release();
      editClient = null;
      res.json({ transaction, updatedCount });
    } catch (e) {
      if (editClient) {
        await editClient.query("ROLLBACK").catch(() => undefined);
        editClient.release();
      }
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // DELETE /api/transactions/:id
  app.delete("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const id = parseInt(req.params.id);
      const { rowCount } = await pool.query(
        `DELETE FROM transactions WHERE id=$1 AND user_id=$2`, [id, userId]
      );
      if (!rowCount) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (e) {
      logRouteFailure(req, e);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });
}
