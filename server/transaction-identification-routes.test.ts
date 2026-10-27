import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Completions } from "openai/resources/chat/completions";
import { PlaidApi } from "plaid";
import { registerFinanceTrackerRoutes } from "./finance-tracker-routes";
import { pool } from "./db";
import { storage } from "./storage";
import { requireAuth } from "./auth";

test("uploads and Plaid identify before duplicates/recurrence, retain unresolved rows and protect reviewed preferences", async () => {
  const routes = new Map<string, any[]>();
  registerFinanceTrackerRoutes(Object.fromEntries(["get", "post", "put", "patch", "delete"].map(method =>
    [method, (path: string, ...handlers: any[]) => routes.set(`${method} ${path}`, handlers)])) as any);
  const userId = `identification-${randomUUID()}`;
  const otherUser = `identification-other-${randomUUID()}`;
  const suffix = randomUUID();
  const profileName = `Catalog Store ${suffix}`;
  const fileAlias = `File Alias ${suffix}`;
  const bankAlias = `Bank Alias ${suffix}`;
  const historyName = `History Store ${suffix}`;
  const preferredName = `My Favorite Shop ${suffix}`;
  const unknown = `Unlisted Merchant ${suffix}`;
  const nullMerchant = `Unclassified Merchant ${suffix}`;
  const merchantIds: number[] = [];
  const original = {
    complete: Completions.prototype.create, get: PlaidApi.prototype.transactionsGet,
    recurring: PlaidApi.prototype.transactionsRecurringGet,
    items: storage.getPlaidItems, accounts: storage.getPlaidAccounts, query: pool.query,
  };
  const query = original.query.bind(pool);
  let classificationCompleted = false;
  let failAI = false;
  let aiCalls = 0;
  const invoke = async (method: string, path: string, extra: any = {}) => {
    const handlers = routes.get(`${method} ${path}`)!;
    assert.equal(handlers[0], requireAuth);
    const response = {
      statusCode: 200, body: undefined as any,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; },
    };
    await handlers.at(-1)({ user: { id: userId }, params: {}, body: {}, query: {}, ...extra }, response);
    return response;
  };
  try {
    const categories = (await query(
      "SELECT id,category,parent_category FROM transaction_type_list WHERE lower(type)='expense' AND lower(category)<>'unassigned' ORDER BY id",
    )).rows;
    const primary = categories[0], alternate = categories.find(row => row.category !== primary.category);
    assert.ok(primary && alternate);
    const manual = await invoke("post", "/api/transactions", {
      body: {
        date: "2026-09-01", description: `Manual source ${suffix}`, amount: 19,
        type: "expense", subcategory: primary.category, parentCategory: primary.parent_category,
      },
    });
    assert.equal(manual.statusCode, 201);
    assert.equal(manual.body.merchant_source, "manual_entry");
    assert.equal(manual.body.category_source, "user_selected");
    for (const name of [profileName, historyName]) {
      merchantIds.push((await query(
        "INSERT INTO merchants(name,category_id,is_known_subscription,keywords) VALUES ($1,$2,TRUE,$3) RETURNING id",
        [name, primary.id, name === profileName ? `${fileAlias}, ${bankAlias}` : null],
      )).rows[0].id);
    }
    const historicalId = (await query(
      `INSERT INTO transactions(user_id,date,description,merchant,amount,type,parent_category,subcategory,source)
       VALUES ($1,'2026-09-01',$2,$3,20,'expense',$4,$5,'manual') RETURNING id`,
      [userId, `SQ *${historyName} #100 CA`, preferredName, alternate.parent_category, alternate.category],
    )).rows[0].id;
    // No history/preferences from another user may influence the signed-in user's imports.
    await query(
      `INSERT INTO transactions(user_id,date,description,merchant,amount,type,parent_category,subcategory,source)
       VALUES ($1,'2026-09-01',$2,$2,20,'expense',$3,$4,'manual')`,
      [otherUser, unknown, alternate.parent_category, alternate.category],
    );
    Completions.prototype.create = (async (request: any) => {
      aiCalls++;
      const input = JSON.parse(request.messages.find((message: any) => message.role === "user").content);
      assert.ok(input.rows.length <= 25);
      assert.ok(input.categories.every((row: any) => row.id && row.description !== undefined));
      classificationCompleted = true;
      if (failAI) throw new Error("Fixture AI failure");
      return { choices: [{ message: { content: JSON.stringify({ entries: input.rows.map((row: any) => ({
        sourceIndex: row.sourceIndex,
         categoryId: row.transaction.merchant.toLowerCase().includes("unclassified") ? null : primary.id,
      })) }) } }] };
    }) as any;
    (pool as any).query = (sql: any, params: any) => {
      if (String(sql).includes('upload_source_id AS "sourceTransactionId"') ||
          String(sql).includes("INSERT INTO transactions (")) {
        assert.ok(classificationCompleted, "merchant/category identification must finish before duplicate queries/upserts");
      }
      return query(sql, params);
    };
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const file = {
      originalname: "identification.csv", mimetype: "text/csv",
      buffer: Buffer.from(`Date,Description,Merchant,Amount,Type,Category,Parent Category\n` + [
        ["2026-09-02", "Raw descriptor one", `SQ *${profileName} #101 CA`, "10", "expense", alternate.category, alternate.parent_category],
        ["2026-09-02", "Raw descriptor two", `TST*${profileName} #102 CA`, "10", "expense", "", ""],
        ["2026-09-03", unknown, unknown, "11", "expense", "", ""],
        ["2026-09-04", nullMerchant, nullMerchant, "12", "expense", "", ""],
        ["2026-09-05", `SQ *${historyName} #103 CA`, `SQ *${historyName} #103 CA`, "13", "expense", primary.category, primary.parent_category],
         ["2026-09-07", "File alias narrative", fileAlias, "31", "expense", "", ""],
         ["2026-09-08", "Embedded alias narrative", `purchase ${fileAlias} chicago`, "32", "expense", "", ""],
      ].map(row => row.map(quote).join(",")).join("\n")),
    };
    const preview = await invoke("post", "/api/transactions/ingest/preview", { file });
    assert.equal(preview.statusCode, 200);
    const entries = preview.body.entries;
    assert.equal(entries[0].merchant, profileName);
    assert.equal(entries[0].description, "Raw descriptor one");
    assert.equal(entries[0].subcategory, primary.category, "catalog wins over supplied category");
    assert.equal(entries[0].isRecurring, true, "recurrence sees resolved global identity");
    assert.equal(entries[1].duplicate.kind, "possible", "clean identities feed duplicate detection");
    assert.equal(entries[1].include, false);
    assert.equal(entries[2].subcategory, primary.category, "other user's category choice cannot leak");
    assert.equal(entries[3].subcategory, "", "unmatched rows remain in preview");
    assert.equal(entries[4].merchant, preferredName);
    assert.equal(entries[4].subcategory, alternate.category);
    assert.equal(entries[5].merchant, profileName);
    assert.equal(entries[5].merchantSource, "EXACT_MATCH");
    assert.equal(entries[6].merchant, profileName);
    assert.equal(entries[6].merchantSource, "MERCHANT_STRING_MATCH");
    assert.equal(aiCalls, 1, "only unresolved rows are classified together");
    assert.equal(Number((await query("SELECT COUNT(*) FROM transactions WHERE user_id=$1", [userId])).rows[0].count), 2,
      "preview does not write; only the explicit manual fixture and history exist");
    const reviewed = { ...entries[2], merchant: `Reviewed Shop ${suffix}`, merchantOverride: true,
      subcategory: alternate.category, parentCategory: alternate.parent_category, categoryOverride: true };
    const saved = await invoke("post", "/api/transactions/import-reviewed", {
      body: { entries: [reviewed], requestId: randomUUID() },
    });
    assert.equal(saved.statusCode, 200);
    const reviewedSaved = (await query(
      "SELECT merchant_source, category_source FROM transactions WHERE user_id=$1 AND merchant=$2",
      [userId, reviewed.merchant],
    )).rows[0];
    assert.equal(reviewedSaved.merchant_source, "user_edit");
    assert.equal(reviewedSaved.category_source, "user_edit");
    const reviewedHistory = await invoke("post", "/api/transactions/ingest/preview", {
      file: { ...file, buffer: Buffer.from(`Date,Description,Merchant,Amount\n2026-09-10,${quote(unknown)},${quote(unknown)},14`) },
    });
    assert.equal(reviewedHistory.body.entries[0].merchant, reviewed.merchant);
    assert.equal(reviewedHistory.body.entries[0].subcategory, alternate.category);
    assert.equal(aiCalls, 1, "review choices are now explicit history preferences");
    assert.ok(historicalId);
    const aliasSaved = await invoke("post", "/api/transactions/import-reviewed", {
      body: { entries: [entries[5], entries[6]], requestId: randomUUID() },
    });
    assert.equal(aliasSaved.statusCode, 200);
    const savedAliases = (await query(
      "SELECT merchant_source, category_source FROM transactions WHERE user_id=$1 AND description IN ($2,$3) ORDER BY date",
      [userId, "File alias narrative", "Embedded alias narrative"],
    )).rows;
    assert.deepEqual(savedAliases, [
      { merchant_source: "EXACT_MATCH", category_source: "MERCHANT_CAT" },
      { merchant_source: "MERCHANT_STRING_MATCH", category_source: "MERCHANT_CAT" },
    ]);

    const longMerchant = `Long merchant ${"x".repeat(2400)}`;
    const longPreview = await invoke("post", "/api/transactions/ingest/preview", {
      file: { ...file, buffer: Buffer.from(
        `Date,Description,Merchant,Amount,Category,Parent Category\n2026-09-11,Original long source narrative,${quote(longMerchant)},15,${quote(primary.category)},${quote(primary.parent_category)}`,
      ) },
    });
    assert.equal(longPreview.statusCode, 200);
    const longRow = longPreview.body.entries[0];
    assert.ok(longRow.merchant.length > 2000, "visible source merchant remains available for repair");
    assert.equal(longRow.sourceMerchant.length, 2000, "uneditable alias metadata is bounded before preview");
    const longSaved = await invoke("post", "/api/transactions/import-reviewed", {
      body: { entries: [{ ...longRow, merchant: "Corrected long merchant", merchantOverride: true }], requestId: randomUUID() },
    });
    assert.equal(longSaved.statusCode, 200, "correcting the visible merchant is sufficient to save a long source row");

    storage.getPlaidItems = async () => [{ id: 1, accessToken: "fixture-only", institutionName: "Fixture Bank" }] as any;
    storage.getPlaidAccounts = async () => [{ plaidItemId: 1, plaidAccountId: "owned", name: "Checking" }] as any;
    PlaidApi.prototype.transactionsRecurringGet = async () => ({ data: { inflow_streams: [], outflow_streams: [] } }) as any;
    const bankUnknown = `Bank Unknown ${suffix}`;
    const transactions = [bankUnknown, nullMerchant, bankAlias, `SQ *${historyName} #400 CA`].map((merchant, index) => ({
      transaction_id: `${suffix}-${index}`, account_id: "owned", date: "2026-09-06", amount: 20 + index,
      merchant_name: merchant, name: merchant, original_description: `Original bank narrative ${index}`,
      iso_currency_code: "USD", pending: false,
      ...(index === 2 ? { category: [alternate.category] } : {}),
    }));
    PlaidApi.prototype.transactionsGet = async () => ({ data: { total_transactions: 5,
      transactions: [...transactions, { ...transactions[0], transaction_id: `${suffix}-pending`, pending: true }] } }) as any;
    const importBank = () => invoke("post", "/api/transactions/import-from-plaid", {
      body: { startDate: "2026-09-01", endDate: "2026-09-30" },
    });
    classificationCompleted = false;
    const bank = await importBank();
    assert.equal(bank.statusCode, 200);
    assert.equal(bank.body.inserted, 4);
    assert.equal(bank.body.uncategorized, 1);
    assert.equal(bank.body.skippedReasons.pending, 1);
    const bankRows = (await query("SELECT * FROM transactions WHERE user_id=$1 AND source='plaid' ORDER BY plaid_transaction_id", [userId])).rows;
    assert.equal(bankRows[0].subcategory, primary.category);
    assert.equal(bankRows[0].merchant_source, "NO_MATCH");
    assert.equal(bankRows[0].category_source, "AI_MATCH");
    assert.equal(bankRows[0].description, "Original bank narrative 0");
    assert.equal(bankRows[1].subcategory, "unassigned", "unresolved Plaid rows are retained");
    assert.equal(bankRows[1].category_source, "NO_MATCH");
    assert.equal(bankRows[2].merchant, profileName);
    assert.equal(bankRows[2].merchant_source, "EXACT_MATCH");
    assert.equal(bankRows[2].subcategory, primary.category);
    assert.equal(bankRows[2].category_source, "MERCHANT_CAT");
    assert.equal(bankRows[3].merchant, preferredName);
    assert.equal(bankRows[3].subcategory, alternate.category);
    assert.equal(bankRows[3].merchant_source, "USER_HISTORY");
    assert.equal(bankRows[3].category_source, "USER_HISTORY");
    assert.equal(bankRows[0].is_user_modified, false, "this category was automatic, not user-protected");
    failAI = true;
    classificationCompleted = false;
    const outageRefresh = await importBank();
    assert.equal(outageRefresh.statusCode, 200);
    assert.equal(outageRefresh.body.updated, 4);
    assert.equal(outageRefresh.body.uncategorized, 1, "counts reflect persisted categories, not failed suggestions");
    const automaticPreserved = (await query(
      "SELECT * FROM transactions WHERE user_id=$1 AND id=$2", [userId, bankRows[0].id],
    )).rows[0];
    assert.equal(automaticPreserved.subcategory, bankRows[0].subcategory, "AI outage cannot erase a valid automatic category");
    assert.equal(automaticPreserved.parent_category, bankRows[0].parent_category);
    assert.equal(automaticPreserved.needs_want, bankRows[0].needs_want);
    assert.equal(automaticPreserved.is_user_modified, false);
    const editedName = `User Bank Name ${suffix}`;
    const edited = await invoke("patch", "/api/transactions/:id", {
      params: { id: String(bankRows[0].id) },
      body: { description: editedName, subcategory: alternate.category, parentCategory: alternate.parent_category },
    });
    assert.equal(edited.statusCode, 200);
    failAI = true;
    classificationCompleted = false;
    const refreshed = await importBank();
    assert.equal(refreshed.statusCode, 200, "AI failure does not block Plaid refresh");
    assert.equal(refreshed.body.updated, 4);
    const preserved = (await query("SELECT * FROM transactions WHERE user_id=$1 AND id=$2", [userId, bankRows[0].id])).rows[0];
    assert.equal(preserved.merchant, editedName);
    assert.equal(preserved.description, editedName);
    assert.equal(preserved.subcategory, alternate.category);
    assert.equal(preserved.merchant_source, "user_edit");
    assert.equal(preserved.category_source, "user_edit");
    assert.equal(Number((await query("SELECT COUNT(*) FROM transactions WHERE user_id=$1 AND source='plaid'", [userId])).rows[0].count), 4,
      "replay upserts rather than inserting duplicates");
  } finally {
    Completions.prototype.create = original.complete;
    PlaidApi.prototype.transactionsGet = original.get;
    PlaidApi.prototype.transactionsRecurringGet = original.recurring;
    storage.getPlaidItems = original.items;
    storage.getPlaidAccounts = original.accounts;
    pool.query = original.query;
    await query("DELETE FROM transaction_change_history WHERE user_id=ANY($1::text[])", [[userId, otherUser]]);
    await query("DELETE FROM transaction_import_receipts WHERE user_id=ANY($1::text[])", [[userId, otherUser]]);
    await query("DELETE FROM transactions WHERE user_id=ANY($1::text[])", [[userId, otherUser]]);
    await query("DELETE FROM merchants WHERE id=ANY($1::int[])", [merchantIds]);
    await pool.end();
  }
});
