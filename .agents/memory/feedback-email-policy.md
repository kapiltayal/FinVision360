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

Confirm that the connected Resend team owns the selected sender domain before
changing DNS. Do not automatically claim or transfer the domain between teams.

**Why:** The legacy connection successfully authenticated, but verification of
the selected domain was blocked because another Resend team had claimed it.
The newly generated DKIM records were therefore not authoritative for that team.

**How to apply:** A domain-claim rejection is not necessarily invalid credentials
or slow DNS propagation. Reconnect to the intended owner's team and use its
domain records, rather than repeatedly verifying or overwriting working DNS.

Feedback must be stored before a notification is attempted. An email problem
must not undo the saved feedback or encourage the user to submit it again.

**Why:** The user requested database storage followed by email; duplicate
submissions would create repeated feedback rather than fix delivery.

**How to apply:** Keep save failure separate from notification failure in both
server handling and user-facing messages.
