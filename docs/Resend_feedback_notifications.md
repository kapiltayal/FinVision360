# Feedback email notifications

Authenticated feedback submissions (`POST /api/feedback`) are saved in the
`feedback` table first. After a successful insert, the server sends a plain-text
notification through the connected Resend integration.

- Sender: `FinVision360 Feedback <notifications@finvision360.com>`
- Recipient: `contactus@finvision360.com`
- Reply-to: the submitting user's account email, when valid
- Content: feedback ID, timestamp, account name/email, and the saved feedback text
- Scope: the feedback button; the separate public Contact Us form is unchanged

Credentials are managed by the Replit Resend connector, not stored in application
code or exposed to the browser. Every send uses a fresh connector client.

## Required sender-domain setup

The user selected `finvision360.com` instead of the already verified
`finquest360.com` domain. A verification attempt returned "This domain has been
claimed by another team and can no longer be verified." Its public DKIM key
differs from the one issued to the connected account.

Reconnect this project's Resend integration using an API key from the team where
`finvision360.com` is verified. Do not paste credentials in chat or application
code. Confirm the domain through the newly connected account before testing email.

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
