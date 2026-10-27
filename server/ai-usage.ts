import { pool } from "./db";
import type { AIModelUsage } from "./ai/provider";

export type AIUsageFeature = "file_upload" | "ai_qa";

const USD_PER_MILLION_TOKENS: Record<string, {
  input: number;
  cachedInput: number;
  output: number;
}> = {
  // OpenAI published pricing for GPT-5.6 Luna, checked October 27, 2026.
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
};

export function estimateAIUsageCostUsd(usage: AIModelUsage): number | null {
  const rates = USD_PER_MILLION_TOKENS[usage.model];
  if (!rates) return null;
  const cachedInputTokens = Math.min(usage.inputTokens, usage.cachedInputTokens);
  const uncachedInputTokens = usage.inputTokens - cachedInputTokens;
  const cost = (
    uncachedInputTokens * rates.input +
    cachedInputTokens * rates.cachedInput +
    usage.outputTokens * rates.output
  ) / 1_000_000;
  return Number(cost.toFixed(8));
}

type QueryClient = { query(sql: string, values?: unknown[]): Promise<unknown> };

export async function recordAIUsage(
  userId: string,
  feature: AIUsageFeature,
  usage: AIModelUsage,
  database: QueryClient = pool,
): Promise<void> {
  const fileUpload = feature === "file_upload";
  const estimatedCostUsd = estimateAIUsageCostUsd(usage);
  const promptTokens = Math.max(0, Math.trunc(usage.inputTokens));
  const cachedPromptTokens = Math.min(promptTokens, Math.max(0, Math.trunc(usage.cachedInputTokens)));
  const outputTokens = Math.max(0, Math.trunc(usage.outputTokens));
  const increments = [
    fileUpload ? promptTokens : 0,
    fileUpload ? cachedPromptTokens : 0,
    fileUpload ? outputTokens : 0,
    fileUpload ? promptTokens + outputTokens : 0,
    fileUpload ? estimatedCostUsd : 0,
    fileUpload && estimatedCostUsd === null ? 1 : 0,
    fileUpload ? 0 : promptTokens,
    fileUpload ? 0 : cachedPromptTokens,
    fileUpload ? 0 : outputTokens,
    fileUpload ? 0 : promptTokens + outputTokens,
    fileUpload ? 0 : estimatedCostUsd,
    !fileUpload && estimatedCostUsd === null ? 1 : 0,
  ];

  await database.query(
    `INSERT INTO ai_usage (
       user_id, usage_month,
       file_upload_input_tokens, file_upload_cached_input_tokens, file_upload_output_tokens,
       file_upload_total_tokens, file_upload_estimated_cost_usd, file_upload_unpriced_requests,
       ai_qa_input_tokens, ai_qa_cached_input_tokens, ai_qa_output_tokens,
       ai_qa_total_tokens, ai_qa_estimated_cost_usd, ai_qa_unpriced_requests
     ) VALUES (
       $1, date_trunc('month', NOW() AT TIME ZONE 'UTC')::date,
       $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
     )
     ON CONFLICT (user_id, usage_month) DO UPDATE SET
       file_upload_input_tokens = ai_usage.file_upload_input_tokens + EXCLUDED.file_upload_input_tokens,
       file_upload_cached_input_tokens = ai_usage.file_upload_cached_input_tokens + EXCLUDED.file_upload_cached_input_tokens,
       file_upload_output_tokens = ai_usage.file_upload_output_tokens + EXCLUDED.file_upload_output_tokens,
       file_upload_total_tokens = ai_usage.file_upload_total_tokens + EXCLUDED.file_upload_total_tokens,
       file_upload_estimated_cost_usd = CASE
         WHEN EXCLUDED.file_upload_unpriced_requests > 0 OR ai_usage.file_upload_estimated_cost_usd IS NULL THEN NULL
         ELSE ai_usage.file_upload_estimated_cost_usd + EXCLUDED.file_upload_estimated_cost_usd
       END,
       file_upload_unpriced_requests = ai_usage.file_upload_unpriced_requests + EXCLUDED.file_upload_unpriced_requests,
       ai_qa_input_tokens = ai_usage.ai_qa_input_tokens + EXCLUDED.ai_qa_input_tokens,
       ai_qa_cached_input_tokens = ai_usage.ai_qa_cached_input_tokens + EXCLUDED.ai_qa_cached_input_tokens,
       ai_qa_output_tokens = ai_usage.ai_qa_output_tokens + EXCLUDED.ai_qa_output_tokens,
       ai_qa_total_tokens = ai_usage.ai_qa_total_tokens + EXCLUDED.ai_qa_total_tokens,
       ai_qa_estimated_cost_usd = CASE
         WHEN EXCLUDED.ai_qa_unpriced_requests > 0 OR ai_usage.ai_qa_estimated_cost_usd IS NULL THEN NULL
         ELSE ai_usage.ai_qa_estimated_cost_usd + EXCLUDED.ai_qa_estimated_cost_usd
       END,
       ai_qa_unpriced_requests = ai_usage.ai_qa_unpriced_requests + EXCLUDED.ai_qa_unpriced_requests,
       updated_at = NOW()`,
    [userId, ...increments],
  );
}
