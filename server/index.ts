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
  // Ensure estate planning tables exist on every startup (safe on existing DBs)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estate_beneficiaries (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      has_beneficiary BOOLEAN NOT NULL DEFAULT false,
      beneficiary_name TEXT,
      notes TEXT,
      CONSTRAINT estate_beneficiaries_user_asset_unique UNIQUE (user_id, asset_id)
    );
    CREATE TABLE IF NOT EXISTS estate_documents (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      is_complete BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT estate_documents_user_type_unique UNIQUE (user_id, document_type)
    );
    CREATE TABLE IF NOT EXISTS estate_contacts (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      firm TEXT,
      notes TEXT
    );
  `).catch((e) => console.error("Estate table init error:", e));

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
