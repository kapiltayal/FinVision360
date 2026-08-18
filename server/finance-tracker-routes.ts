import { pool } from "./db";
import { requireAuth } from "./auth";
import type { Express } from "express";

// ─── AUTO-CATEGORIZATION ENGINE ──────────────────────────────────────────────
function autoCategorizeFn(
  description: string,
  type: "income" | "expense"
): { subcategory: string; needsWant: "need" | "want" | "na" | null } {
  const d = description.toLowerCase();

  if (type === "income") {
    if (/salary|payroll|direct dep|wages|pay stub/.test(d)) return { subcategory: "salary", needsWant: "na" };
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
  if (/mortgage|rent(?! received)|hoa fee|property tax|homeowners/.test(d)) return { subcategory: "housing", needsWant: "need" };
  if (/electric|gas bill|water bill|internet|broadband|at&t|verizon|t-mobile|comcast|xfinity|spectrum|pge|con ?ed|energy/.test(d)) return { subcategory: "utilities", needsWant: "need" };
  if (/grocery|groceries|whole foods|trader joe|costco|kroger|safeway|aldi|publix|wegmans|food lion|sprouts|supermarket/.test(d)) return { subcategory: "groceries", needsWant: "need" };
  if (/^uber$|lyft|gas station|shell |chevron|bp |exxon|mobil |sunoco|marathon gas|parking|transit|metro |mta |bart|caltrain|auto loan|car payment/.test(d)) return { subcategory: "transportation", needsWant: "need" };
  if (/restaurant|doordash|grubhub|uber eats|ubereats|mcdonald|starbucks|chipotle|pizza|taco |burger|diner|cafe |bistro|sushi|thai food|chinese food/.test(d)) return { subcategory: "dining_out", needsWant: "want" };
  if (/netflix|hulu|disney[\+ ]|hbo |max\b|peacock|paramount\+|showtime|amc\+|movie theater|cinema|concert|ticketmaster|live nation|apple music|tidal|pandora/.test(d)) return { subcategory: "entertainment", needsWant: "want" };
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
           COUNT(*)                                                          AS total_count
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

  // POST /api/transactions/import-from-entries — import from existing income/expense entries
  app.post("/api/transactions/import-from-entries", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;

      const { rows: income } = await pool.query(
        `SELECT name, amount, frequency, category, created_at FROM income_entries WHERE user_id=$1`, [userId]
      );
      const { rows: expenses } = await pool.query(
        `SELECT name, amount, frequency, category, created_at FROM expense_entries WHERE user_id=$1`, [userId]
      );

      let inserted = 0;
      const today = new Date().toISOString().split("T")[0];

      for (const e of income) {
        const cat = autoCategorizeFn(e.name, "income");
        await pool.query(
          `INSERT INTO transactions (user_id, date, description, merchant, amount, type, subcategory, needs_want, source)
           VALUES ($1,$2,$3,$4,$5,'income',$6,$7,'import')
           ON CONFLICT DO NOTHING`,
          [userId, today, e.name, e.name, Math.abs(parseFloat(e.amount)), cat.subcategory, cat.needsWant]
        );
        inserted++;
      }
      for (const e of expenses) {
        const cat = autoCategorizeFn(e.name, "expense");
        await pool.query(
          `INSERT INTO transactions (user_id, date, description, merchant, amount, type, subcategory, needs_want, source)
           VALUES ($1,$2,$3,$4,$5,'expense',$6,$7,'import')
           ON CONFLICT DO NOTHING`,
          [userId, today, e.name, e.name, Math.abs(parseFloat(e.amount)), cat.subcategory, cat.needsWant]
        );
        inserted++;
      }

      const recurringMarked = await detectAndMarkRecurring(userId);
      res.json({ inserted, recurringMarked });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to import from entries" });
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
