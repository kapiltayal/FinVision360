import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PlaidApi } from "plaid";
import { registerFinanceTrackerRoutes } from "./finance-tracker-routes";
import { requireAuth } from "./auth";
import { pool } from "./db";
import { storage } from "./storage";

test("merchant categories guide imports and existing routes without overriding user choices", async () => {
  const routes = new Map<string, any[]>();
  const app = Object.fromEntries(["get", "post", "put", "patch", "delete"].map(method =>
    [method, (path: string, ...handlers: any[]) => routes.set(`${method} ${path}`, handlers)]));
  registerFinanceTrackerRoutes(app as any);
  const suffix = randomUUID();
  const userId = `merchant-category-test-${suffix}`;
  const otherUser = `merchant-category-other-${suffix}`;
  const names = ["Catalog Shop", "Connected Shop", "Renamed Shop"].map(name => `${name} ${suffix}`);
  const merchantIds: number[] = [];
  const originalItems = storage.getPlaidItems;
  const originalAccounts = storage.getPlaidAccounts;
  const originalTransactionsGet = PlaidApi.prototype.transactionsGet;
  const originalRecurringGet = PlaidApi.prototype.transactionsRecurringGet;
  const invoke = async (method: string, path: string, extra: any = {}) => {
    const handlers = routes.get(`${method} ${path}`)!;
    assert.equal(handlers[0], requireAuth);
    const response = {
      statusCode: 200, body: undefined as any,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; },
    };
    await handlers[handlers.length - 1]({
      user: { id: userId }, query: {}, params: {}, body: {}, ...extra,
    }, response);
    return response;
  };
  try {
    const categories = (await pool.query(
      "SELECT id, category, parent_category, need_vs_want FROM transaction_type_list WHERE lower(type)='expense' AND lower(category)<>'unassigned' ORDER BY id",
    )).rows;
    const primary = categories[0];
    const alternate = categories.find(row => row.category !== primary?.category);
    assert.ok(primary && alternate, "development lookup contains distinct expense categories");
    for (let index = 0; index < names.length; index++) {
      const result = await pool.query(
        "INSERT INTO merchants (name, category_id, is_known_subscription) VALUES ($1,$2,TRUE) RETURNING id",
        [names[index], index === 2 ? alternate.id : primary.id],
      );
      merchantIds.push(result.rows[0].id);
    }

    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const preview = async (category?: any, selectedUser = userId) => invoke("post", "/api/transactions/ingest/preview", {
      user: { id: selectedUser },
      file: {
        originalname: "transactions.csv", mimetype: "text/csv",
        buffer: Buffer.from(
          `Date,Description,Amount,Type,Category,Parent Category,Need Want\n2026-09-01,${quote(names[0])},31.23,expense,${category ? quote(category.category) : ""},${category ? quote(category.parent_category) : ""},need\n`,
        ),
      },
    });
    const first = await preview();
    assert.equal(first.statusCode, 200);
    assert.equal(first.body.entries[0].subcategory, primary.category);
    assert.equal(first.body.entries[0].parentCategory, primary.parent_category);
    assert.equal(first.body.entries[0].needsWant, "need", "source Need / Want survives profile suggestion");
    assert.equal(first.body.entries[0].amount, "31.23");
    assert.equal(first.body.entries[0].isRecurring, true, "subscription-only profiles tag rows before preview");
    assert.equal(first.body.entries[0].recurringType, "subscription");
    const sourceChoice = await preview(alternate);
    assert.equal(sourceChoice.body.entries[0].subcategory, alternate.category, "valid source category wins over profile");

    const reviewed = {
      ...first.body.entries[0], subcategory: alternate.category, parentCategory: alternate.parent_category,
      isRecurring: false, recurringType: "", recurringFreq: "", recurrenceOverride: true,
    };
    const saved = await invoke("post", "/api/transactions/import-reviewed", {
      body: { entries: [reviewed], requestId: randomUUID() },
    });
    assert.equal(saved.statusCode, 200);
    const uploaded = (await pool.query(
      "SELECT * FROM transactions WHERE user_id=$1 AND source='upload'", [userId],
    )).rows[0];
    assert.equal(uploaded.subcategory, alternate.category, "reviewed category is not replaced at save");
    assert.equal(uploaded.parent_category, alternate.parent_category);
    assert.equal(Number(uploaded.amount), 31.23);
    assert.equal(uploaded.is_recurring, false, "save must not rerun detection and undo the reviewer");
    assert.equal(uploaded.is_user_modified, true);

    const manualBody = { date: "2026-09-02", description: names[0], amount: "42.50", type: "expense" };
    const manual = await invoke("post", "/api/transactions", { body: manualBody });
    assert.equal(manual.statusCode, 201);
    assert.equal(manual.body.subcategory, primary.category, "manual creation uses the known profile");
    assert.equal(manual.body.parent_category, primary.parent_category);
    const edited = await invoke("patch", "/api/transactions/:id", {
      params: { id: String(manual.body.id) },
      body: { subcategory: alternate.category, parentCategory: alternate.parent_category },
    });
    assert.equal(edited.statusCode, 200);
    const later = await invoke("post", "/api/transactions", { body: manualBody });
    assert.equal(later.body.subcategory, alternate.category, "user correction wins over catalog in single creation");
    const preferencePreview = await preview(primary);
    assert.equal(preferencePreview.body.entries[0].subcategory, alternate.category, "user correction wins over file/category suggestion");
    assert.equal(preferencePreview.body.entries[0].isRecurring, false, "negative review overrides beat subscription profiles");
    const otherPreview = await preview(undefined, otherUser);
    assert.equal(otherPreview.body.entries[0].subcategory, primary.category, "preferences do not cross user boundaries");
    const explicit = await invoke("post", "/api/transactions", {
      body: { ...manualBody, subcategory: primary.category, parentCategory: primary.parent_category },
    });
    assert.equal(explicit.body.subcategory, primary.category, "explicit creation choice remains authoritative");

    const summaryEntries = [
      { description: `Summary subscription ${suffix}`, amount: "8.99", recurringType: "subscription" },
      { description: `Summary bill ${suffix}`, amount: "83.45", recurringType: "recurring_bill" },
    ];
    for (const item of summaryEntries) {
      await pool.query(
        `INSERT INTO transactions
           (user_id,date,description,merchant,amount,type,parent_category,subcategory,needs_want,is_recurring,recurring_type,source)
         VALUES ($1,'2026-09-04',$2,$2,$3,'expense',$4,$5,'na',TRUE,$6,'upload')`,
        [userId, item.description, item.amount, primary.parent_category, primary.category, item.recurringType],
      );
    }
    const insights = await invoke("get", "/api/transactions/insights");
    assert.equal(insights.statusCode, 200);
    assert.equal(insights.body.subscriptions.count, "1");
    assert.equal(Number(insights.body.subscriptions.total), 8.99);
    assert.equal(insights.body.subscriptions.items[0].name, summaryEntries[0].description);
    assert.equal(insights.body.recurringBills.count, "1");
    assert.equal(Number(insights.body.recurringBills.total), 83.45);
    assert.equal(insights.body.recurringBills.items[0].name, summaryEntries[1].description);

    // Stub provider calls, not auth or database SQL. No real bank/API requests.
    storage.getPlaidItems = async () => [{
      id: 1, accessToken: "fixture-token", institutionName: "Fixture Bank",
    }] as any;
    storage.getPlaidAccounts = async () => [{
      plaidAccountId: "fixture-account", plaidItemId: 1, name: "Fixture Checking",
    }] as any;
    let bankName = names[1];
    PlaidApi.prototype.transactionsRecurringGet = async () => ({
      data: { inflow_streams: [], outflow_streams: [{
        is_active: true, account_id: "fixture-account", frequency: "WEEKLY",
        transaction_ids: [`catalog-${suffix}`, `preference-${suffix}`],
      }] },
    }) as any;
    PlaidApi.prototype.transactionsGet = async () => ({
      data: {
        total_transactions: 2,
        transactions: [
          { transaction_id: `catalog-${suffix}`, merchant_name: bankName, name: bankName,
            account_id: "fixture-account", date: "2026-09-03", amount: 17.25, iso_currency_code: "USD", pending: false },
          { transaction_id: `preference-${suffix}`, merchant_name: names[0], name: names[0],
            account_id: "fixture-account", date: "2026-09-03", amount: 19.25, iso_currency_code: "USD", pending: false },
        ],
      },
    }) as any;
    const importBank = () => invoke("post", "/api/transactions/import-from-plaid", {
      body: { startDate: "2026-09-01", endDate: "2026-09-30" },
    });
    const bank = await importBank();
    assert.equal(bank.statusCode, 200);
    assert.equal(bank.body.inserted, 2);
    const bankRow = async (id: string) => (await pool.query(
      "SELECT * FROM transactions WHERE user_id=$1 AND plaid_transaction_id=$2", [userId, `${id}-${suffix}`],
    )).rows[0];
    assert.equal((await bankRow("catalog")).subcategory, primary.category);
    assert.equal((await bankRow("catalog")).recurring_type, "recurring_bill", "Plaid stream beats subscription-only profile");
    assert.equal((await bankRow("catalog")).recurring_freq, "Weekly");
    assert.equal((await bankRow("preference")).subcategory, alternate.category, "Plaid respects explicit merchant preference");
    assert.equal((await bankRow("preference")).is_recurring, false, "user recurrence override beats Plaid signal");

    await pool.query("UPDATE merchants SET category_id=$1 WHERE id=$2", [alternate.id, merchantIds[1]]);
    const refresh = await importBank();
    assert.equal(refresh.statusCode, 200);
    assert.equal(refresh.body.updated, 2);
    assert.equal((await bankRow("catalog")).subcategory, alternate.category, "uncorrected existing bank rows use latest profile FK");
    const existing = await bankRow("catalog");
    const bankEdit = await invoke("patch", "/api/transactions/:id", {
      params: { id: String(existing.id) },
      body: {
        subcategory: primary.category, parentCategory: primary.parent_category,
        needsWant: "need", isRecurring: false, recurringType: null,
      },
    });
    assert.equal(bankEdit.statusCode, 200);
    bankName = names[2]; // The new bank identity has no user preference and suggests alternate.
    assert.equal((await importBank()).statusCode, 200);
    const preserved = await bankRow("catalog");
    assert.equal(preserved.merchant, bankName, "bank metadata may refresh");
    assert.equal(preserved.subcategory, primary.category, "edited bank category survives a different profile suggestion");
    assert.equal(preserved.parent_category, primary.parent_category);
    assert.equal(preserved.needs_want, "need");
    assert.equal(preserved.is_user_modified, true);
    assert.equal(preserved.is_recurring, false);
    PlaidApi.prototype.transactionsRecurringGet = async () => { throw new Error("Fixture recurring product unavailable"); };
    const noSignals = await importBank();
    assert.equal(noSignals.statusCode, 200, "unavailable optional recurring product must not block importing");
    assert.deepEqual(noSignals.body.recurrenceSignalsUnavailableInstitutions, ["Fixture Bank"]);
  } finally {
    storage.getPlaidItems = originalItems;
    storage.getPlaidAccounts = originalAccounts;
    PlaidApi.prototype.transactionsGet = originalTransactionsGet;
    PlaidApi.prototype.transactionsRecurringGet = originalRecurringGet;
    await pool.query("DELETE FROM transaction_change_history WHERE user_id=ANY($1::text[])", [[userId, otherUser]]);
    await pool.query("DELETE FROM transaction_import_receipts WHERE user_id=ANY($1::text[])", [[userId, otherUser]]);
    await pool.query("DELETE FROM transactions WHERE user_id=ANY($1::text[])", [[userId, otherUser]]);
    await pool.query("DELETE FROM merchants WHERE id=ANY($1::int[])", [merchantIds]);
    await pool.end();
  }
});
