import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";
import { assetTypeList, liabilitiesTypeList } from "@shared/schema";
import { seedDatabase } from "../server/seed";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Asset_type_list" (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      parent_category TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      rate_of_return NUMERIC(10, 8) NOT NULL,
      rate_of_return_inflation_adjusted NUMERIC(10, 8) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS liabilities_type_list (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      parent_category TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS asset_type_list_hierarchy_unique
      ON "Asset_type_list" (parent_category, category);

    CREATE UNIQUE INDEX IF NOT EXISTS liabilities_type_list_hierarchy_unique
      ON liabilities_type_list (parent_category, category);
  `);

  await seedDatabase();

  const [{ assetCount }] = await db
    .select({ assetCount: sql<number>`count(*)::int` })
    .from(assetTypeList);
  const [{ liabilityCount }] = await db
    .select({ liabilityCount: sql<number>`count(*)::int` })
    .from(liabilitiesTypeList);

  console.log(`Seeded ${assetCount} asset types and ${liabilityCount} liability types.`);
}

main()
  .catch((error) => {
    console.error("Asset/liability type seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });