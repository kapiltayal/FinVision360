import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  createApiRequestLogger,
  formatApiRequestLog,
  formatSafeApiError,
  getSafeApiRoutePath,
} from "./api-logging";

test("API access logs use route templates and request metadata only", () => {
  const routePath = getSafeApiRoutePath("/api/transactions/:id");
  const line = formatApiRequestLog("get", routePath, 200, 12.9);

  assert.equal(line, "GET /api/transactions/:id 200 in 12ms");
  assert.equal(getSafeApiRoutePath(undefined), "<unmatched API route>");
});

test("the Express logger leaves JSON responses untouched and never writes response data", () => {
  const logged: string[] = [];
  const middleware = createApiRequestLogger((line) => logged.push(line));
  const response: any = Object.assign(new EventEmitter(), {
    statusCode: 200,
    json(body: unknown) {
      this.body = body;
      this.emit("finish");
      return this;
    },
  });
  const originalJson = response.json;
  const request: any = {
    method: "GET",
    path: "/api/transactions/sensitive-account-id",
    route: { path: "/api/transactions/:id" },
  };

  middleware(request, response, () => {});
  assert.equal(response.json, originalJson);
  response.json({ amount: 12345.67, accountName: "Private checking" });

  assert.equal(logged.length, 1);
  assert.match(logged[0], /^GET \/api\/transactions\/:id 200 in \d+ms$/);
  assert.equal(logged[0].includes("12345.67"), false);
  assert.equal(logged[0].includes("Private checking"), false);
  assert.equal(logged[0].includes("sensitive-account-id"), false);

  const unmatchedResponse: any = Object.assign(new EventEmitter(), { statusCode: 404 });
  middleware({
    method: "DELETE",
    path: "/api/plaid/items/sensitive-item-id",
    route: undefined,
  } as any, unmatchedResponse, () => {});
  unmatchedResponse.emit("finish");
  assert.match(logged[1], /^DELETE <unmatched API route> 404 in \d+ms$/);
  assert.equal(logged[1].includes("sensitive-item-id"), false);
});

test("API error logs keep a safe failure context and omit error messages, values, and query data", () => {
  const error = Object.assign(
    new Error("transaction account=Checking-123 amount=9876.54 private-description"),
    {
      code: "23505",
      detail: "Sensitive transaction row",
      query: "SELECT * FROM transactions WHERE amount = 9876.54",
      parameters: ["Checking-123", "private-description"],
    },
  );
  const line = formatSafeApiError("PATCH /api/transactions/:id status=500", error);

  assert.equal(line, "PATCH /api/transactions/:id status=500: type=Error code=23505");
  for (const privateValue of ["Checking-123", "9876.54", "private-description", "Sensitive transaction row", "SELECT"]) {
    assert.equal(line.includes(privateValue), false);
  }
});

