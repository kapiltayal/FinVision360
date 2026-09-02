import { pool } from "./db";
import { requireAuth } from "./auth";
import type { Express } from "express";
import type { Transaction as PlaidTransaction } from "plaid";
import { getPlaidClient } from "./plaid";
import { storage } from "./storage";

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
  const fallback = autoCategorizeFn(description, type);
  const primary = transaction.personal_finance_category?.primary?.toUpperCase() ?? "";
  const detailed = transaction.personal_finance_category?.detailed?.toUpperCase() ?? "";

  if (type === "income") {
    if (detailed.includes("WAGES")) return { subcategory: "salary", needsWant: "na" };
    if (detailed.includes("DIVIDEND")) return { subcategory: "dividend", needsWant: "na" };
    if (detailed.includes("INTEREST_EARNED")) return { subcategory: "interest", needsWant: "na" };
    if (detailed.includes("TAX_REFUND") || detailed.includes("REFUND")) return { subcategory: "refund", needsWant: "na" };
    if (primary === "INCOME") {
      return fallback.subcategory !== "unassigned"
        ? fallback
        : { subcategory: "other_income", needsWant: "na" };
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

async function detectAndMarkRecurring(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT id, date, description, amount, type FROM transactions WHERE user_id = $1 ORDER BY date ASC`,
    [userId]
  );

  const groups: Record<string, Array<{ id: number; date: Date; amount: number }>> = {};
  for (const row of rows) {
    const key = normalizeMerchant(row.description);
    if (!key || key.length < 3) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ id: row.id, date: new Date(row.date), amount: parseFloat(row.amount) });
  }

  const updates: Array<{ id: number; recurringType: string }> = [];

  for (const [, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue;
    txns.sort((a, b) => a.date.getTime() - b.date.getTime());

    let recurringPairs = 0;
    let sameAmountPairs = 0;

    for (let i = 1; i < txns.length; i++) {
      const daysDiff =
        (txns[i].date.getTime() - txns[i - 1].date.getTime()) / 86_400_000;
      if (daysDiff >= 20 && daysDiff <= 45) {
        recurringPairs++;
        if (Math.abs(txns[i].amount - txns[i - 1].amount) < 0.02) sameAmountPairs++;
      }
    }

    if (recurringPairs < 1) continue;
    const recurringType = sameAmountPairs === recurringPairs ? "subscription" : "recurring_bill";
    for (const t of txns) updates.push({ id: t.id, recurringType });
  }

  for (const u of updates) {
    await pool.query(
      `UPDATE transactions SET is_recurring = TRUE, recurring_type = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [u.recurringType, u.id, userId]
    );
  }

  return updates.length;
}

// ─── ROUTE REGISTRATION ───────────────────────────────────────────────────────
export function registerFinanceTrackerRoutes(app: Express) {
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
        { rows: liabilityRows },
        { rows: goalRows },
      ] = await Promise.all([
        pool.query(
          `SELECT plan_key, planned_amount
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
        pool.query(
          `SELECT id, name, category, balance, minimum_payment
           FROM liabilities
           WHERE user_id = $1
           ORDER BY balance::numeric DESC, name`,
          [userId],
        ),
        pool.query(
          `SELECT id, title, category, target_amount, current_amount, target_date
           FROM user_goals
           WHERE user_id = $1
           ORDER BY target_date NULLS LAST, title`,
          [userId],
        ),
      ]);

      return res.json({
        month,
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
      console.error("[GET /api/budget-plan] error:", error);
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

      const { rows } = await pool.query(
        `INSERT INTO budget_plans (user_id, month, plan_key, planned_amount)
         SELECT $1, $2::date, item.plan_key, item.planned_amount
         FROM jsonb_to_recordset($3::jsonb)
           AS item(plan_key text, planned_amount numeric)
         ON CONFLICT (user_id, month, plan_key)
         DO UPDATE SET planned_amount = EXCLUDED.planned_amount, updated_at = NOW()
         RETURNING plan_key, planned_amount`,
        [userId, `${month}-01`, JSON.stringify(normalizedPlans)],
      );

      return res.json({
        plans: rows.map((row) => ({
          planKey: row.plan_key,
          plannedAmount: Number(row.planned_amount),
        })),
      });
    } catch (error) {
      console.error("[PUT /api/budget-plan/bulk] error:", error);
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
      const normalizedKey = typeof planKey === "string" ? planKey.trim() : "";
      const amount = Number(plannedAmount);
      if (!normalizedKey || normalizedKey.length > 250) {
        return res.status(400).json({ message: "A valid plan category is required" });
      }
      if (!Number.isFinite(amount) || amount < 0 || amount > 999_999_999_999.99) {
        return res.status(400).json({ message: "Planned amount must be a valid non-negative number" });
      }

      const { rows } = await pool.query(
        `INSERT INTO budget_plans (user_id, month, plan_key, planned_amount)
         VALUES ($1, $2::date, $3, $4)
         ON CONFLICT (user_id, month, plan_key)
         DO UPDATE SET planned_amount = EXCLUDED.planned_amount, updated_at = NOW()
         RETURNING plan_key, planned_amount`,
        [userId, `${month}-01`, normalizedKey, amount.toFixed(2)],
      );

      return res.json({
        planKey: rows[0].plan_key,
        plannedAmount: Number(rows[0].planned_amount),
      });
    } catch (error) {
      console.error("[PUT /api/budget-plan] error:", error);
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
      await pool.query(
        `DELETE FROM budget_plans
         WHERE user_id = $1 AND month = $2::date AND plan_key = $3`,
        [userId, `${month}-01`, planKey.trim()],
      );
      return res.status(204).send();
    } catch (error) {
      console.error("[DELETE /api/budget-plan] error:", error);
      return res.status(500).json({ message: "Failed to remove the budget plan line" });
    }
  });

  // GET /api/transactions — list with optional filters
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { startDate, endDate, type, subcategory, source, recurring, search } = req.query as Record<string, string>;

      let sql = `SELECT * FROM transactions WHERE user_id = $1`;
      const params: any[] = [userId];
      let idx = 2;

      if (startDate) { sql += ` AND date >= $${idx++}`; params.push(startDate); }
      if (endDate) { sql += ` AND date <= $${idx++}`; params.push(endDate); }
      if (type) { sql += ` AND type = $${idx++}`; params.push(type); }
      if (subcategory) { sql += ` AND subcategory = $${idx++}`; params.push(subcategory); }
      if (source) { sql += ` AND source = $${idx++}`; params.push(source); }
      if (recurring === "true") sql += ` AND is_recurring = TRUE`;
      if (search) { sql += ` AND description ILIKE $${idx++}`; params.push(`%${search}%`); }

      sql += ` ORDER BY date DESC, created_at DESC`;

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (e) {
      console.error(e);
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
      console.error(e);
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
      console.error(e);
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
      console.error(e);
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
      console.error(e);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // GET /api/transactions/insights — subscription and Need/Want spending summaries
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

      const [
        { rows: subscriptionSummaryRows },
        { rows: subscriptionRows },
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
             COALESCE(NULLIF(TRIM(merchant), ''), description) AS name,
             COUNT(*) AS charge_count,
             COALESCE(SUM(amount), 0) AS total_paid,
             (ARRAY_AGG(amount ORDER BY date DESC, created_at DESC))[1] AS latest_amount,
             MAX(date)::DATE AS latest_charge_date
           FROM transactions ${subscriptionWhere}
           GROUP BY COALESCE(NULLIF(TRIM(merchant), ''), description)
           ORDER BY total_paid DESC, name ASC`,
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

      res.json({
        subscriptions: {
          count: subscriptionSummaryRows[0]?.count ?? "0",
          total: subscriptionSummaryRows[0]?.total ?? "0",
          items: subscriptionRows,
        },
        needsWant: needsWantRows[0] ?? { needs: "0", wants: "0", unclassified: "0" },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to fetch spending insights" });
    }
  });

  // POST /api/transactions — create single
  app.post("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { date, description, amount, type, subcategory, needsWant, isRecurring, recurringType, notes, source = "manual" } = req.body;

      if (!date || !description || amount === undefined || !type)
        return res.status(400).json({ message: "date, description, amount, type are required" });

      let cat = autoCategorizeFn(description, type);
      const finalSubcat = subcategory && subcategory !== "unassigned" ? subcategory : cat.subcategory;
      const finalNW = needsWant || cat.needsWant;

      const { rows } = await pool.query(
        `INSERT INTO transactions (user_id, date, description, merchant, amount, type, subcategory, needs_want, is_recurring, recurring_type, source, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [userId, date, description, description, Math.abs(parseFloat(amount)), type, finalSubcat, finalNW,
         isRecurring ?? false, isRecurring && recurringType ? recurringType : null, source, notes || null]
      );

      res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // POST /api/transactions/bulk — CSV import
  app.post("/api/transactions/bulk", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { transactions, rejected: clientRejected = {} } = req.body;

      if (!Array.isArray(transactions))
        return res.status(400).json({ message: "transactions array required" });

      let inserted = 0;
      const skippedReasons: Record<string, number> = {};
      const addSkipped = (reason: string) => {
        skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
      };

      if (clientRejected && typeof clientRejected === "object") {
        for (const [reason, count] of Object.entries(clientRejected)) {
          const numericCount = Number(count);
          if (numericCount > 0) skippedReasons[reason] = numericCount;
        }
      }

      for (const t of transactions) {
        if (!t.date) { addSkipped("Missing or invalid date"); continue; }
        if (!t.description) { addSkipped("Missing description"); continue; }
        if (t.amount === undefined || t.amount === null || !Number.isFinite(Number(t.amount))) {
          addSkipped("Missing or invalid amount");
          continue;
        }
        if (t.type !== "income" && t.type !== "expense") {
          addSkipped("Invalid transaction type");
          continue;
        }

        try {
          const cat = autoCategorizeFn(t.description, t.type);
          const finalSubcat = t.subcategory && t.subcategory !== "unassigned" ? t.subcategory : cat.subcategory;
          const finalNW = t.needsWant || cat.needsWant;

          await pool.query(
            `INSERT INTO transactions (user_id, date, description, merchant, amount, type, subcategory, needs_want, source, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'upload',$9)`,
            [userId, t.date, t.description, t.merchant || t.description, Math.abs(parseFloat(t.amount)), t.type, finalSubcat, finalNW, t.notes || null]
          );
          inserted++;
        } catch {
          addSkipped("Could not save record");
        }
      }

      const recurringMarked = inserted ? await detectAndMarkRecurring(userId) : 0;
      const skipped = Object.values(skippedReasons).reduce((total, count) => total + count, 0);
      res.json({ inserted, skipped, skippedReasons, recurringMarked });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to import transactions" });
    }
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
      const accountByPlaidId = new Map(allAccounts.map((account) => [account.plaidAccountId, account]));

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let skippedPending = 0;
      let skippedTransfers = 0;
      let skippedUnsupportedCurrency = 0;
      let skippedInvalid = 0;
      const unavailableInstitutions: string[] = [];

      for (const item of selectedItems) {
        let offset = 0;
        let totalTransactions = 0;

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
            console.error(
              `[plaid] transaction import failed for item ${item.id}:`,
              error?.response?.data || error?.message
            );
            unavailableInstitutions.push(item.institutionName || "Connected Institution");
            break;
          }

          const plaidTransactions = response.data.transactions;
          totalTransactions = response.data.total_transactions;

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
            if (!account || !Number.isFinite(amount) || amount === 0) {
              skipped++;
              skippedInvalid++;
              continue;
            }

            const description = (transaction.merchant_name || transaction.name || "Bank transaction").trim();
            const merchant = (transaction.merchant_name || transaction.name || description).trim();
            const type: "income" | "expense" = amount < 0 ? "income" : "expense";
            const category = categorizePlaidTransaction(transaction, description, type);
            const institutionName = item.institutionName || "Connected Institution";
            const { rows } = await pool.query(
              `INSERT INTO transactions (
                 user_id, date, description, merchant, amount, type, subcategory, needs_want,
                 source, plaid_transaction_id, plaid_account_id, plaid_account_name, plaid_institution_name
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'plaid',$9,$10,$11,$12)
               ON CONFLICT (user_id, plaid_transaction_id)
                 WHERE plaid_transaction_id IS NOT NULL
               DO UPDATE SET
                 date=EXCLUDED.date,
                 description=EXCLUDED.description,
                 merchant=EXCLUDED.merchant,
                 amount=EXCLUDED.amount,
                 type=EXCLUDED.type,
                 subcategory=EXCLUDED.subcategory,
                 needs_want=EXCLUDED.needs_want,
                 source='plaid',
                 plaid_account_id=EXCLUDED.plaid_account_id,
                 plaid_account_name=EXCLUDED.plaid_account_name,
                 plaid_institution_name=EXCLUDED.plaid_institution_name,
                 updated_at=NOW()
               RETURNING (xmax = 0) AS was_inserted`,
              [
                userId,
                transaction.date,
                description,
                merchant,
                Math.abs(amount),
                type,
                category.subcategory,
                category.needsWant,
                transaction.transaction_id,
                transaction.account_id,
                account.name,
                institutionName,
              ]
            );

            if (rows[0]?.was_inserted) inserted++;
            else updated++;
          }

          offset += plaidTransactions.length;
          if (plaidTransactions.length === 0) break;
        } while (offset < totalTransactions);
      }

      const recurringMarked = inserted || updated ? await detectAndMarkRecurring(userId) : 0;
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
        recurringMarked,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to import connected account transactions" });
    }
  });

  // POST /api/transactions/detect-recurring
  app.post("/api/transactions/detect-recurring", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const updated = await detectAndMarkRecurring(userId);
      res.json({ updated });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to detect recurring" });
    }
  });

  // PATCH /api/transactions/:id
  app.patch("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const id = parseInt(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid transaction id" });

      const {
        date, description, amount, type, subcategory, needsWant, isRecurring, recurringType, notes,
        applyToMerchant = false, merchantFields = [],
      } = req.body;
      const { rows: existingRows } = await pool.query(
        `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ message: "Not found" });

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
      }
      if (amount !== undefined && Number.isFinite(Number(amount)) && Number(amount) !== Number(existing.amount)) {
        addUpdate("amount", Math.abs(Number(amount)));
      }
      if (type !== undefined && type !== existing.type) addUpdate("type", type);
      if (subcategory !== undefined && subcategory !== existing.subcategory) addUpdate("subcategory", subcategory);
      if (needsWant !== undefined && needsWant !== existing.needs_want) addUpdate("needs_want", needsWant);
      if (isRecurring !== undefined && Boolean(isRecurring) !== Boolean(existing.is_recurring)) {
        addUpdate("is_recurring", Boolean(isRecurring));
      }
      if (isRecurring === false && existing.recurring_type !== null) {
        addUpdate("recurring_type", null);
      } else if (isRecurring !== false && recurringType !== undefined && recurringType !== existing.recurring_type) {
        addUpdate("recurring_type", recurringType);
      }
      if (notes !== undefined && notes !== existing.notes) addUpdate("notes", notes || null);

      let transaction = existing;
      if (updates.length > 0) {
        params.push(id, userId);
        const { rows } = await pool.query(
          `UPDATE transactions
           SET ${updates.join(", ")}, updated_at = NOW()
           WHERE id = $${params.length - 1} AND user_id = $${params.length}
           RETURNING *`,
          params,
        );
        transaction = rows[0];
      }

      const allowedMerchantFields = new Set(["subcategory", "needsWant", "recurring"]);
      const scopedFields = Array.isArray(merchantFields)
        ? merchantFields.filter((field): field is string => allowedMerchantFields.has(field))
        : [];
      let updatedCount = 1;

      if (applyToMerchant === true && scopedFields.length > 0) {
        if (scopedFields.includes("subcategory") && subcategory === undefined) {
          return res.status(400).json({ message: "A category is required for a merchant-wide category update" });
        }
        if (scopedFields.includes("needsWant") && needsWant === undefined) {
          return res.status(400).json({ message: "A Need / Want value is required for a merchant-wide update" });
        }
        if (scopedFields.includes("recurring") && typeof isRecurring !== "boolean") {
          return res.status(400).json({ message: "A recurring value is required for a merchant-wide update" });
        }

        const merchantKey = normalizeMerchant(existing.merchant || existing.description);
        const { rows: candidateRows } = await pool.query(
          `SELECT id, merchant, description FROM transactions WHERE user_id = $1`,
          [userId],
        );
        const matchingIds = candidateRows
          .filter(row => normalizeMerchant(row.merchant || row.description) === merchantKey)
          .map(row => row.id);

        if (matchingIds.length > 0) {
          const merchantUpdates: string[] = [];
          const merchantParams: any[] = [];
          const addMerchantUpdate = (column: string, value: unknown) => {
            merchantParams.push(value);
            merchantUpdates.push(`${column} = $${merchantParams.length}`);
          };

          if (scopedFields.includes("subcategory")) addMerchantUpdate("subcategory", subcategory);
          if (scopedFields.includes("needsWant")) addMerchantUpdate("needs_want", needsWant);
          if (scopedFields.includes("recurring")) {
            addMerchantUpdate("is_recurring", Boolean(isRecurring));
            addMerchantUpdate("recurring_type", isRecurring ? (recurringType || null) : null);
          }

          merchantParams.push(userId, matchingIds);
          const { rowCount } = await pool.query(
            `UPDATE transactions
             SET ${merchantUpdates.join(", ")}, updated_at = NOW()
             WHERE user_id = $${merchantParams.length - 1}
               AND id = ANY($${merchantParams.length}::int[])`,
            merchantParams,
          );
          updatedCount = rowCount ?? 0;
        }
      }

      res.json({ transaction, updatedCount });
    } catch (e) {
      console.error(e);
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
      console.error(e);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });
}
