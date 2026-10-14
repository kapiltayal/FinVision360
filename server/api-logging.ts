import type { RequestHandler } from "express";

export function createApiRequestLogger(writeLog: (line: string) => void): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      if (!/^\/api(?:\/|$)/.test(path)) return;
      const routePath = getSafeApiRoutePath(req.route?.path);
      writeLog(formatApiRequestLog(req.method, routePath, res.statusCode, Date.now() - start));
    });

    next();
  };
}

export function getSafeApiRoutePath(routePath: unknown): string {
  if (typeof routePath !== "string") return "<unmatched API route>";
  const path = routePath.split(/[?#]/, 1)[0];
  return /^\/api(?:\/|$)/.test(path) ? path : "<unmatched API route>";
}

export function formatApiRequestLog(
  method: string,
  routePath: string,
  statusCode: number,
  durationMs: number,
): string {
  const safeMethod = /^[a-z]{1,12}$/i.test(method) ? method.toUpperCase() : "OTHER";
  const safeStatus = Number.isInteger(statusCode) ? statusCode : 0;
  const safeDuration = Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : 0;
  return `${safeMethod} ${getSafeApiRoutePath(routePath)} ${safeStatus} in ${safeDuration}ms`;
}

export function formatSafeApiError(context: string, error: unknown): string {
  const safeContext = /^[A-Za-z][A-Za-z0-9 ./_:<>{}=-]{0,119}$/.test(context) ? context : "API request failed";
  const record = error && typeof error === "object" ? error as Record<string, unknown> : undefined;
  const errorName = record && typeof record.name === "string" && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(record.name)
    ? record.name
    : "Error";
  const errorCode = record && typeof record.code === "string" && /^[A-Z0-9_-]{1,32}$/.test(record.code)
    ? ` code=${record.code}`
    : "";
  return `${safeContext}: type=${errorName}${errorCode}`;
}
