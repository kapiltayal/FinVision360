# Feedback email notifications

Authenticated feedback submissions (`POST /api/feedback`) are saved in the
`feedback` table first. After a successful insert, the server sends a plain-text
notification directly through the Resend API using this project's dedicated key.

- Sender: `FinVision360 Feedback <notifications@finvision360.com>`
- Recipient: `contactus@finvision360.com`
- Reply-to: the submitting user's account email, when valid
- Content: feedback ID, timestamp, account name/email, and the saved feedback text
- Scope: the feedback button; the separate public Contact Us form is unchanged

Set `RESEND_API_KEY` in this project's Replit Secrets using a key from the
separate FinVision360 Resend account. Prefer a sending-only key restricted to
`finvision360.com`. Never use a `VITE_` variable, paste the key in chat, or
commit it to source. The key is read only by server code.

The user requires complete separation from FinQuest360. This app does not use or
fall back to the shared Resend connector, and its credentials must not be
replaced or revoked on FinQuest's behalf. A missing project key fails explicitly
without attempting any email through another account.

## Required sender-domain setup

The user selected `finvision360.com` instead of the already verified
`finquest360.com` domain. A verification attempt returned "This domain has been
claimed by another team and can no longer be verified." Its public DKIM key
differs from the one issued to the connected account.

The user confirmed that FinVision360 has its own completely separate Resend
account. Configure the project-only secret from that account rather than
replacing the shared connector's credentials. Verify the domain in the separate
account before testing email. A sending-only key cannot list domains; check
verification in the account's dashboard if that permission is restricted.

**The records below and in Resend_DNS_records.txt are archived values from the
previously connected team, not authoritative setup instructions. Do not overwrite
working DNS with them. Use the intended team's Resend Domains page instead.**

Names below are relative to **finvision360.com**.

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDuBbTVtX3VKD4S2wnYeqP1K09bPXt+VpYfwDD4/MN5RQgy9cu2K0evLDrIeup6/i0KPc4UYFbUp4SARimZ4q21Jfno6DFJc72lKQWWgbYtD39Bc7A0dUmlUtY0d6EgP9n21JNzFN+OnVWuuetUBdR4Qpm3uHi6whrEPFjmqGjlXwIDAQAB` | — |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend` | `send.forge.rmta.net` | — |

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

Run `npx tsx --test server/feedback.test.ts server/feedback-email.test.ts`.
These tests use in-memory storage/transport substitutes: they do not send real
emails, bypass application authentication, or modify the database.
