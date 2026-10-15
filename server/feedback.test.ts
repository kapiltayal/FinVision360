import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackHandler } from "./feedback";
import { MAX_FEEDBACK_LENGTH } from "@shared/feedback";
import type { Feedback, InsertFeedback } from "@shared/schema";

const author = { id: "feedback-test-user", fullName: "Test User", email: "fixture@example.com" };
const createdAt = new Date("2026-10-15T12:00:00.000Z");

function fixture(options: { databaseFails?: boolean; emailFails?: boolean } = {}) {
  const steps: string[] = [];
  const saved: Feedback[] = [];
  const notifications: any[] = [];
  const logs: unknown[] = [];
  const handler = createFeedbackHandler({
    createFeedback: async (data: InsertFeedback) => {
      steps.push("save");
      if (options.databaseFails) throw new Error("Database unavailable");
      const created = { ...data, id: 1, createdAt };
      saved.push(created);
      return created;
    },
    sendNotification: async (entry, user) => {
      steps.push("notify");
      assert.equal(saved[0], entry, "notification receives the saved database record");
      notifications.push({ entry, user });
      if (options.emailFails) throw new Error("Private provider response must not reach client");
    },
    logEmailError: error => { logs.push(error); },
  });
  const invoke = async (body: unknown, user: unknown = author) => {
    const response = {
      statusCode: 200,
      body: undefined as any,
      status(code: number) { this.statusCode = code; return this; },
      json(value: unknown) { this.body = value; return this; },
    };
    await handler({ body, user } as any, response as any, () => {});
    return response;
  };
  return { steps, saved, notifications, logs, invoke };
}

test("save succeeds before notification; owner and author come from authentication", async () => {
  const f = fixture();
  const response = await f.invoke({ message: "  A useful suggestion  ", userId: "another-user", email: "attacker@example.com" });
  assert.deepEqual(f.steps, ["save", "notify"]);
  assert.equal(f.saved[0].userId, author.id);
  assert.equal(f.notifications[0].user, author);
  assert.equal(f.saved[0].message, "A useful suggestion");
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.notificationEmailStatus, "sent");
});

test("failed database save sends no email", async () => {
  const f = fixture({ databaseFails: true });
  await assert.rejects(f.invoke({ message: "Test" }), /Database unavailable/);
  assert.deepEqual(f.steps, ["save"]);
  assert.equal(f.notifications.length, 0);
});

test("email failure preserves saved feedback and returns a successful save with explicit status", async () => {
  const f = fixture({ emailFails: true });
  const response = await f.invoke({ message: "Keep this feedback" });
  assert.equal(f.saved.length, 1);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.notificationEmailStatus, "failed");
  assert.equal(response.body.message, "Keep this feedback");
  assert.equal(f.logs.length, 1);
  assert.ok(!JSON.stringify(response.body).includes("Private provider"));
});

test("missing identity never saves or notifies", async () => {
  const anonymous = fixture();
  for (const user of [null, {}]) {
    assert.equal((await anonymous.invoke({ message: "Test" }, user)).statusCode, 401);
  }
  assert.deepEqual(anonymous.steps, []);
});

test("empty, malformed and oversized feedback never saves or notifies", async () => {
  const f = fixture();
  for (const body of [undefined, {}, { message: "  " }, { message: 123 }, { message: {} }, { message: "a".repeat(MAX_FEEDBACK_LENGTH + 1) }]) {
    assert.equal((await f.invoke(body)).statusCode, 400);
  }
  assert.deepEqual(f.steps, []);
});

test("feedback exactly at the size limit is accepted", async () => {
  const f = fixture();
  assert.equal((await f.invoke({ message: "a".repeat(MAX_FEEDBACK_LENGTH) })).statusCode, 201);
});
