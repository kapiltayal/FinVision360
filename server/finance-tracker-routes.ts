import { pool } from "./db";
import { requireAuth } from "./auth";
import type { Express } from "express";
import type { Transaction as PlaidTransaction } from "plaid";
import { getPlaidClient } from "./plaid";
import { storage } from "./storage";

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

      const { rows } = await pool.query(
        `SELECT DATE_TRUNC('${trunc}', date)::DATE AS period,
                COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) AS income,
                COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses
         FROM transactions ${where}
         GROUP BY period ORDER BY period ASC`,
        params
      );
      res.json(rows);
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
      const { transactions } = req.body;

      if (!Array.isArray(transactions) || transactions.length === 0)
        return res.status(400).json({ message: "transactions array required" });

      let inserted = 0;
      let skipped = 0;

      for (const t of transactions) {
        if (!t.date || !t.description || t.amount === undefined || !t.type) { skipped++; continue; }
        const cat = autoCategorizeFn(t.description, t.type);
        const finalSubcat = t.subcategory && t.subcategory !== "unassigned" ? t.subcategory : cat.subcategory;
        const finalNW = t.needsWant || cat.needsWant;

        await pool.query(
          `INSERT INTO transactions (user_id, date, description, merchant, amount, type, subcategory, needs_want, source, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'upload',$9)`,
          [userId, t.date, t.description, t.merchant || t.description, Math.abs(parseFloat(t.amount)), t.type, finalSubcat, finalNW, t.notes || null]
        );
        inserted++;
      }

      const recurringMarked = await detectAndMarkRecurring(userId);
      res.json({ inserted, skipped, recurringMarked });
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
      const { date, description, amount, type, subcategory, needsWant, isRecurring, recurringType, notes } = req.body;

      const { rows } = await pool.query(
        `UPDATE transactions SET
           date          = COALESCE($1, date),
           description   = COALESCE($2, description),
           merchant      = COALESCE($2, merchant),
           amount        = COALESCE($3, amount),
           type          = COALESCE($4, type),
           subcategory   = COALESCE($5, subcategory),
           needs_want    = COALESCE($6, needs_want),
           is_recurring  = COALESCE($7, is_recurring),
           recurring_type= COALESCE($8, recurring_type),
           notes         = COALESCE($9, notes),
           updated_at    = NOW()
         WHERE id=$10 AND user_id=$11 RETURNING *`,
        [
          date || null,
          description || null,
          amount !== undefined ? Math.abs(parseFloat(amount)) : null,
          type || null,
          subcategory || null,
          needsWant !== undefined ? needsWant : null,
          isRecurring !== undefined ? isRecurring : null,
          recurringType !== undefined ? recurringType : null,
          notes !== undefined ? notes : null,
          id,
          userId,
        ]
      );

      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
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
