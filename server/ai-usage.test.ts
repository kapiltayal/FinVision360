import assert from "node:assert/strict";
import test from "node:test";
import { estimateAIUsageCostUsd, recordAIUsage } from "./ai-usage";
import { normalizedAIModelUsage } from "./ai/provider";

test("normalizes prompt, cached prompt, and completion token usage", () => {
  assert.deepEqual(normalizedAIModelUsage("gpt-5.6-luna", {
    prompt_tokens: 1_000,
    completion_tokens: 200,
    prompt_tokens_details: { cached_tokens: 400 },
  }), {
    model: "gpt-5.6-luna",
    inputTokens: 1_000,
    cachedInputTokens: 400,
    outputTokens: 200,
  });
});

test("estimates cost with separate cached-input and output rates", () => {
  assert.equal(estimateAIUsageCostUsd({
    model: "gpt-5.6-luna",
    inputTokens: 1_000,
    cachedInputTokens: 400,
    outputTokens: 200,
  }), 0.000368);
});

test("unknown model pricing is explicitly unpriced", () => {
  assert.equal(estimateAIUsageCostUsd({
    model: "future-model",
    inputTokens: 100,
    cachedInputTokens: 0,
    outputTokens: 20,
  }), null);
});

test("monthly upsert increments file-upload counters without touching AI Q&A", async () => {
  let captured: { sql: string; values?: unknown[] } | undefined;
  await recordAIUsage("user-1", "file_upload", {
    model: "gpt-5.6-luna",
    inputTokens: 1_000,
    cachedInputTokens: 400,
    outputTokens: 200,
  }, {
    async query(sql, values) {
      captured = { sql, values };
      return {};
    },
  });

  assert.ok(captured);
  assert.match(captured.sql, /ON CONFLICT \(user_id, usage_month\) DO UPDATE/);
  assert.match(captured.sql, /date_trunc\('month', NOW\(\) AT TIME ZONE 'UTC'\)::date/);
  assert.deepEqual(captured.values, [
    "user-1",
    1_000, 400, 200, 1_200, 0.000368, 0,
    0, 0, 0, 0, 0, 0,
  ]);
});
