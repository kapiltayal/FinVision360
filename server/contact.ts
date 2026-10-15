import type { RequestHandler } from "express";
import type { Contactus, InsertContactus } from "@shared/schema";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(254).email().refine(value => !/[\r\n<>]/.test(value)),
  subject: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(10_000),
});

interface ContactDependencies {
  createSubmission: (data: InsertContactus) => Promise<Contactus>;
  sendNotification: (submission: Contactus) => Promise<void>;
  logEmailError: (error: unknown) => void;
}

export function createContactHandler(dependencies: ContactDependencies): RequestHandler {
  return async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Please enter all fields with a valid email address. Name must be 200 characters or fewer, subject 500 or fewer, and message 10,000 or fewer." });
      return;
    }
    // A failed database insert must never trigger an email.
    const created = await dependencies.createSubmission(parsed.data);
    let notificationEmailStatus: "sent" | "failed" = "sent";
    try {
      await dependencies.sendNotification(created);
    } catch (error) {
      notificationEmailStatus = "failed";
      dependencies.logEmailError(error);
    }
    res.json({
      message: notificationEmailStatus === "sent"
        ? "Thank you! We've received your message and will be in touch soon."
        : "Your message was saved, but the email notification could not be confirmed. You don't need to submit it again.",
      notificationEmailStatus,
    });
  };
}
