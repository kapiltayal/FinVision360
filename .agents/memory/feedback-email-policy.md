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
or slow DNS propagation. Use the intended owner's account and its domain
records, rather than repeatedly verifying or overwriting working DNS.
Record types can differ between accounts as well as their values; use the
intended account's current domain records rather than a generic MX/SPF template.

Wait for the domain's full `verified` status before testing delivery.

**Why:** Resend rejected sends while the domain was `partially_verified`, even
with DKIM and `send` verified, until `rsend` also finished verification. Public
recursive DNS briefly returned stale missing-record results despite correct
authoritative records.

**How to apply:** If authoritative DNS matches the intended account, allow
verification/cache propagation instead of asking for repeated DNS edits.

Keep the FinVision360 Resend account completely separate from FinQuest360.
Do not reuse the legacy shared connection or replace its credentials.

**Why:** The user explicitly stated that they created a completely separate
Resend account for FinVision360 and want it totally separate from FinQuest360.

**How to apply:** Use a project-only API key from the FinVision account, with
no shared-connector fallback. Never resolve a setup issue by altering the
FinQuest account, its credentials, or its domain ownership.

Feedback must be stored before a notification is attempted. An email problem
must not undo the saved feedback or encourage the user to submit it again.

**Why:** The user requested database storage followed by email; duplicate
submissions would create repeated feedback rather than fix delivery.

**How to apply:** Keep save failure separate from notification failure in both
server handling and user-facing messages.
