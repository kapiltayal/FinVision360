import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { budgetCategorySchemaSql } from "./budget-category-schema";

test("category ID migration preserves financial data and resolves all ingestion/edit paths", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const { pool } = await import("./db");
  const client = await pool.connect();
  const schema = `budget_ids_${randomUUID().replace(/-/g, "")}`;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    await client.query(`
      CREATE TABLE transaction_type_list(id SERIAL PRIMARY KEY,type TEXT,category TEXT,parent_category TEXT);
      INSERT INTO transaction_type_list(id,type,category,parent_category) VALUES
        (1,'Income','Salary & Wages','Active'),(21,'Expense','Groceries','Food'),
        (22,'Expense','Dining Out','Food'),(50,'Expense','Misc','A'),(51,'Expense','Misc','B');
      CREATE TABLE transactions(id SERIAL PRIMARY KEY,user_id TEXT,date DATE,type TEXT,subcategory TEXT,parent_category TEXT,amount NUMERIC);
      CREATE TABLE budget_plans(id SERIAL PRIMARY KEY,user_id TEXT,month DATE,plan_key TEXT,planned_amount NUMERIC,entity_metadata JSONB);
      INSERT INTO transactions(user_id,date,type,subcategory,amount) VALUES
        ('a','2026-09-01','expense','groceries',10),('a','2026-09-02','expense','Dining Out',20),
        ('a','2026-09-03','expense','Mystery',30),('a','2026-09-04','expense','Misc',40);
      INSERT INTO budget_plans(user_id,month,plan_key,planned_amount) VALUES
        ('a','2026-11-01','expense:groceries',0),('a','2026-11-01','income:salary',123);
    `);
    await client.query(budgetCategorySchemaSql);
    const first = (await client.query("SELECT id,subcategory,amount,transaction_type_id FROM transactions ORDER BY id")).rows;
    assert.deepEqual(first.map((r) => r.transaction_type_id), [21, 22, null, null]);
    assert.deepEqual(first.map((r) => Number(r.amount)), [10, 20, 30, 40]);
    assert.equal(first[0].subcategory, "groceries", "backfill preserves original category text");
    assert.deepEqual((await client.query("SELECT transaction_type_id,planned_amount FROM budget_plans ORDER BY id")).rows
      .map((r) => [r.transaction_type_id, Number(r.planned_amount)]), [[21, 0], [1, 123]]);
    await client.query(budgetCategorySchemaSql);
    assert.deepEqual((await client.query("SELECT id,subcategory,amount,transaction_type_id FROM transactions ORDER BY id")).rows, first);

    // Existing upload/Plaid/manual SQL writes labels; the boundary persists IDs.
    await client.query("INSERT INTO transactions(type,subcategory,parent_category,amount) VALUES ('expense','dining_out','Food',8)");
    assert.equal((await client.query("SELECT transaction_type_id FROM transactions ORDER BY id DESC LIMIT 1")).rows[0].transaction_type_id, 22);
    await client.query("UPDATE transactions SET subcategory='Groceries' WHERE id=2");
    assert.equal((await client.query("SELECT transaction_type_id FROM transactions WHERE id=2")).rows[0].transaction_type_id, 21);
    await client.query("UPDATE transactions SET subcategory='Unknown' WHERE id=2");
    assert.equal((await client.query("SELECT transaction_type_id FROM transactions WHERE id=2")).rows[0].transaction_type_id, null);

    await client.query("INSERT INTO transactions(type,transaction_type_id,amount) VALUES ('expense',21,99)");
    const numeric = (await client.query("SELECT subcategory,parent_category FROM transactions ORDER BY id DESC LIMIT 1")).rows[0];
    assert.deepEqual(numeric, { subcategory: "Groceries", parent_category: "Food" });
    await client.query("SAVEPOINT invalid_direction");
    await assert.rejects(client.query("INSERT INTO transactions(type,transaction_type_id) VALUES ('income',21)"), /Invalid transaction category ID/);
    await client.query("ROLLBACK TO SAVEPOINT invalid_direction");
    await client.query("UPDATE transaction_type_list SET category='Food purchases' WHERE id=21");
    await client.query("UPDATE transactions SET amount=amount, subcategory=subcategory, parent_category=parent_category WHERE transaction_type_id=21");
    assert.equal(Number((await client.query("SELECT SUM(amount) AS total FROM transactions WHERE transaction_type_id=21")).rows[0].total), 109);
    await client.query("INSERT INTO budget_plans(plan_key,planned_amount) VALUES ('expense:category:21',7)");
    assert.equal((await client.query("SELECT entity_metadata FROM budget_plans ORDER BY id DESC LIMIT 1")).rows[0].entity_metadata.name, "Food purchases");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
