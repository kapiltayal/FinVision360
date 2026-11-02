import type { Pool } from "pg";
import type { Express } from "express";
import { requireAuth } from "./auth";

export function normalizeBeneficiaryName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Part of the existing pre-listen database bootstrap, in both environments.
export async function ensureBeneficiaryPeopleSchema(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(57116)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS estate_beneficiary_people (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS estate_beneficiary_people_user_name_unique
        ON estate_beneficiary_people(user_id, normalized_name);
      CREATE TABLE IF NOT EXISTS estate_beneficiary_entries (
        id SERIAL PRIMARY KEY,
        designation_id INTEGER NOT NULL REFERENCES estate_beneficiaries(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        beneficiary_name TEXT NOT NULL,
        allocation_percentage NUMERIC(5,2) NOT NULL CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS estate_beneficiary_entries_designation_idx ON estate_beneficiary_entries(designation_id);
      ALTER TABLE estate_beneficiary_entries ADD COLUMN IF NOT EXISTS beneficiary_id
        INTEGER REFERENCES estate_beneficiary_people(id);
      INSERT INTO estate_beneficiary_people (user_id, name, normalized_name)
      SELECT user_id, MIN(BTRIM(regexp_replace(name, '\\s+', ' ', 'g'))),
        LOWER(BTRIM(regexp_replace(name, '\\s+', ' ', 'g')))
      FROM (
        SELECT user_id, beneficiary_name AS name FROM estate_beneficiary_entries
        UNION ALL
        SELECT user_id, beneficiary_name AS name FROM estate_beneficiaries
      ) names
      WHERE NULLIF(BTRIM(name), '') IS NOT NULL
      GROUP BY user_id, LOWER(BTRIM(regexp_replace(name, '\\s+', ' ', 'g')))
      ON CONFLICT (user_id, normalized_name) DO NOTHING;
      UPDATE estate_beneficiary_entries e SET beneficiary_id = p.id
      FROM estate_beneficiary_people p
      WHERE e.beneficiary_id IS NULL AND e.user_id = p.user_id
        AND LOWER(BTRIM(regexp_replace(e.beneficiary_name, '\\s+', ' ', 'g'))) = p.normalized_name;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function registerBeneficiaryPeopleRoutes(app: Express, pool: Pool) {
  app.get("/api/estate/beneficiary-people", requireAuth, async (req, res) => {
    const result = await pool.query(
      `SELECT id, user_id AS "userId", name, normalized_name AS "normalizedName"
       FROM estate_beneficiary_people WHERE user_id = $1 ORDER BY LOWER(name), id`,
      [(req.user as any).id],
    );
    res.json(result.rows);
  });
  app.post("/api/estate/beneficiary-people", requireAuth, async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 200) return res.status(400).json({ message: "Enter a beneficiary name (up to 200 characters)" });
    const result = await pool.query(
      `INSERT INTO estate_beneficiary_people (user_id, name, normalized_name) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, normalized_name) DO UPDATE SET normalized_name = EXCLUDED.normalized_name
       RETURNING id, user_id AS "userId", name, normalized_name AS "normalizedName"`,
      [(req.user as any).id, name, normalizeBeneficiaryName(name)],
    );
    res.status(201).json(result.rows[0]);
  });
}
