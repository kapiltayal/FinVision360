import type { Feedback } from "./schema";

export const MAX_FEEDBACK_LENGTH = 10_000;

export type FeedbackSubmissionResult = Feedback & {
  notificationEmailStatus: "sent" | "failed";
};
