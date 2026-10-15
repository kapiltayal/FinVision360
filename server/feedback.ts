import type { RequestHandler } from "express";
import type { Feedback, InsertFeedback } from "@shared/schema";
import { MAX_FEEDBACK_LENGTH, type FeedbackSubmissionResult } from "@shared/feedback";
import type { FeedbackAuthor } from "./feedback-email";

interface FeedbackDependencies {
  createFeedback: (data: InsertFeedback) => Promise<Feedback>;
  sendNotification: (feedback: Feedback, author: FeedbackAuthor) => Promise<void>;
  logEmailError: (error: unknown) => void;
}

export function createFeedbackHandler(dependencies: FeedbackDependencies): RequestHandler {
  return async (req, res) => {
    const author = req.user as FeedbackAuthor | undefined;
    if (!author?.id) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      res.status(400).json({ message: "Feedback message is required" });
      return;
    }
    if (message.length > MAX_FEEDBACK_LENGTH) {
      res.status(400).json({ message: `Feedback must be ${MAX_FEEDBACK_LENGTH.toLocaleString("en-US")} characters or fewer` });
      return;
    }

    // Only notify after the database insert has successfully completed.
    // Database failures propagate to Express and never trigger an email.
    const created = await dependencies.createFeedback({ userId: author.id, message });
    let notificationEmailStatus: FeedbackSubmissionResult["notificationEmailStatus"] = "sent";
    try {
      await dependencies.sendNotification(created, author);
    } catch (error) {
      notificationEmailStatus = "failed";
      dependencies.logEmailError(error);
    }
    // An email failure must not discard saved feedback or encourage a duplicate submission.
    res.status(201).json({ ...created, notificationEmailStatus } satisfies FeedbackSubmissionResult);
  };
}
