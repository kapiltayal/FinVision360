import { pool } from "../server/db";
async function main() {
  const userId = "c00a5b8e-bf78-4fc4-be15-2f74a53c9291";
  
  // Check raw counts
  const c1 = await pool.query("SELECT COUNT(*) FROM asset_history WHERE user_id = $1", [userId]);
  const c2 = await pool.query("SELECT COUNT(*) FROM liability_history WHERE user_id = $1", [userId]);
  console.log("asset_history rows:", c1.rows[0].count);
  console.log("liability_history rows:", c2.rows[0].count);
  
  // Raw liability sample
  const raw = await pool.query("SELECT snapshot_at, balance FROM liability_history WHERE user_id = $1 ORDER BY snapshot_at LIMIT 3", [userId]);
  console.log("liability sample:", JSON.stringify(raw.rows));
  
  // Aggregated liabilities
  const { rows: liabilityRows } = await pool.query(
    `SELECT DATE_TRUNC('month', snapshot_at) AS month, SUM(balance::numeric) AS total FROM liability_history WHERE user_id = $1 GROUP BY 1 ORDER BY 1 LIMIT 5`,
    [userId]
  );
  console.log("liability agg:", JSON.stringify(liabilityRows));
  
  // Aggregated assets
  const { rows: assetRows } = await pool.query(
    `SELECT DATE_TRUNC('month', snapshot_at) AS month, SUM(value::numeric) AS total FROM asset_history WHERE user_id = $1 GROUP BY 1 ORDER BY 1 LIMIT 5`,
    [userId]
  );
  console.log("asset agg:", JSON.stringify(assetRows));
  
  await pool.end();
}
main().catch(console.error);
