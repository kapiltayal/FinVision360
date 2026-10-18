import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { and, eq, inArray } from "drizzle-orm";
import { assets, liabilities, retirementAccountProjectionPreferences as preferences, retirementProjectionItemPreferences as itemPreferences } from "@shared/schema";
import { retirementAccountInclusionSchema, resetRetirementAccountInclusionSchema, type RetirementAccountInclusionInput } from "@shared/retirement-account-inclusion";
import { db } from "./db";
import { storage } from "./storage";
import { getRetirementItemPreferences, saveRetirementItemInclusion } from "./retirement-item-inclusion";

/** Additive migration used by development and published application bootstrap. */
export async function ensureRetirementAccountInclusionSchema(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(57104)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS retirement_account_projection_preferences (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
        liability_id INTEGER REFERENCES liabilities(id) ON DELETE CASCADE,
        net_worth_included BOOLEAN NOT NULL DEFAULT TRUE,
        income_expense_included BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT retirement_account_preferences_one_account
          CHECK ((asset_id IS NOT NULL) <> (liability_id IS NOT NULL))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS retirement_account_preferences_user_asset_unique
        ON retirement_account_projection_preferences(user_id, asset_id);
      CREATE UNIQUE INDEX IF NOT EXISTS retirement_account_preferences_user_liability_unique
        ON retirement_account_projection_preferences(user_id, liability_id);
      CREATE TABLE IF NOT EXISTS retirement_projection_item_preferences (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        item_id INTEGER NOT NULL,
        included BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT retirement_item_preferences_kind_id CHECK (
          (kind IN ('social-security', 'expected-expenses') AND item_id = 0)
          OR (kind IN ('net-worth-entry', 'income-expense-entry', 'pension') AND item_id > 0)
        )
      );
      CREATE UNIQUE INDEX IF NOT EXISTS retirement_item_preferences_user_kind_item_unique
        ON retirement_projection_item_preferences(user_id, kind, item_id);
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function getRetirementAccountPreferences(userId: string) {
  return db.select().from(preferences).where(eq(preferences.userId, userId));
}

/** Reset the user's active scenario atomically, without changing the other view. */
export async function resetRetirementAccountInclusion(userId: string, projection: RetirementAccountInclusionInput["projection"]) {
  await db.transaction(async (tx) => {
    const field = projection === "net-worth" ? "netWorthIncluded" : "incomeExpenseIncluded";
    await tx.update(preferences).set({ [field]: true, updatedAt: new Date() }).where(eq(preferences.userId, userId));
    const kinds = projection === "net-worth" ? ["net-worth-entry"]
      : ["income-expense-entry", "pension", "social-security", "expected-expenses"];
    await tx.update(itemPreferences).set({ included: true, updatedAt: new Date() }).where(and(
      eq(itemPreferences.userId, userId), inArray(itemPreferences.kind, kinds),
    ));
  });
}

/** Ownership check and upsert share a transaction; only the requested flag changes. */
export async function saveRetirementAccountInclusion(userId: string, input: RetirementAccountInclusionInput) {
  if (input.kind !== "asset" && input.kind !== "liability") return saveRetirementItemInclusion(userId, input);
  return db.transaction(async (tx) => {
    const [account] = input.kind === "asset"
      ? await tx.select({ id: assets.id }).from(assets)
        .where(and(eq(assets.id, input.accountId), eq(assets.userId, userId))).for("update")
      : await tx.select({ id: liabilities.id }).from(liabilities)
        .where(and(eq(liabilities.id, input.accountId), eq(liabilities.userId, userId))).for("update");
    if (!account) return null;

    const field = input.projection === "net-worth" ? "netWorthIncluded" : "incomeExpenseIncluded";
    const [saved] = await tx.insert(preferences).values({
      userId,
      assetId: input.kind === "asset" ? input.accountId : null,
      liabilityId: input.kind === "liability" ? input.accountId : null,
      [field]: input.included,
    }).onConflictDoUpdate({
      target: input.kind === "asset"
        ? [preferences.userId, preferences.assetId]
        : [preferences.userId, preferences.liabilityId],
      set: { [field]: input.included, updatedAt: new Date() },
    }).returning();
    return saved;
  });
}

export function registerRetirementAccountInclusionRoutes(app: Express, requireAuth: RequestHandler) {
  app.post("/api/retirement/account-inclusion/reset", requireAuth, async (req, res) => {
    const parsed = resetRetirementAccountInclusionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Choose a valid retirement projection to reset." });
    await resetRetirementAccountInclusion((req.user as { id: string }).id, parsed.data.projection);
    res.json({ success: true });
  });

  app.get("/api/retirement/account-inclusion", requireAuth, async (req, res) => {
    const userId = (req.user as { id: string }).id;
    const [userAssets, userLiabilities, saved, items] = await Promise.all([
      storage.getAssets(userId), storage.getLiabilities(userId), getRetirementAccountPreferences(userId), getRetirementItemPreferences(userId),
    ]);
    const byAsset = new Map(saved.filter((row) => row.assetId !== null).map((row) => [row.assetId, row]));
    const byLiability = new Map(saved.filter((row) => row.liabilityId !== null).map((row) => [row.liabilityId, row]));
    res.json({ accounts: [
      ...userAssets.map((account) => ({
        id: account.id, kind: "asset", name: account.name, category: account.category, balance: account.value,
        netWorthIncluded: byAsset.get(account.id)?.netWorthIncluded ?? true,
        incomeExpenseIncluded: byAsset.get(account.id)?.incomeExpenseIncluded ?? true,
      })),
      ...userLiabilities.map((account) => ({
        id: account.id, kind: "liability", name: account.name, category: account.category, balance: account.balance,
        netWorthIncluded: byLiability.get(account.id)?.netWorthIncluded ?? true,
        incomeExpenseIncluded: byLiability.get(account.id)?.incomeExpenseIncluded ?? true,
      })),
    ], items });
  });

  app.put("/api/retirement/account-inclusion", requireAuth, async (req, res) => {
    const parsed = retirementAccountInclusionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Choose a valid account, projection, and inclusion setting." });
    }
    const saved = await saveRetirementAccountInclusion((req.user as { id: string }).id, parsed.data);
    if (!saved) return res.status(404).json({ message: "Account not found." });
    res.json(saved);
  });
}
