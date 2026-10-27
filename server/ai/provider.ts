import OpenAI from "openai";

export const AI_MODEL_ID = "gpt-5.6-luna";
const MAX_INPUT_CHARACTERS = 28_000;
const MAX_COMPLETION_TOKENS = 1_800;
const AI_NOT_CONFIGURED_MESSAGE = "Replit-managed AI is not enabled for this app yet. No personal OpenAI key is configured.";

export type AIModelUsage = {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};
export type AIUsageReporter = (usage: AIModelUsage) => Promise<void>;

type ProviderUsage = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  prompt_tokens_details?: { cached_tokens?: number | null } | null;
} | null | undefined;

export function normalizedAIModelUsage(model: string, usage: ProviderUsage): AIModelUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = Math.max(0, Math.trunc(usage.prompt_tokens ?? 0));
  const outputTokens = Math.max(0, Math.trunc(usage.completion_tokens ?? 0));
  const cachedInputTokens = Math.min(inputTokens, Math.max(0, Math.trunc(usage.prompt_tokens_details?.cached_tokens ?? 0)));
  return { model, inputTokens, cachedInputTokens, outputTokens };
}

export async function reportAIUsageSafely(
  reporter: AIUsageReporter | undefined,
  usage: AIModelUsage | undefined,
): Promise<void> {
  if (!reporter || !usage) return;
  try {
    await reporter(usage);
  } catch {
    // Usage persistence must not prevent an otherwise successful AI response.
    console.error("AI usage could not be recorded");
  }
}

export const AI_ADVISOR_LIMITS = {
  maxQuestionCharacters: 2_000,
  maxContextItems: 100,
  maxContextFieldCharacters: 160,
  maxInputCharacters: MAX_INPUT_CHARACTERS,
  maxCompletionTokens: MAX_COMPLETION_TOKENS,
} as const;

export type AdvisorMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export class AIProviderError extends Error {
  constructor(message = "The AI service is temporarily unavailable.") {
    super(message);
    this.name = "AIProviderError";
  }
}

function createClient(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new AIProviderError(AI_NOT_CONFIGURED_MESSAGE);
  }

  return new OpenAI({ apiKey, baseURL });
}

function validateMessages(messages: readonly AdvisorMessage[]): AdvisorMessage[] {
  if (!messages.length || messages.length > 4) {
    throw new AIProviderError();
  }

  const normalized = messages.map((message) => {
    if (typeof message.content !== "string" || !message.content.trim()) {
      throw new AIProviderError();
    }
    return {
      role: message.role,
      content: message.content.slice(0, MAX_INPUT_CHARACTERS),
    } as AdvisorMessage;
  });

  const totalCharacters = normalized.reduce(
    (total, message) => total + (typeof message.content === "string" ? message.content.length : 0),
    0,
  );
  if (totalCharacters > MAX_INPUT_CHARACTERS) {
    throw new AIProviderError("This request contains too much information to analyze at once.");
  }
  return normalized;
}

export async function streamAdvisorCompletion(
  messages: readonly AdvisorMessage[],
  signal?: AbortSignal,
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  const stream = await createClient().chat.completions.create({
    model: AI_MODEL_ID,
    messages: validateMessages(messages),
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: MAX_COMPLETION_TOKENS,
  }, { signal });
  return stream;
}

/**
 * A deliberately non-streaming completion for import classification.  Keeping
 * this separate from the advisor stream makes it possible for callers to
 * distinguish an unavailable provider (where deterministic matching is OK)
 * from an unusable successful model response.
 */
export async function completeIngestionClassification(
  prompt: string,
  signal?: AbortSignal,
  onUsage?: AIUsageReporter,
): Promise<string> {
  const messages: AdvisorMessage[] = [
    {
      role: "system",
      content: "Return only a JSON object. Do not include markdown or commentary.",
    },
    { role: "user", content: prompt },
  ];
  try {
    const completion = await createClient().chat.completions.create({
      model: AI_MODEL_ID,
      messages: validateMessages(messages),
      stream: false,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      response_format: { type: "json_object" },
    }, { signal });
    await reportAIUsageSafely(onUsage, normalizedAIModelUsage(completion.model || AI_MODEL_ID, completion.usage));
    return completion.choices[0]?.message?.content ?? "";
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError();
  }
}