import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ensureBeneficiaryPeopleSchema, registerBeneficiaryPeopleRoutes } from "./estate-beneficiary-people";
import { requireAuth } from "./auth";

test("beneficiary list persists, reuses names, migrates safely and rejects foreign selections atomically", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const { pool } = await import("./db");
  const { storage } = await import("./storage");
  const owner = randomUUID(), other = randomUUID();
  const handlers = new Map<string, Function[]>();
  const app: any = {
    get(path: string, ...callbacks: Function[]) { handlers.set(`GET ${path}`, callbacks); },
    post(path: string, ...callbacks: Function[]) { handlers.set(`POST ${path}`, callbacks); },
    patch(path: string, ...callbacks: Function[]) { handlers.set(`PATCH ${path}`, callbacks); },
  };
  registerBeneficiaryPeopleRoutes(app, pool);
  async function call(method: string, userId: string, body: unknown = {}, id?: number | string) {
    const callbacks = handlers.get(`${method} /api/estate/beneficiary-people${method === "PATCH" ? "/:id" : ""}`)!;
    assert.equal(callbacks[0], requireAuth, "list and creation require authentication");
    const response: any = {
      code: 200, body: null,
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    // Exercise handler ownership rules; this does not test JWT authentication.
    await callbacks[callbacks.length - 1]({ user: { id: userId }, body, params: { id: String(id) } }, response);
    return response;
  }
  try {
    await ensureBeneficiaryPeopleSchema(pool);
    await pool.query("INSERT INTO users(id) VALUES($1),($2)", [owner, other]);
    const { rows: [asset] } = await pool.query(
      "INSERT INTO assets(user_id,name,category,value) VALUES($1,'Beneficiary test','Checking Account',1000) RETURNING id", [owner]);
    const { rows: [legacy] } = await pool.query(
      `INSERT INTO estate_beneficiaries(user_id,asset_id,has_beneficiary,beneficiary_name,last_updated_at)
       VALUES($1,$2,true,'Legacy Person','2026-01-01') RETURNING id`, [owner, asset.id]);
    await ensureBeneficiaryPeopleSchema(pool);
    await ensureBeneficiaryPeopleSchema(pool);
    const migrated = (await call("GET", owner)).body;
    assert.equal(migrated.length, 1, "repeated migration does not duplicate names");
    assert.equal(migrated[0].name, "Legacy Person");
    const { rows: [unchanged] } = await pool.query("SELECT last_updated_at FROM estate_beneficiaries WHERE id=$1", [legacy.id]);
    assert.equal(new Date(unchanged.last_updated_at).toISOString().slice(0, 10), "2026-01-01");
    assert.equal((await call("POST", owner, { name: "   " })).code, 400);
    assert.equal((await call("POST", owner, { name: "x".repeat(201) })).code, 400);
    const created = (await call("POST", owner, { name: "  Test   Person  " })).body;
    assert.equal(created.name, "Test Person");
    const duplicate = (await call("POST", owner, { name: "test person" })).body;
    assert.equal(duplicate.id, created.id);
    const concurrent = await Promise.all([call("POST", owner, { name: "TEST PERSON" }), call("POST", owner, { name: "Test Person" })]);
    assert.ok(concurrent.every(response => response.body.id === created.id));
    assert.deepEqual((await call("GET", other)).body, []);
    const foreign = (await call("POST", other, { name: "Test Person" })).body;
    assert.notEqual(foreign.id, created.id, "lists are private to each user");
    const save = (people: Array<{ name: string; beneficiaryId: number; percentage: number; notes: null }>) =>
      storage.saveEstateBeneficiary({ userId: owner, assetId: asset.id, hasBeneficiary: true, beneficiaries: people });
    const saved = await save([{ name: "Do not trust client text", beneficiaryId: created.id, percentage: 100, notes: null }]);
    assert.equal(saved.beneficiaries[0].beneficiaryName, "Test Person", "server uses the selected user's canonical name");
    assert.equal(saved.beneficiaries[0].beneficiaryId, created.id);
    assert.equal(Number(saved.beneficiaries[0].allocationPercentage), 100);
    await assert.rejects(save([
      { name: "Test Person", beneficiaryId: created.id, percentage: 50, notes: null },
      { name: "Test Person", beneficiaryId: foreign.id, percentage: 50, notes: null },
    ]), /Beneficiary not found/);
    const preserved = (await storage.getEstateBeneficiaries(owner))[0];
    assert.equal(preserved.beneficiaries.length, 1, "failed selection rolls back all assignment edits");
    assert.equal(Number(preserved.beneficiaries[0].allocationPercentage), 100);
    await pool.query("UPDATE estate_beneficiary_entries SET beneficiary_id=NULL WHERE user_id=$1", [owner]);
    await ensureBeneficiaryPeopleSchema(pool);
    assert.equal((await storage.getEstateBeneficiaries(owner))[0].beneficiaries[0].beneficiaryId, created.id, "existing entry is backfilled without changing its percentage");
    assert.equal((await call("PATCH", owner, { name: "New name" }, "invalid")).code, 400);
    assert.equal((await call("PATCH", owner, { name: "  " }, created.id)).code, 400);
    assert.equal((await call("PATCH", owner, { name: "x".repeat(201) }, created.id)).code, 400);
    assert.equal((await call("PATCH", owner, { name: "New name" }, foreign.id)).code, 404);
    assert.equal((await call("PATCH", owner, { name: "New name" }, 2147483647)).code, 404);
    assert.equal((await call("PATCH", owner, { name: "  LEGACY  PERSON " }, created.id)).code, 409);
    assert.equal((await call("GET", owner)).body.find((person: any) => person.id === created.id).name, "Test Person", "conflicts do not merge identities");

    const { rows: [secondAsset] } = await pool.query(
      "INSERT INTO assets(user_id,name,category,value) VALUES($1,'Second account','Checking Account',2000) RETURNING id", [owner]);
    const { rows: [legacyAsset] } = await pool.query(
      "INSERT INTO assets(user_id,name,category,value) VALUES($1,'Legacy account','Checking Account',3000) RETURNING id", [owner]);
    await storage.saveEstateBeneficiary({
      userId: owner, assetId: secondAsset.id, hasBeneficiary: true,
      beneficiaries: [
        { name: "Test Person", beneficiaryId: created.id, percentage: 60, notes: "Preserve this note" },
        { name: "Legacy Person", beneficiaryId: migrated[0].id, percentage: 40, notes: null },
      ],
    });
    await pool.query(
      `INSERT INTO estate_beneficiaries(user_id,asset_id,has_beneficiary,beneficiary_name,notes,last_updated_at)
       VALUES($1,$2,true,'  TEST   Person ','Legacy notes','2026-01-01')`, [owner, legacyAsset.id]);
    await pool.query("UPDATE estate_beneficiary_entries SET beneficiary_id=NULL WHERE user_id=$1 AND asset_id=$2 AND beneficiary_id=$3", [owner, secondAsset.id, created.id]);
    await pool.query("UPDATE estate_beneficiaries SET last_updated_at='2026-01-01' WHERE user_id=$1", [owner]);
    const renamed = await call("PATCH", owner, { name: "  Updated   Person  " }, created.id);
    assert.equal(renamed.code, 200);
    assert.equal(renamed.body.id, created.id);
    assert.equal(renamed.body.name, "Updated Person");
    const renamedAccounts = await storage.getEstateBeneficiaries(owner);
    const firstAccount = renamedAccounts.find(account => account.assetId === asset.id)!;
    const secondAccount = renamedAccounts.find(account => account.assetId === secondAsset.id)!;
    const legacyAccount = renamedAccounts.find(account => account.assetId === legacyAsset.id)!;
    assert.equal(firstAccount.beneficiaries[0].beneficiaryName, "Updated Person");
    assert.equal(secondAccount.beneficiaries[0].beneficiaryName, "Updated Person");
    assert.equal(secondAccount.beneficiaries[0].beneficiaryId, created.id, "legacy unlinked entries are linked during rename");
    assert.equal(Number(secondAccount.beneficiaries[0].allocationPercentage), 60);
    assert.equal(secondAccount.beneficiaries[0].notes, "Preserve this note");
    assert.equal(secondAccount.beneficiaries[1].beneficiaryName, "Legacy Person", "other beneficiary is unchanged");
    assert.equal(Number(secondAccount.beneficiaries[1].allocationPercentage), 40);
    assert.equal(legacyAccount.beneficiaryName, "Updated Person");
    assert.equal(legacyAccount.notes, "Legacy notes");
    assert.equal(Number(legacyAccount.beneficiaries[0].allocationPercentage), 100);
    assert.ok(new Date(firstAccount.lastUpdatedAt!).getTime() > new Date("2026-01-01").getTime());
    assert.equal((await call("GET", other)).body[0].name, "Test Person", "another user's matching name is untouched");
    const beforeNoop = firstAccount.lastUpdatedAt;
    await call("PATCH", owner, { name: "Updated Person" }, created.id);
    assert.equal(
      new Date((await storage.getEstateBeneficiaries(owner)).find(account => account.assetId === asset.id)!.lastUpdatedAt!).getTime(),
      new Date(beforeNoop!).getTime(),
      "no-op saves do not change account timestamps",
    );
    const results = await Promise.all([
      call("PATCH", owner, { name: "Final Person" }, created.id),
      save([{ name: "Old stale name", beneficiaryId: created.id, percentage: 100, notes: null }]),
    ]);
    assert.equal(results[0].code, 200);
    assert.equal((await storage.getEstateBeneficiaries(owner)).find(account => account.assetId === asset.id)!.beneficiaries[0].beneficiaryName, "Final Person", "concurrent account save cannot restore the old name");
    await ensureBeneficiaryPeopleSchema(pool);
    assert.ok(!(await call("GET", owner)).body.some((person: any) => ["test person", "updated person"].includes(person.normalizedName)), "restarting after rename does not recreate old names");
    const unused = (await call("POST", owner, { name: "Unused person" })).body;
    assert.equal((await call("PATCH", owner, { name: "Unused corrected" }, unused.id)).body.name, "Unused corrected");
    await storage.saveEstateBeneficiary({ userId: owner, assetId: asset.id, hasBeneficiary: false, beneficiaries: [] });
    assert.ok((await call("GET", owner)).body.some((person: any) => person.id === created.id), "clearing an account does not delete reusable beneficiaries");
  } finally {
    await pool.query("DELETE FROM estate_beneficiary_entries WHERE user_id=ANY($1::varchar[])", [[owner, other]]);
    await pool.query("DELETE FROM estate_beneficiaries WHERE user_id=ANY($1::varchar[])", [[owner, other]]);
    await pool.query("DELETE FROM estate_beneficiary_people WHERE user_id=ANY($1::varchar[])", [[owner, other]]);
    await pool.query("DELETE FROM assets WHERE user_id=ANY($1::varchar[])", [[owner, other]]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[owner, other]]);
    await pool.end();
  }
});
