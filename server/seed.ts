import { sql } from "drizzle-orm";
import { db } from "./db";
import { assetTypeList, liabilitiesTypeList } from "@shared/schema";
import { assetTypeListSeedData, liabilitiesTypeListSeedData } from "./seed-data/asset-liability-types";

export async function seedDatabase() {
  await db.insert(assetTypeList)
    .values(assetTypeListSeedData)
    .onConflictDoUpdate({
      target: [assetTypeList.parentCategory, assetTypeList.subCategory],
      set: {
        type: sql`excluded.type`,
        description: sql`excluded.description`,
        rateOfReturn: sql`excluded.rate_of_return`,
        rateOfReturnInflationAdjusted: sql`excluded.rate_of_return_inflation_adjusted`,
      },
    });

  await db.insert(liabilitiesTypeList)
    .values(liabilitiesTypeListSeedData)
    .onConflictDoUpdate({
      target: [liabilitiesTypeList.parentCategory, liabilitiesTypeList.subCategory],
      set: {
        type: sql`excluded.type`,
        description: sql`excluded.description`,
      },
    });
}
