import type { Pool } from "pg";
import { AllocationError, withFundingLock } from "./goal-allocation";

/** Local deletion is atomic and shares the allocation lock. Revoke the returned token only after commit. */
export async function deletePlaidConnection(pool: Pool, userId: string, itemId: number, confirmAllocations: boolean) {
  return withFundingLock(pool, userId, async (client) => {
    const { rows: [item] } = await client.query("SELECT access_token FROM plaid_items WHERE id=$1 AND user_id=$2 FOR UPDATE", [itemId, userId]);
    if (!item) throw new AllocationError("Item not found", 404);
    const { rows: accounts } = await client.query("SELECT linked_asset_id,linked_liability_id FROM plaid_accounts WHERE plaid_item_id=$1 AND user_id=$2", [itemId, userId]);
    const assetIds = accounts.map((a) => a.linked_asset_id).filter(Boolean);
    const liabilityIds = accounts.map((a) => a.linked_liability_id).filter(Boolean);
    const { rowCount } = await client.query("SELECT id FROM goal_allocations WHERE user_id=$1 AND asset_id=ANY($2::int[])", [userId, assetIds]);
    if (rowCount && !confirmAllocations) throw new AllocationError("Disconnecting this bank deletes linked accounts and releases their goal allocations, reducing goal funding. Please confirm.", 409);
    await client.query("UPDATE plaid_accounts SET linked_asset_id=NULL WHERE user_id=$1 AND linked_asset_id=ANY($2::int[])", [userId, assetIds]);
    await client.query("UPDATE plaid_accounts SET linked_liability_id=NULL WHERE user_id=$1 AND linked_liability_id=ANY($2::int[])", [userId, liabilityIds]);
    await client.query("DELETE FROM assets WHERE user_id=$1 AND id=ANY($2::int[])", [userId, assetIds]);
    await client.query("DELETE FROM liabilities WHERE user_id=$1 AND id=ANY($2::int[])", [userId, liabilityIds]);
    await client.query("DELETE FROM plaid_accounts WHERE user_id=$1 AND plaid_item_id=$2", [userId, itemId]);
    await client.query("DELETE FROM plaid_items WHERE user_id=$1 AND id=$2", [userId, itemId]);
    return item.access_token as string;
  });
}
