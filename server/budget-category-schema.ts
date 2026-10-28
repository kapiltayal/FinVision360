/**
 * Additive ID bridge for legacy ingestion clients, which still submit category
 * labels. Budget reads/grouping use the persisted FK, never those labels.
 * Unresolvable or ambiguous labels remain NULL (Unassigned), not guessed.
 */
export const budgetCategorySchemaSql = `
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type_id INTEGER
    REFERENCES transaction_type_list(id) ON DELETE SET NULL;
  ALTER TABLE budget_plans ADD COLUMN IF NOT EXISTS transaction_type_id INTEGER
    REFERENCES transaction_type_list(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date
    ON transactions(user_id, transaction_type_id, date);
  CREATE INDEX IF NOT EXISTS idx_budget_plans_user_month_category
    ON budget_plans(user_id, month, transaction_type_id);

  CREATE OR REPLACE FUNCTION budget_category_label_key(value TEXT) RETURNS TEXT
    LANGUAGE SQL IMMUTABLE AS $$
      SELECT trim(both '_' from regexp_replace(lower(replace(COALESCE(value,''), '&', ' and ')), '[^a-z0-9]+', '_', 'g'))
    $$;
  CREATE OR REPLACE FUNCTION budget_resolve_category_id(direction TEXT, label TEXT, parent TEXT DEFAULT NULL)
    RETURNS INTEGER LANGUAGE SQL STABLE AS $$
      WITH input AS (SELECT budget_category_label_key(label) AS key),
      candidates AS (
        SELECT c.id, CASE WHEN budget_category_label_key(c.category)=i.key THEN 0 ELSE 1 END AS priority
        FROM transaction_type_list c CROSS JOIN input i
        WHERE lower(c.type)=lower(direction) AND (
          budget_category_label_key(c.category)=i.key OR
          budget_category_label_key(c.category)=CASE i.key
            WHEN 'salary' THEN 'salary_and_wages'
            WHEN 'bonus' THEN 'bonuses_and_commissions'
            WHEN 'business' THEN 'business_income'
            WHEN 'freelance' THEN 'freelance_and_consulting'
            WHEN 'dividend' THEN 'dividends'
            WHEN 'rental' THEN 'rental_income'
            WHEN 'refund' THEN 'refunds'
            WHEN 'housing' THEN 'housing_rent'
            ELSE i.key END
        ) AND (NULLIF(parent,'') IS NULL OR budget_category_label_key(c.parent_category)=budget_category_label_key(parent))
      ), preferred AS (
        SELECT id FROM candidates WHERE priority=(SELECT MIN(priority) FROM candidates)
      )
      SELECT CASE WHEN COUNT(*)=1 THEN MIN(id) END FROM preferred
    $$;

  CREATE OR REPLACE FUNCTION sync_transaction_category_id() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE c transaction_type_list%ROWTYPE;
    BEGIN
      IF TG_OP='UPDATE' AND NEW.transaction_type_id IS NOT NULL
        AND NEW.transaction_type_id IS NOT DISTINCT FROM OLD.transaction_type_id
        AND NEW.type IS NOT DISTINCT FROM OLD.type
        AND NEW.subcategory IS NOT DISTINCT FROM OLD.subcategory
        AND NEW.parent_category IS NOT DISTINCT FROM OLD.parent_category THEN
        -- An amount/notes edit may resubmit unchanged old display labels.
        -- Keep the stable ID even if the catalog name has since changed.
        RETURN NEW;
      END IF;
      IF NEW.transaction_type_id IS NOT NULL AND (
        TG_OP='INSERT' OR NEW.transaction_type_id IS DISTINCT FROM OLD.transaction_type_id
      ) THEN
        SELECT * INTO c FROM transaction_type_list WHERE id=NEW.transaction_type_id;
        IF NOT FOUND OR lower(c.type)<>lower(NEW.type) THEN
          RAISE EXCEPTION 'Invalid transaction category ID' USING ERRCODE='23514';
        END IF;
        NEW.subcategory=c.category;
        NEW.parent_category=c.parent_category;
      ELSE
        NEW.transaction_type_id=budget_resolve_category_id(NEW.type,NEW.subcategory,NEW.parent_category);
      END IF;
      RETURN NEW;
    END $$;
  DROP TRIGGER IF EXISTS transactions_category_id_sync ON transactions;
  CREATE TRIGGER transactions_category_id_sync
    BEFORE INSERT OR UPDATE OF type, subcategory, parent_category, transaction_type_id ON transactions
    FOR EACH ROW EXECUTE FUNCTION sync_transaction_category_id();

  CREATE OR REPLACE FUNCTION sync_budget_category_id() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE c transaction_type_list%ROWTYPE; direction TEXT; label TEXT; resolved INTEGER;
    BEGIN
      direction=split_part(NEW.plan_key,':',1);
      IF direction NOT IN ('income','expense') THEN RETURN NEW; END IF;
      label=substring(NEW.plan_key from position(':' in NEW.plan_key)+1);
      IF label ~ '^category:[0-9]+$' THEN
        resolved=split_part(label,':',2)::integer;
      ELSE
        resolved=budget_resolve_category_id(direction,label);
      END IF;
      SELECT * INTO c FROM transaction_type_list WHERE id=resolved AND lower(type)=direction;
      IF FOUND THEN
        NEW.transaction_type_id=c.id;
        NEW.entity_metadata=jsonb_build_object('name',c.category,'category',c.parent_category);
      ELSE
        NEW.transaction_type_id=NULL;
      END IF;
      RETURN NEW;
    END $$;
  DROP TRIGGER IF EXISTS budget_plans_category_id_sync ON budget_plans;
  CREATE TRIGGER budget_plans_category_id_sync
    BEFORE INSERT OR UPDATE OF plan_key ON budget_plans
    FOR EACH ROW EXECUTE FUNCTION sync_budget_category_id();

  -- Only populate missing references. Do not change amounts, dates, source
  -- descriptions, user overrides, existing IDs, or frozen close payloads.
  UPDATE transactions SET subcategory=subcategory
    WHERE transaction_type_id IS NULL
      AND budget_resolve_category_id(type,subcategory,parent_category) IS NOT NULL;
  UPDATE budget_plans SET plan_key=plan_key
    WHERE transaction_type_id IS NULL AND split_part(plan_key,':',1) IN ('income','expense')
      AND budget_resolve_category_id(split_part(plan_key,':',1),substring(plan_key from position(':' in plan_key)+1)) IS NOT NULL;
`;

export async function ensureBudgetCategorySchema(database: {
  connect(): Promise<{ query(sql: string, values?: any[]): Promise<any>; release(): void }>;
}) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('budget-category-schema',0))");
    await client.query(budgetCategorySchemaSql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
