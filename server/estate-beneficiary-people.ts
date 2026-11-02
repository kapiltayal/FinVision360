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

  app.patch("/api/estate/beneficiary-people/:id", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const id = Number(req.params.id);
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return res.status(400).json({ message: "Select a valid beneficiary" });
    if (!name || name.length > 200) return res.status(400).json({ message: "Enter a beneficiary name (up to 200 characters)" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Use the same lock as account saves so a concurrent save cannot restore an old name.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 116))", [userId]);
      const existing = await client.query(
        "SELECT id, name, normalized_name FROM estate_beneficiary_people WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, userId],
      );
      if (!existing.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Beneficiary not found" });
      }
      const old = existing.rows[0];
      const updated = await client.query(
        `UPDATE estate_beneficiary_people SET name = $3, normalized_name = $4
         WHERE id = $1 AND user_id = $2
         RETURNING id, user_id AS "userId", name, normalized_name AS "normalizedName"`,
        [id, userId, name, normalizeBeneficiaryName(name)],
      );
      if (old.name !== name) {
        const entries = await client.query(
          `UPDATE estate_beneficiary_entries SET beneficiary_name = $3, beneficiary_id = $2
           WHERE user_id = $1 AND (beneficiary_id = $2 OR
             (beneficiary_id IS NULL AND LOWER(BTRIM(regexp_replace(beneficiary_name, '\\s+', ' ', 'g'))) = $4))
           RETURNING designation_id`,
          [userId, id, name, old.normalized_name],
        );
        await client.query(
          `UPDATE estate_beneficiaries
           SET last_updated_at = NOW()
           WHERE user_id = $1 AND id = ANY($2::integer[])`,
          [userId, entries.rows.map(row => row.designation_id)],
        );
      }
      await client.query("COMMIT");
      res.json(updated.rows[0]);
    } catch (error: any) {
      await client.query("ROLLBACK");
      if (error?.code === "23505") {
        return res.status(409).json({ message: "A beneficiary with that name already exists. Choose a different name." });
      }
      throw error;
    } finally {
      client.release();
    }
  });
}
