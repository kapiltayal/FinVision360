import { pool } from "../server/db";

async function main() {
  const userId = "c00a5b8e-bf78-4fc4-be15-2f74a53c9291";

  // Raw count check
  const count = await pool.query("SELECT COUNT(*) FROM asset_history WHERE user_id = $1", [userId]);
  console.log("asset_history count:", count.rows[0]);

  // Date_trunc query
  const r = await pool.query(
    `SELECT DATE_TRUNC('month', snapshot_at) AS month, SUM(value::numeric) AS total
     FROM asset_history WHERE user_id = $1 GROUP BY 1 ORDER BY 1 LIMIT 3`,
    [userId]
  );
  console.log("aggregated rows:", r.rows);
  console.log("first row month type:", typeof r.rows[0]?.month, r.rows[0]?.month);
  console.log("has toISOString:", typeof r.rows[0]?.month?.toISOString);

  // Test the merge logic
  const byMonth: Record<string, any> = {};
  for (const row of r.rows) {
    const key = row.month.toISOString ? row.month.toISOString().slice(0, 7) : String(row.month).slice(0, 7);
    const label = new Date(row.month).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    console.log("key:", key, "label:", label);
    byMonth[key] = { month: label, assets: parseFloat(row.total), liabilities: 0 };
  }
  console.log("byMonth keys:", Object.keys(byMonth));

  await pool.end();
}
main().catch(console.error);
