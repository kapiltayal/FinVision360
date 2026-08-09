/**
 * Seed 18 months of dummy asset_history + liability_history
 * for user c00a5b8e-bf78-4fc4-be15-2f74a53c9291 in the dev DB.
 *
 * Run: npx tsx scripts/seed-history.ts
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { assetHistory, liabilityHistory, assets, liabilities } from "../shared/schema";
import { eq } from "drizzle-orm";

const USER_ID = "c00a5b8e-bf78-4fc4-be15-2f74a53c9291";
const MONTHS = 18;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { assetHistory, liabilityHistory, assets, liabilities } });

/** Jitter a value by up to ±pct percent, compounded month over month */
function growValue(base: number, month: number, annualRate: number, jitterPct = 0.015): number {
  const monthlyRate = annualRate / 12;
  // compound growth with small random noise
  let v = base;
  for (let m = 0; m < month; m++) {
    const noise = 1 + (Math.random() * 2 - 1) * jitterPct;
    v = v * (1 + monthlyRate) * noise;
  }
  return Math.round(v * 100) / 100;
}

/** Shrink a liability balance by making monthly payments */
function shrinkBalance(base: number, month: number, annualRate: number, minPayment: number): number {
  let b = base;
  const monthlyRate = annualRate / 100 / 12;
  for (let m = 0; m < month; m++) {
    const interest = b * monthlyRate;
    const payment = Math.max(minPayment, interest + 10); // always pay at least interest + $10
    b = Math.max(0, b + interest - payment);
  }
  return Math.round(b * 100) / 100;
}

async function main() {
  // ── Fetch current records ──────────────────────────────────────────────────
  const userAssets = await db.select().from(assets).where(eq(assets.userId, USER_ID));
  const userLiabilities = await db.select().from(liabilities).where(eq(liabilities.userId, USER_ID));

  console.log(`Found ${userAssets.length} assets, ${userLiabilities.length} liabilities`);

  if (userAssets.length === 0 && userLiabilities.length === 0) {
    console.error("No records found for this user — aborting.");
    process.exit(1);
  }

  // ── Build snapshot timestamps (months ago, 1st of each month) ─────────────
  const snapshots: Date[] = [];
  const now = new Date();
  for (let i = MONTHS; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 12, 0, 0);
    snapshots.push(d);
  }

  // ── Asset history ──────────────────────────────────────────────────────────
  const assetRows = [];
  for (const asset of userAssets) {
    const base = parseFloat(asset.value as string) || 1000;
    // annual growth rate: use asset's rate_of_return if available, else guess by category
    let annualRate: number;
    const ror = parseFloat((asset as any).rateOfReturn as string);
    if (!isNaN(ror) && ror !== 0) {
      annualRate = ror / 100;
    } else {
      const cat = (asset.category ?? "").toLowerCase();
      if (cat.includes("real estate") || cat.includes("property")) annualRate = 0.06;
      else if (cat.includes("retirement") || cat.includes("investment") || cat.includes("brokerage")) annualRate = 0.08;
      else if (cat.includes("vehicle") || cat.includes("auto")) annualRate = -0.12; // depreciation
      else if (cat.includes("savings") || cat.includes("checking") || cat.includes("cash")) annualRate = 0.045;
      else annualRate = 0.05;
    }

    for (let i = 0; i < MONTHS; i++) {
      const monthsAgo = MONTHS - i; // 18 months ago → 1 month ago
      const historicValue = growValue(base, -monthsAgo, annualRate); // negative = go back in time
      assetRows.push({
        userId: USER_ID,
        assetId: asset.id,
        name: asset.name,
        category: asset.category ?? "Other",
        value: historicValue.toFixed(2),
        interestRate: (asset as any).rateOfReturn?.toString() ?? "0",
        institution: (asset as any).institution ?? null,
        notes: null,
        snapshotAt: snapshots[i],
      });
    }
  }

  // ── Liability history ──────────────────────────────────────────────────────
  const liabilityRows = [];
  for (const liability of userLiabilities) {
    const currentBalance = parseFloat(liability.currentBalance as string) || 0;
    const rate = parseFloat(liability.interestRate as string) || 5;
    const minPay = parseFloat(liability.minimumPayment as string) || 50;

    for (let i = 0; i < MONTHS; i++) {
      const monthsAgo = MONTHS - i;
      // work backwards: what was the balance N months ago?
      const historicBalance = shrinkBalance(currentBalance, monthsAgo, rate, minPay);
      liabilityRows.push({
        userId: USER_ID,
        liabilityId: liability.id,
        name: liability.name,
        category: liability.category ?? "Other",
        balance: historicBalance.toFixed(2),
        interestRate: liability.interestRate?.toString() ?? "0",
        minimumPayment: liability.minimumPayment?.toString() ?? "0",
        institution: (liability as any).institution ?? null,
        notes: null,
        snapshotAt: snapshots[i],
      });
    }
  }

  // ── Clear existing seed data for this user before inserting ───────────────
  const { rowCount: aDeleted } = await db.delete(assetHistory).where(eq(assetHistory.userId, USER_ID));
  const { rowCount: lDeleted } = await db.delete(liabilityHistory).where(eq(liabilityHistory.userId, USER_ID));
  console.log(`Cleared ${aDeleted} existing asset_history rows, ${lDeleted} liability_history rows`);

  // ── Insert ─────────────────────────────────────────────────────────────────
  if (assetRows.length > 0) {
    await db.insert(assetHistory).values(assetRows);
    console.log(`✓ Inserted ${assetRows.length} asset_history rows (${userAssets.length} assets × ${MONTHS} months)`);
  }

  if (liabilityRows.length > 0) {
    await db.insert(liabilityHistory).values(liabilityRows);
    console.log(`✓ Inserted ${liabilityRows.length} liability_history rows (${userLiabilities.length} liabilities × ${MONTHS} months)`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
