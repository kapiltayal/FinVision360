import { ReplitConnectors } from "@replit/connectors-sdk";
import type { Feedback } from "@shared/schema";

export interface FeedbackAuthor {
  id: string;
  email?: string | null;
  fullName?: string | null;
}

type EmailProxy = (
  connector: string,
  path: string,
  options: { method: string; headers: Record<string, string>; body: unknown },
) => Promise<Response>;

export class FeedbackEmailError extends Error {
  constructor(public readonly code: string) {
    super("Feedback email notification could not be confirmed");
    this.name = "FeedbackEmailError";
  }
}

export async function sendFeedbackNotification(
  feedback: Feedback,
  author: FeedbackAuthor,
  options: { proxy?: EmailProxy; timeoutMs?: number } = {},
): Promise<void> {
  // Create a fresh client for each send; credentials stay in the connector.
  const proxy: EmailProxy = options.proxy ?? ((connector, path, request) =>
    new ReplitConnectors().proxy(connector, path, request));
  const email = author.email?.trim();
  const validReplyTo = email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
  const body = {
    from: "FinVision360 Feedback <notifications@finvision360.com>",
    to: ["contactus@finvision360.com"],
    subject: `New FinVision360 feedback #${feedback.id}`,
    ...(validReplyTo ? { reply_to: email } : {}),
    // Plain text prevents feedback from being interpreted as HTML.
    text: [
      "A user submitted feedback on FinVision360.",
      "",
      `Feedback ID: ${feedback.id}`,
      `Submitted at: ${new Date(feedback.createdAt).toISOString()}`,
      `Name: ${author.fullName || "Not provided"}`,
      `Account email: ${email || "Not provided"}`,
      "",
      "Feedback:",
      feedback.message,
    ].join("\n"),
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const send = async () => {
    const response = await proxy("resend", "/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `feedback-notification/${feedback.id}`,
      },
      body,
    });
    if (!response.ok) {
      // Do not include provider bodies; they can contain private customer data.
      throw new FeedbackEmailError(`RESEND_HTTP_${response.status}`);
    }
    const result = await response.json().catch(() => null);
    if (!result || typeof result.id !== "string" || !result.id) {
      throw new FeedbackEmailError("RESEND_INVALID_RESPONSE");
    }
  };
  try {
    await Promise.race([
      send(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new FeedbackEmailError("RESEND_TIMEOUT")), options.timeoutMs ?? 15_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
