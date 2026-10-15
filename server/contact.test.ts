import assert from "node:assert/strict";
import test from "node:test";
import { createContactHandler } from "./contact";
import { sendContactNotification } from "./feedback-email";
import type { Contactus } from "@shared/schema";

const input = {
  name: "Test Visitor",
  email: "visitor@example.com",
  subject: "A question about FinVision360",
  message: "Please tell me more about the service.",
};
const createdAt = new Date("2026-10-15T12:00:00Z");

function fixture(options: { databaseFails?: boolean; emailFails?: boolean } = {}) {
  const steps: string[] = [];
  const saved: Contactus[] = [];
  const notified: Contactus[] = [];
  const logged: unknown[] = [];
  const handler = createContactHandler({
    createSubmission: async data => {
      steps.push("save");
      if (options.databaseFails) throw new Error("Database unavailable");
      const row = { ...data, id: 42, createdAt };
      saved.push(row);
      return row;
    },
    sendNotification: async row => {
      steps.push("notify");
      assert.equal(row, saved[0]);
      notified.push(row);
      if (options.emailFails) throw new Error("private provider sentinel");
    },
    logEmailError: error => { logged.push(error); },
  });
  const submit = async (body: unknown) => {
    let status = 200;
    let result: any;
    const response = {
      status(value: number) { status = value; return this; },
      json(value: unknown) { result = value; return this; },
    };
    await handler({ body } as any, response as any, () => {});
    return { status, result };
  };
  return { steps, saved, notified, logged, submit };
}

test("public contact saves trimmed fields before notifying, using the database identity", async () => {
  const f = fixture();
  const result = await f.submit({ ...input, name: " Test Visitor ", message: ` ${input.message} `, id: 999, to: "attacker@example.com" });
  assert.equal(result.status, 200);
  assert.equal(result.result.notificationEmailStatus, "sent");
  assert.deepEqual(f.steps, ["save", "notify"]);
  assert.deepEqual(f.saved[0], { ...input, id: 42, createdAt });
});

test("database failure never sends a contact notification", async () => {
  const f = fixture({ databaseFails: true });
  await assert.rejects(f.submit(input), /Database unavailable/);
  assert.deepEqual(f.steps, ["save"]);
  assert.equal(f.notified.length, 0);
});

test("email failure keeps the saved contact and explicitly discourages resubmission", async () => {
  const f = fixture({ emailFails: true });
  const { status, result } = await f.submit(input);
  assert.equal(status, 200);
  assert.equal(f.saved.length, 1);
  assert.equal(f.logged.length, 1);
  assert.equal(result.notificationEmailStatus, "failed");
  assert.match(result.message, /don't need to submit it again/);
  assert.ok(!JSON.stringify(result).includes("private provider sentinel"));
});

test("invalid, non-text, empty and oversized contact fields cannot save or send", async () => {
  const invalid: unknown[] = [undefined, null, [], {}, { ...input, email: "invalid" },
    { ...input, email: "a@example.com\r\nBcc:other@example.com" }];
  for (const field of ["name", "email", "subject", "message"]) {
    for (const value of ["", "   ", 42, {}, null]) invalid.push({ ...input, [field]: value });
  }
  for (const [field, max] of [["name", 200], ["email", 254], ["subject", 500], ["message", 10_000]] as const) {
    invalid.push({ ...input, [field]: "a".repeat(max + 1) });
  }
  for (const body of invalid) {
    const f = fixture();
    const result = await f.submit(body);
    assert.equal(result.status, 400);
    assert.deepEqual(f.steps, []);
  }
});

test("contact fields accept the documented name, subject and message limits", async () => {
  const f = fixture();
  const result = await f.submit({ ...input, name: "a".repeat(200), subject: "b".repeat(500), message: "c".repeat(10_000) });
  assert.equal(result.result.notificationEmailStatus, "sent");
});

test("contact email includes all saved fields, fixed destination and visitor reply-to", async () => {
  const row = { ...input, id: 42, createdAt };
  await sendContactNotification(row, {
    apiKey: "test-only-placeholder-not-a-real-key",
    request: async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      const body = JSON.parse(options.body as string);
      assert.deepEqual(body.to, ["contactus@finvision360.com"]);
      assert.equal(body.from, "FinVision360 Contact <notifications@finvision360.com>");
      assert.equal(body.subject, "New FinVision360 contact message #42");
      assert.equal(body.reply_to, input.email);
      for (const value of Object.values(input)) assert.ok(body.text.includes(value));
      assert.ok(body.text.includes(createdAt.toISOString()));
      assert.equal(body.html, undefined);
      assert.equal((options.headers as Record<string, string>)["Idempotency-Key"], "contact-notification/42");
      return Response.json({ id: "test-email" });
    },
  });
});

test("contact sender uses the shared timeout, missing-key and provider-error safeguards", async () => {
  const row = { ...input, id: 42, createdAt };
  await assert.rejects(sendContactNotification(row, { apiKey: "" }), { code: "RESEND_NOT_CONFIGURED" });
  await assert.rejects(sendContactNotification(row, {
    apiKey: "test-only-placeholder-not-a-real-key",
    request: async () => Response.json({ message: "private" }, { status: 403 }),
  }), { code: "RESEND_HTTP_403" });
});
