/**
 * Seed 18 months of dummy asset_history + liability_history
 * for user c00a5b8e-bf78-4fc4-be15-2f74a53c9291 in the dev DB.
 *
 * Run: npx tsx scripts/seed-history.ts
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { assetHistory, liabilityHistory, assets, liabilities } from "../shared/schema";

const USER_ID = "c00a5b8e-bf78-4fc4-be15-2f74a53c9291";
const MONTHS = 18;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { assetHistory, liabilityHistory, assets, liabilities } });

/**
 * Work BACKWARDS from current value: what was this asset worth N months ago?
 * Reverses compound growth (with small random jitter) month by month.
 */
function assetValueMonthsAgo(current: number, monthsAgo: number, annualRate: number, jitterPct = 0.012): number {
  const monthlyRate = annualRate / 12;
  let v = current;
  for (let m = 0; m < monthsAgo; m++) {
    const noise = 1 + (Math.random() * 2 - 1) * jitterPct;
    v = v / ((1 + monthlyRate) * noise);
  }
  return Math.max(0, Math.round(v * 100) / 100);
}

/**
 * Work BACKWARDS from current balance: what was this liability N months ago?
 * Each month going back: reverse one payment cycle (balance was higher).
 */
function liabilityBalanceMonthsAgo(current: number, monthsAgo: number, annualRate: number, minPayment: number): number {
  const monthlyRate = annualRate / 100 / 12;
  let b = current;
  for (let m = 0; m < monthsAgo; m++) {
    // Forward step: b_next = b + interest - payment
    // Reverse: b_prev = (b_next + payment) / (1 + monthlyRate)
    const interest = b * monthlyRate;
    const payment = Math.max(minPayment, interest + 10);
    b = (b + payment) / (1 + monthlyRate);
  }
  return Math.max(0, Math.round(b * 100) / 100);
}

async function main() {
  const userAssets = await db.select().from(assets).where(eq(assets.userId, USER_ID));
  const userLiabilities = await db.select().from(liabilities).where(eq(liabilities.userId, USER_ID));

  console.log(`Found ${userAssets.length} assets, ${userLiabilities.length} liabilities`);

  if (userAssets.length === 0 && userLiabilities.length === 0) {
    console.error("No records found for this user — aborting.");
    process.exit(1);
  }

  // Build snapshot timestamps: 18 months ago → 1 month ago (1st of each month, noon UTC)
  const snapshots: Date[] = [];
  const now = new Date();
  for (let i = MONTHS; i >= 1; i--) {
    snapshots.push(new Date(now.getFullYear(), now.getMonth() - i, 1, 12, 0, 0));
  }

  // ── Asset history ────────────────────────────────────────────────────────────
  const assetRows = [];
  for (const asset of userAssets) {
    const base = parseFloat(asset.value as string) || 1000;

    let annualRate: number;
    const ror = parseFloat(asset.interestRate as string);
    if (!isNaN(ror) && ror > 0) {
      annualRate = ror / 100;
    } else {
      const cat = (asset.category ?? "").toLowerCase();
      if (cat.includes("property") || cat.includes("real_estate")) annualRate = 0.06;
      else if (cat.includes("retirement") || cat.includes("investment") || cat.includes("brokerage") || cat.includes("crypto")) annualRate = 0.08;
      else if (cat.includes("vehicle") || cat.includes("auto")) annualRate = -0.12;
      else if (cat.includes("savings") || cat.includes("checking") || cat.includes("cash") || cat.includes("bank")) annualRate = 0.045;
      else annualRate = 0.05;
    }

    for (let i = 0; i < MONTHS; i++) {
      const monthsAgo = MONTHS - i; // index 0 → 18 months ago, index 17 → 1 month ago
      const historicValue = assetValueMonthsAgo(base, monthsAgo, annualRate);
      assetRows.push({
        userId: USER_ID,
        assetId: asset.id,
        name: asset.name,
        category: asset.category ?? "Other",
        value: historicValue.toFixed(2),
        interestRate: asset.interestRate?.toString() ?? "0",
        institution: asset.institution ?? null,
        notes: null,
        snapshotAt: snapshots[i],
      });
    }
  }

  // ── Liability history ─────────────────────────────────────────────────────────
  const liabilityRows = [];
  for (const liability of userLiabilities) {
    const currentBal = parseFloat(liability.balance as string) || 0;   // ← correct field: balance
    const rate = parseFloat(liability.interestRate as string) || 5;
    const minPay = parseFloat(liability.minimumPayment as string) || 50;

    for (let i = 0; i < MONTHS; i++) {
      const monthsAgo = MONTHS - i;
      const historicBal = liabilityBalanceMonthsAgo(currentBal, monthsAgo, rate, minPay);
      liabilityRows.push({
        userId: USER_ID,
        liabilityId: liability.id,
        name: liability.name,
        category: liability.category ?? "Other",
        balance: historicBal.toFixed(2),
        interestRate: liability.interestRate?.toString() ?? "0",
        minimumPayment: liability.minimumPayment?.toString() ?? "0",
        institution: liability.institution ?? null,
        notes: null,
        snapshotAt: snapshots[i],
      });
    }
  }

  // Clear old data then insert fresh
  const { rowCount: aDeleted } = await db.delete(assetHistory).where(eq(assetHistory.userId, USER_ID));
  const { rowCount: lDeleted } = await db.delete(liabilityHistory).where(eq(liabilityHistory.userId, USER_ID));
  console.log(`Cleared ${aDeleted} asset_history + ${lDeleted} liability_history rows`);

  if (assetRows.length > 0) {
    await db.insert(assetHistory).values(assetRows);
    console.log(`✓ Inserted ${assetRows.length} asset_history rows`);
    console.log(`  Sample: month[0] value = ${assetRows[0].value}, month[17] value = ${assetRows[17].value}`);
  }

  if (liabilityRows.length > 0) {
    await db.insert(liabilityHistory).values(liabilityRows);
    console.log(`✓ Inserted ${liabilityRows.length} liability_history rows`);
    console.log(`  Sample: month[0] balance = ${liabilityRows[0].balance}, month[17] balance = ${liabilityRows[17].balance}`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
