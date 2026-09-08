import { sql } from "drizzle-orm";
import { db } from "./db";
import { assetTypeList, liabilitiesTypeList, transactionTypeList } from "@shared/schema";
import { assetTypeListSeedData, liabilitiesTypeListSeedData } from "./seed-data/asset-liability-types";
import { transactionTypeListSeedData } from "./seed-data/transaction-types";

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

  await db.insert(transactionTypeList)
    .values(transactionTypeListSeedData)
    .onConflictDoUpdate({
      target: [
        transactionTypeList.type,
        transactionTypeList.parentCategory,
        transactionTypeList.category,
      ],
      set: {
        needVsWant: sql`excluded.need_vs_want`,
        description: sql`excluded.description`,
      },
    });
}
