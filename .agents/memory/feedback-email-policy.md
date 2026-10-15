---
name: Feedback sender policy
description: User-selected sender identity and persistence priority for feedback notifications.
---

Use the current `finvision360.com` domain for feedback notifications. Do not
silently fall back to the older `finquest360.com` domain.

**Why:** The connected Resend account already had the older domain verified, but
the user explicitly selected the FinVision360 domain when offered that choice.
Sender verification must not override the selected brand identity.

**How to apply:** Resolve verification problems on the selected domain rather
than substituting another sender identity.

Feedback must be stored before a notification is attempted. An email problem
must not undo the saved feedback or encourage the user to submit it again.

**Why:** The user requested database storage followed by email; duplicate
submissions would create repeated feedback rather than fix delivery.

**How to apply:** Keep save failure separate from notification failure in both
server handling and user-facing messages.
