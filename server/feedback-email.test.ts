import assert from "node:assert/strict";
import test from "node:test";
import { FeedbackEmailError, sendFeedbackNotification } from "./feedback-email";
import { formatSafeApiError } from "./api-logging";

const feedback = {
  id: 42, userId: "fixture-user", createdAt: new Date("2026-10-15T12:00:00.000Z"),
  message: "<script>private feedback sentinel</script>\nAnother line",
};
const author = { id: feedback.userId, email: "fixture@example.com", fullName: "Test User" };
const TEST_API_KEY = "test-only-placeholder-not-a-real-key";

test("sends saved feedback to the fixed recipient, with a fixed sender and account reply-to", async () => {
  let request: any;
  await sendFeedbackNotification(feedback, author, {
    apiKey: TEST_API_KEY,
    request: async (url, options) => {
      request = { url, ...options, body: JSON.parse(options.body as string) };
      return Response.json({ id: "email-fixture" });
    },
  });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.headers.Authorization, `Bearer ${TEST_API_KEY}`);
  assert.equal(request.method, "POST");
  assert.equal(request.headers["Idempotency-Key"], "feedback-notification/42");
  assert.equal(request.body.from, "FinVision360 Feedback <notifications@finvision360.com>");
  assert.deepEqual(request.body.to, ["contactus@finvision360.com"]);
  assert.equal(request.body.reply_to, author.email);
  assert.equal(request.body.subject, "New FinVision360 feedback #42");
  assert.ok(request.body.text.includes(feedback.message));
  assert.ok(request.body.text.includes("2026-10-15T12:00:00.000Z"));
  assert.equal(request.body.html, undefined, "untrusted feedback is never HTML");
});

test("missing or invalid account email is not used as a reply-to header", async () => {
  for (const email of [null, "", "invalid", "name@example.com\r\nBcc:other@example.com"]) {
    await sendFeedbackNotification(feedback, { ...author, email }, {
      apiKey: TEST_API_KEY,
      request: async (_url, options) => {
        assert.equal(JSON.parse(options.body as string).reply_to, undefined);
        return Response.json({ id: "email-fixture" });
      },
    });
  }
});

test("rejected sends expose only status code, not provider response or feedback", async () => {
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(sendFeedbackNotification(feedback, author, {
      apiKey: TEST_API_KEY,
      request: async () => Response.json({ message: "private provider sentinel" }, { status }),
    }), error => {
      assert.ok(error instanceof FeedbackEmailError);
      assert.equal(error.code, `RESEND_HTTP_${status}`);
      const log = formatSafeApiError("Feedback email notification", error);
      assert.ok(!log.includes("private"));
      assert.ok(!log.includes(author.email));
      assert.ok(!log.includes(TEST_API_KEY));
      return true;
    });
  }
});

test("HTTP success without an email id is not reported as sent", async () => {
  for (const response of [Response.json({}), new Response("invalid JSON")]) {
    await assert.rejects(sendFeedbackNotification(feedback, author, {
      apiKey: TEST_API_KEY,
      request: async () => response,
    }), { code: "RESEND_INVALID_RESPONSE" });
  }
});

test("transport failures propagate for the handler to preserve the saved feedback", async () => {
  await assert.rejects(sendFeedbackNotification(feedback, author, {
    apiKey: TEST_API_KEY,
    request: async () => { throw new Error("Network unavailable"); },
  }), /Network unavailable/);
});

test("a stalled provider request or response body has a bounded wait", async () => {
  for (const request of [
    async () => new Promise<Response>(() => {}),
    async () => ({ ok: true, json: () => new Promise(() => {}) }) as Response,
  ]) {
    await assert.rejects(sendFeedbackNotification(feedback, author, {
      timeoutMs: 5, apiKey: TEST_API_KEY, request,
    }), { code: "RESEND_TIMEOUT" });
  }
});

test("missing dedicated key fails closed without a request or shared connector fallback", async () => {
  let requested = false;
  await assert.rejects(sendFeedbackNotification(feedback, author, {
    apiKey: "",
    request: async () => {
      requested = true;
      return Response.json({ id: "must-not-send" });
    },
  }), { code: "RESEND_NOT_CONFIGURED" });
  assert.equal(requested, false);
});
