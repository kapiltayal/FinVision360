import assert from "node:assert/strict";
import test from "node:test";
import { isHistoricalBudgetMonth, previousBudgetMonth } from "../shared/budget-period";
import { preserveSavedEntityRows } from "./budget-history";
import { runMonthlyBackup, CloseWindowError } from "./monthly-backup";

test("UTC month boundary treats only completed months as historical", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  assert.equal(previousBudgetMonth(now), "2026-12");
  assert.equal(isHistoricalBudgetMonth("2026-12", now), true);
  assert.equal(isHistoricalBudgetMonth("2027-01", now), false);
  assert.equal(isHistoricalBudgetMonth("2027-02", now), false);
});

test("saved orphan amounts retain identities without fabricating history or zero details", () => {
  const result = preserveSavedEntityRows({
    plans: [
      { planKey: "debt:11", plannedAmount: 250.12, entityMetadata: { name: "Old loan", category: "Loan" } },
      { planKey: "goal:12", plannedAmount: 0, entityMetadata: { name: "Old goal", category: "Savings" } },
      { planKey: "goal:13", plannedAmount: 325.99 },
    ], liabilities: [], goals: [],
  });
  assert.equal(result.liabilities[0].name, "Old loan");
  assert.equal(result.liabilities[0].balance, null);
  assert.equal(result.liabilities[0].minimumPayment, null);
  assert.equal(result.goals[0].monthlySavingsNeeded, null);
  assert.equal(result.goals[1].title, "Archived goal #13");
  assert.equal(result.plans.reduce((sum, row) => sum + row.plannedAmount, 0), 576.11);
  assert.deepEqual(preserveSavedEntityRows(result), result, "no duplicated orphan rows on retries");
});

test("failed capture rolls back and releases the connection instead of committing partial history", async () => {
  const queries: string[] = [];
  let released = false;
  const client = {
    async query(sql: string) {
      queries.push(sql);
      if (sql.includes("INSERT INTO asset_history")) throw new Error("Injected write failure");
      return { rows: [], rowCount: 0 };
    },
    release() { released = true; },
  };
  await assert.rejects(runMonthlyBackup({ connect: async () => client } as any, new Date("2027-01-01T00:05:00Z")), /Injected write failure/);
  assert.ok(queries.includes("ROLLBACK"));
  assert.ok(!queries.includes("COMMIT"));
  assert.ok(queries.includes("SELECT pg_advisory_unlock(57001)"));
  assert.ok(released);
});

test("late live-data capture is rejected but completed-period retry stays idempotent", async () => {
  const now = new Date("2027-01-15T12:00:00Z");
  const client = {
    async query(sql: string) { return { rows: [], rowCount: 0 }; },
    release() {},
  };
  await assert.rejects(runMonthlyBackup({ connect: async () => client } as any, now), CloseWindowError);
  client.query = async (sql: string) => ({
    rows: sql.startsWith("SELECT result") ? [{ result: { periodMonth: "2026-12" } }] : [], rowCount: 0,
  }) as any;
  const retry = await runMonthlyBackup({ connect: async () => client } as any, now);
  assert.equal(retry.alreadyCompleted, true);
  assert.equal(retry.periodMonth, "2026-12");
});
