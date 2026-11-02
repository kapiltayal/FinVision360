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
  };
  registerBeneficiaryPeopleRoutes(app, pool);
  async function call(method: string, userId: string, body: unknown = {}) {
    const callbacks = handlers.get(`${method} /api/estate/beneficiary-people`)!;
    assert.equal(callbacks[0], requireAuth, "list and creation require authentication");
    const response: any = {
      code: 200, body: null,
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    // Exercise handler ownership rules; this does not test JWT authentication.
    await callbacks[callbacks.length - 1]({ user: { id: userId }, body }, response);
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
