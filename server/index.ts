import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure estate planning tables exist on every startup (safe on existing DBs).
  // No FK constraints here so this works on a fresh DB before db:push has run.
  // Finance Tracker tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id              SERIAL PRIMARY KEY,
      user_id         VARCHAR NOT NULL,
      date            DATE NOT NULL,
      description     TEXT NOT NULL,
      merchant        TEXT,
      amount          NUMERIC(12,2) NOT NULL,
      type            TEXT NOT NULL CHECK(type IN ('income','expense')),
      subcategory     TEXT NOT NULL DEFAULT 'unassigned',
      needs_want      TEXT CHECK(needs_want IN ('need','want','na')),
      is_recurring    BOOLEAN DEFAULT FALSE,
      recurring_type  TEXT CHECK(recurring_type IN ('subscription','recurring_bill')),
      source          TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','plaid','upload','import')),
      plaid_transaction_id TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type    ON transactions(type);
  `).catch((e) => console.error("Transactions table init error:", e));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS estate_beneficiaries (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      asset_id INTEGER NOT NULL,
      has_beneficiary BOOLEAN NOT NULL DEFAULT false,
      beneficiary_name TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS estate_documents (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      document_type TEXT NOT NULL,
      is_complete BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS estate_contacts (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      firm TEXT,
      notes TEXT
    );
  `).catch((e) => console.error("Estate table init error:", e));

  // Add unique constraints if missing (needed for ON CONFLICT upserts).
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'estate_beneficiaries_user_asset_unique'
      ) THEN
        ALTER TABLE estate_beneficiaries ADD CONSTRAINT estate_beneficiaries_user_asset_unique UNIQUE (user_id, asset_id);
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'estate_documents_user_type_unique'
      ) THEN
        ALTER TABLE estate_documents ADD CONSTRAINT estate_documents_user_type_unique UNIQUE (user_id, document_type);
      END IF;
    END $$;
  `).catch((e) => console.error("Estate constraint init error:", e));

  if (process.env.NODE_ENV !== "production") {
    const { seedDatabase } = await import("./seed");
    await seedDatabase().catch((e) => console.error("Seed error:", e));
  }
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
