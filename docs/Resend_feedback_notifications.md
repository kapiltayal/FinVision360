# Feedback email notifications

Reviewed against repository code: **2026-10-18**. [Documentation index](README.md).

This document describes the configured transport and historical DNS setup, not a fresh verification of live DNS, Resend account status, or inbox delivery.

Authenticated feedback submissions (`POST /api/feedback`) are saved in the
`feedback` table first. After a successful insert, the server sends a plain-text
notification directly through the Resend API using this project's dedicated key.

- Sender: `FinVision360 Feedback <notifications@finvision360.com>`
- Recipient: `contactus@finvision360.com`
- Reply-to: the submitting user's account email, when valid
- Content: feedback ID, timestamp, account name/email, and the saved feedback text
- Scope: the feedback button and the public Contact Us form

## Contact Us notifications

Public submissions (`POST /api/contact`) are saved in `contactus` first, then
emailed through the same separate FinVision360 account to `contactus@finvision360.com`.
The sender is `FinVision360 Contact <notifications@finvision360.com>`. Emails
include the saved name, email, subject, message, ID and timestamp in plain text.
The validated visitor email is used as Reply-To; no copy is sent to the visitor.
Each saved submission uses a distinct `contact-notification/{id}` idempotency key.

All four fields are required and trimmed. Maximum lengths: name 200, email 254,
subject 500, message 10,000 characters. Invalid submissions are rejected before
storage or email. A storage failure sends no email. A notification failure
preserves the submission, returns HTTP 200 with `notificationEmailStatus: "failed"`,
and the page confirms the message was saved without asking the visitor to retry.
As with feedback, there is no automatic notification retry queue.

Set `RESEND_API_KEY` in this project's Replit Secrets using a key from the
separate FinVision360 Resend account. Prefer a sending-only key restricted to
`finvision360.com`. Never use a `VITE_` variable, paste the key in chat, or
commit it to source. The key is read only by server code.

The user requires complete separation from FinQuest360. This app does not use or
fall back to the shared Resend connector, and its credentials must not be
replaced or revoked on FinQuest's behalf. A missing project key fails explicitly
without attempting any email through another account.

## Required sender-domain setup

The user confirmed that FinVision360 has its own completely separate Resend
account. Configure the project-only secret from that account rather than
replacing the shared connector's credentials. Verify the domain in the separate
account before testing email. A sending-only key cannot list domains; check
verification in the account's dashboard if that permission is restricted.

The dedicated key was confirmed against the intended account. The records below
and in `Resend_DNS_records.txt` were retrieved from that account and supersede
the earlier legacy-account records. Resend's current domain page is the source
of truth if the domain is recreated or its DNS configuration changes.

Names below are relative to **finvision360.com**.

| Type | Name | Value |
| --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6N6oMPus6nX5CMk95wgksDB0QATILZgm6pEYluTIlT8FPWuEltz+oqSyspM6LhxWHb/JjdcANAfe7KnVfoJKrVi6anRGuM82RDlACiHrzRzEa4AXLs8JBq6K4/UXKCaXAcwwLtZPmwXyuOZJj1AhU8U0Mp7sjtmaEeG1wIsQOtwIDAQAB` |
| CNAME | `send` | `send.forge.rmta.net` |
| CNAME | `rsend` | `rsend.forge.rmta.net` |

Replace an empty `v=DKIM1; p=` TXT value with the complete DKIM value above.
Do not create competing TXT keys at that host. A CNAME cannot coexist with other
record types at the same hostname; do not combine the old account's `send`
MX/TXT instructions with this account's `send` CNAME.

These are sending-domain records. **Do not replace the domain's existing root
MX records** or disrupt the mailbox receiving mail at contactus@finvision360.com.
If the provider offers proxying for the CNAME, use DNS-only mode.

After adding the records, verify the domain in Resend. Its status must become
`verified`. Then submit one clearly labeled test feedback entry and confirm
Resend accepts the notification and it arrives in the destination inbox.

## Failure behavior and limits

- Missing/blank or non-text messages are rejected; maximum length is 10,000 characters.
- If saving fails, no notification is sent.
- If Resend rejects the message, times out, or gives an invalid response, the
  feedback remains saved and the API still returns HTTP 201, with
  `notificationEmailStatus: "failed"`. The UI explains that resubmission is not needed.
- `"sent"` indicates Resend accepted the request, not confirmed inbox delivery.
- The request has a 15-second notification timeout. A timed-out request may still
  complete at Resend; the UI deliberately says delivery could not be confirmed.
- A feedback-specific Resend idempotency key prevents duplicate sends for that
  saved feedback within Resend's idempotency window.
- Failures log only a safe error type/code, never email bodies or private provider responses.
- There is no durable retry queue or automatic replay of previously saved feedback.

## Verification

Run `npx tsx --test server/feedback.test.ts server/feedback-email.test.ts server/contact.test.ts`.
These tests use in-memory storage/transport substitutes: they do not send real
emails, bypass application authentication, or modify the database.
