import OpenAI from "openai";

const ADVISOR_MODEL = "gpt-4o-mini";
const MAX_INPUT_CHARACTERS = 28_000;
const MAX_COMPLETION_TOKENS = 1_800;

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
    console.error("AI integration configuration unavailable", {
      hasApiKey: Boolean(apiKey),
      hasBaseURL: Boolean(baseURL),
    });
    throw new AIProviderError();
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
    model: ADVISOR_MODEL,
    messages: validateMessages(messages),
    stream: true,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
  }, { signal });
  return stream;
}