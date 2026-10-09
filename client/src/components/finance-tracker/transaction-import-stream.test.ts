import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createImportRequestId, readTransactionImportStream } from "./transaction-import-stream";
import { TransactionImportProgress } from "./transaction-import-progress";
import type { TransactionImportEvent } from "@shared/transaction-import";

function chunkedResponse(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      for (let index = 0; index < bytes.length; index += 3) controller.enqueue(bytes.slice(index, index + 3));
      controller.close();
    },
  }));
}

test("preview stream handles split JSON and UTF-8 characters, blank lines and final unterminated line", async () => {
  const messages: TransactionImportEvent[] = [
    { stage: "validation" }, { stage: "processing" },
    { stage: "duplicates" },
    { preview: { entries: [{ description: "Café" } as any], ignoredBlankRows: 1 } },
    { stage: "review" },
  ];
  const observed: TransactionImportEvent[] = [];
  await readTransactionImportStream(chunkedResponse(messages.map(message => JSON.stringify(message)).join("\n\n")),
    message => observed.push(message));
  assert.deepEqual(observed, messages);
});

test("stream failures retain observed review data and never invent subsequent/completion stages", async () => {
  const observed: TransactionImportEvent[] = [];
  const text = '{"stage":"processing"}\n{"preview":{"entries":[],"ignoredBlankRows":0}}\n{"error":"Connection dropped"}\n';
  await assert.rejects(readTransactionImportStream(chunkedResponse(text), event => observed.push(event)), /Connection dropped/);
  assert.equal(observed.length, 2);
  assert.ok("preview" in observed[1]);
  assert.equal(observed.some(event => "stage" in event && event.stage === "complete"), false);
  await assert.rejects(readTransactionImportStream(chunkedResponse("invalid JSON\n"), () => {}), /unreadable update/);
  await assert.rejects(readTransactionImportStream(new Response(null), () => {}), /could not be read/);
});

test("fallback save request IDs are accepted UUID v4, and native UUID generation is used when available", () => {
  const fakeCrypto = { getRandomValues: (bytes: Uint8Array) => bytes.fill(17) } as unknown as Crypto;
  assert.match(createImportRequestId(fakeCrypto), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const native = "11111111-1111-4111-8111-111111111111";
  assert.equal(createImportRequestId({ randomUUID: () => native } as unknown as Crypto), native);
});

test("progress exposes completed/current/upcoming/failed states and waits for save to finish", () => {
  // tsx uses the project's JSX preserve setting outside Vite; supply React for SSR only.
  (globalThis as any).React = React;
  const review = renderToStaticMarkup(React.createElement(TransactionImportProgress, { current: "review" }));
  assert.match(review, /aria-label="Import progress"/);
  assert.equal((review.match(/Completed/g) || []).length, 3);
  assert.match(review, /aria-current="step"/);
  assert.match(review, /Process &amp; categorize/);
  assert.equal(review.includes("animate-spin"), false, "waiting for user review is not background work");
  const finalizing = renderToStaticMarkup(React.createElement(TransactionImportProgress, { current: "finalization" }));
  assert.match(finalizing, /animate-spin/);
  assert.equal((finalizing.match(/Completed/g) || []).length, 4);
  const failed = renderToStaticMarkup(React.createElement(TransactionImportProgress, { current: "failed", failedAt: "duplicates" }));
  assert.match(failed, /Failed/);
  assert.equal((failed.match(/Completed/g) || []).length, 2);
  const complete = renderToStaticMarkup(React.createElement(TransactionImportProgress, { current: "complete" }));
  assert.equal((complete.match(/Completed/g) || []).length, 6);
  assert.equal(complete.includes("animate-spin"), false);
});
