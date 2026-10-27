export const aiUsageSchemaSql = `
  CREATE TABLE IF NOT EXISTS ai_usage (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    usage_month DATE NOT NULL,
    file_upload_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (file_upload_input_tokens >= 0),
    file_upload_cached_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (file_upload_cached_input_tokens >= 0),
    file_upload_output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (file_upload_output_tokens >= 0),
    file_upload_total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (file_upload_total_tokens >= 0),
    file_upload_estimated_cost_usd NUMERIC(18,8),
    file_upload_unpriced_requests INTEGER NOT NULL DEFAULT 0 CHECK (file_upload_unpriced_requests >= 0),
    ai_qa_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (ai_qa_input_tokens >= 0),
    ai_qa_cached_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (ai_qa_cached_input_tokens >= 0),
    ai_qa_output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (ai_qa_output_tokens >= 0),
    ai_qa_total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (ai_qa_total_tokens >= 0),
    ai_qa_estimated_cost_usd NUMERIC(18,8),
    ai_qa_unpriced_requests INTEGER NOT NULL DEFAULT 0 CHECK (ai_qa_unpriced_requests >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_user_month_unique
    ON ai_usage(user_id, usage_month);
`;

export async function ensureAIUsageSchema(database: {
  connect(): Promise<{ query(sql: string, values?: unknown[]): Promise<unknown>; release(): void }>;
}): Promise<void> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('ai-usage-schema',0))");
    await client.query(aiUsageSchemaSql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
