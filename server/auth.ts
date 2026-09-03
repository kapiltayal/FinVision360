import { createClient } from "@supabase/supabase-js";
import { type Express, type Request, type Response, type NextFunction } from "express";
import { storage } from "./storage";

// Node.js < 22 has no native WebSocket — polyfill for @supabase/realtime-js
import ws from "ws";
if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = ws;
}

const supabaseUrl = process.env.NODE_ENV === "production"
  ? "https://xctcvwqcqntwmupijckb.supabase.co"
  : "https://xejzamzpvrcdmakfkulp.supabase.co";

const supabaseServiceKey = process.env.NODE_ENV === "production"
  ? process.env.SUPABASE_SERVICE_ROLE_KEY_PROD!
  : process.env.SUPABASE_SERVICE_ROLE_KEY_DEV!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export function setupAuth(app: Express) {
  app.get("/api/config", (_req, res) => {
    const url = process.env.NODE_ENV === "production"
      ? "https://xctcvwqcqntwmupijckb.supabase.co"
      : "https://xejzamzpvrcdmakfkulp.supabase.co";
    const anonKey = process.env.NODE_ENV === "production"
      ? "sb_publishable_55-QGIk1VcZuuueqN6TR-w_CuU1EKxv"
      : "sb_publishable_UAUWx1cp75DIwFx7zPz2UQ_UE-cHKGa";
    res.json({ supabaseUrl: url, supabaseAnonKey: anonKey });
  });

  // Called right after Supabase signUp — verifies the new user's ID via the
  // admin API (no JWT available yet for email-confirm flows) and creates the
  // local users row so it exists before the first login.
  app.post("/api/auth/provision", async (req: any, res) => {
    const { supabaseId } = req.body as { supabaseId?: string };
    if (!supabaseId) return res.status(400).json({ message: "supabaseId required" });
    try {
      // Verify this ID actually exists in Supabase (prevents fake provisions)
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(supabaseId);
      if (error || !data.user) return res.status(404).json({ message: "Supabase user not found" });
      const supabaseUser = data.user;
      let localUser = await storage.getUserBySupabaseId(supabaseUser.id);
      if (!localUser) {
        const email = supabaseUser.email || "";
        const fullName = supabaseUser.user_metadata?.full_name as string | undefined;
        localUser = await storage.createUserFromSupabase(supabaseUser.id, email, fullName);
        await storage.upsertRecommendationSettings({
          userId: localUser.id,
          checkingThreshold: "200",
          savingsThreshold: "200",
          cdsThreshold: "200",
          studentLoanThreshold: "200",
          creditCardThreshold: "200",
          autoLoanThreshold: "200",
          personalLoanThreshold: "200",
          mortgageThreshold: "200",
          autoInsuranceThreshold: "100",
          homeInsuranceThreshold: "100",
          lifeInsuranceThreshold: "100",
          otherInsuranceThreshold: "100",
        });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("Provision error:", err);
      res.status(500).json({ message: "Failed to provision user" });
    }
  });

  app.patch("/api/auth/user", requireAuth, async (req: any, res) => {
    const userId = req.user.id;
    const { fullName, email, dateOfBirth, streetAddress, city, state, postalCode, country } = req.body;
    const updated = await storage.updateUser(userId, {
      fullName,
      email,
      dateOfBirth,
      streetAddress,
      city,
      state,
      postalCode,
      country,
    });
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(updated);
  });

  app.get("/api/auth/user", requireAuth, (req: any, res) => {
    res.json(req.user);
  });
}

export async function authenticateSupabase(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const token = authHeader.slice(7);
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    const supabaseUser = data.user;
    let localUser = await storage.getUserBySupabaseId(supabaseUser.id);
    if (!localUser) {
      const email = supabaseUser.email || "";
      const fullName = supabaseUser.user_metadata?.full_name as string | undefined;
      localUser = await storage.createUserFromSupabase(supabaseUser.id, email, fullName);
      await storage.upsertRecommendationSettings({
        userId: localUser.id,
        checkingThreshold: "200",
        savingsThreshold: "200",
        cdsThreshold: "200",
        studentLoanThreshold: "200",
        creditCardThreshold: "200",
        autoLoanThreshold: "200",
        personalLoanThreshold: "200",
        mortgageThreshold: "200",
        autoInsuranceThreshold: "100",
        homeInsuranceThreshold: "100",
        lifeInsuranceThreshold: "100",
        otherInsuranceThreshold: "100",
      });
    }
    req.user = localUser;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ message: "Authentication error" });
  }
}

export function requireAuth(req: any, res: Response, next: NextFunction) {
  if (req.user) return next();
  return authenticateSupabase(req, res, next);
}

export function requireAdmin(req: any, res: Response, next: NextFunction) {
  authenticateSupabase(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Forbidden: admin access required" });
    }
    next();
  });
}
